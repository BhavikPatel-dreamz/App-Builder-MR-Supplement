import {
  AliasNode,
  BinaryOperationNode,
  ColumnNode,
  InsertQueryNode,
  OnConflictNode,
  OperationNodeTransformer,
  OperatorNode,
  PrimitiveValueListNode,
  ReferenceNode,
  TableNode,
  ValueListNode,
  ValueNode,
  ValuesNode,
  WhereNode,
} from "kysely";
import type {
  DeleteQueryNode,
  FromNode,
  KyselyPlugin,
  OperationNode,
  PluginTransformQueryArgs,
  PluginTransformResultArgs,
  QueryId,
  QueryResult,
  RootOperationNode,
  SelectQueryNode,
  UnknownRow,
  UpdateQueryNode,
} from "kysely";

/**
 * Per-shop isolation for the Hot Updater tables on the SHARED Postgres
 * database (this app plus app-builder / app-builder-xyxx / riyasat-builder
 * all point at the same DB). The stock @hot-updater/server kysely adapter is
 * tenant-unaware: it never writes a `shop` value (so inserts hit the
 * `bundles_shop_fkey` FK with shop='') and never filters reads by shop (so it
 * would happily serve every app's bundles).
 *
 * This Kysely plugin is the single isolation point. For the two tenant tables
 * it rewrites every query the adapter issues:
 *   - INSERT  -> appends a `shop` column + value, and scopes ON CONFLICT DO
 *               UPDATE with `WHERE shop = $shop` so a (astronomically unlikely)
 *               UUID collision can never overwrite another shop's row.
 *   - SELECT / DELETE / UPDATE -> ANDs `WHERE shop = $shop` onto the query.
 * Every other table (e.g. private_hot_updater_settings, used by the schema
 * version check) is left completely untouched.
 *
 * It is fail-closed: constructing the plugin without a shop throws, so an
 * unscoped instance can never reach the database by accident.
 */
export const SCOPED_TABLES = new Set(["bundles", "bundle_patches"]);
const SHOP_COLUMN = "shop";

/** Table name of a TableNode / aliased TableNode, else undefined. */
function tableNameOf(node: OperationNode | undefined): string | undefined {
  if (!node) return undefined;
  if (TableNode.is(node)) return node.table.identifier.name;
  if (AliasNode.is(node) && TableNode.is(node.node)) {
    return node.node.table.identifier.name;
  }
  return undefined;
}

function isScopedTable(name: string | undefined): boolean {
  return name !== undefined && SCOPED_TABLES.has(name);
}

/** True when any FROM item targets a tenant table (adapter reads are single-table). */
function fromTargetsScopedTable(from: FromNode | undefined): boolean {
  if (!from) return false;
  return from.froms.some((item) => isScopedTable(tableNameOf(item)));
}

class ShopScopeTransformer extends OperationNodeTransformer {
  private readonly shop: string;

  constructor(shop: string) {
    super();
    this.shop = shop;
  }

  /**
   * `shop = $shop`. Pass a table name to qualify it as `"<table>"."shop" = $shop`.
   *
   * The qualified form is required inside `ON CONFLICT DO UPDATE`, where both the
   * target table and the `excluded` pseudo-row expose a `shop` column, so a bare
   * reference is ambiguous (Postgres error 42702). The bare form is correct
   * everywhere else, since every other scoped query is single-table.
   */
  private shopEquals(table?: string): OperationNode {
    return BinaryOperationNode.create(
      ReferenceNode.create(
        ColumnNode.create(SHOP_COLUMN),
        table ? TableNode.create(table) : undefined,
      ),
      OperatorNode.create("="),
      ValueNode.create(this.shop),
    );
  }

  private andShopWhere<T extends { where?: WhereNode }>(node: T): T {
    const predicate = this.shopEquals();
    const where = node.where
      ? WhereNode.cloneWithOperation(node.where, "And", predicate)
      : WhereNode.create(predicate);
    return { ...node, where };
  }

  override transformSelectQuery(
    node: SelectQueryNode,
    queryId: QueryId,
  ): SelectQueryNode {
    const transformed = super.transformSelectQuery(node, queryId);
    if (!fromTargetsScopedTable(transformed.from)) return transformed;
    return this.andShopWhere(transformed);
  }

  override transformDeleteQuery(
    node: DeleteQueryNode,
    queryId: QueryId,
  ): DeleteQueryNode {
    const transformed = super.transformDeleteQuery(node, queryId);
    if (!fromTargetsScopedTable(transformed.from)) return transformed;
    return this.andShopWhere(transformed);
  }

  override transformUpdateQuery(
    node: UpdateQueryNode,
    queryId: QueryId,
  ): UpdateQueryNode {
    const transformed = super.transformUpdateQuery(node, queryId);
    if (!isScopedTable(tableNameOf(transformed.table))) return transformed;
    return this.andShopWhere(transformed);
  }

  override transformInsertQuery(
    node: InsertQueryNode,
    queryId: QueryId,
  ): InsertQueryNode {
    const transformed = super.transformInsertQuery(node, queryId);
    if (!isScopedTable(tableNameOf(transformed.into))) return transformed;

    // Fail-closed: only VALUES(...) inserts can be scoped. Anything else
    // (INSERT ... SELECT, DEFAULT VALUES) would slip the shop tag, so refuse
    // rather than write an unscoped row into a tenant table.
    if (
      !transformed.columns ||
      transformed.columns.length === 0 ||
      !transformed.values ||
      !ValuesNode.is(transformed.values)
    ) {
      throw new Error(
        `[ota] refusing to insert into "${tableNameOf(transformed.into)}" without explicit VALUES — shop isolation cannot be applied.`,
      );
    }

    // Idempotent: never double-inject if a shop column is already present.
    const alreadyScoped = transformed.columns.some(
      (col) => ColumnNode.is(col) && col.column.name === SHOP_COLUMN,
    );
    if (alreadyScoped) return transformed;

    const columns = [...transformed.columns, ColumnNode.create(SHOP_COLUMN)];
    const rows = transformed.values.values.map((row) => {
      if (PrimitiveValueListNode.is(row)) {
        return PrimitiveValueListNode.create([...row.values, this.shop]);
      }
      if (ValueListNode.is(row)) {
        return ValueListNode.create([...row.values, ValueNode.create(this.shop)]);
      }
      throw new Error(
        `[ota] unexpected insert value node for "${tableNameOf(transformed.into)}" — shop isolation cannot be applied.`,
      );
    });

    // ON CONFLICT (id) DO UPDATE SET ... -> only touch a row that is already
    // this shop's. (DO NOTHING has no updates and needs no guard.) The `shop`
    // reference must be qualified with the target table, because inside DO
    // UPDATE the `excluded` row also has a `shop` column and a bare reference
    // is ambiguous (Postgres 42702).
    let onConflict = transformed.onConflict;
    if (onConflict?.updates && onConflict.updates.length > 0) {
      onConflict = OnConflictNode.cloneWithUpdateWhere(
        onConflict,
        this.shopEquals(tableNameOf(transformed.into)),
      );
    }

    return InsertQueryNode.cloneWith(transformed, {
      columns,
      values: ValuesNode.create(rows),
      ...(onConflict ? { onConflict } : {}),
    });
  }
}

/**
 * Kysely plugin that applies {@link ShopScopeTransformer} to every query.
 * Attach with `db.withPlugin(new ShopScopePlugin(shop))`.
 */
export class ShopScopePlugin implements KyselyPlugin {
  private readonly transformer: ShopScopeTransformer;

  constructor(shop: string) {
    const normalized = typeof shop === "string" ? shop.trim() : "";
    if (!normalized) {
      throw new Error(
        "[ota] ShopScopePlugin requires a non-empty shop — refusing to build an unscoped (cross-tenant) database handle.",
      );
    }
    this.transformer = new ShopScopeTransformer(normalized);
  }

  transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
    return this.transformer.transformNode(args.node, args.queryId);
  }

  async transformResult(
    args: PluginTransformResultArgs,
  ): Promise<QueryResult<UnknownRow>> {
    return args.result;
  }
}
