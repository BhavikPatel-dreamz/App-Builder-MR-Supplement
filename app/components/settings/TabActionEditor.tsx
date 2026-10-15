import { useEffect, useState } from "react";
import { riyasatActions, pickProduct, pickCollection, pageParamsFromRows, pageParamsToRows } from "../cms/actionsConfig";
import type { BottomTabAction } from "../../lib/bottom-tabs";

const NONE = "";

type CmsPageOption = { id: string; title: string; slug?: string };

export function TabActionEditor({
  value,
  pages,
  onChange,
}: {
  value: BottomTabAction;
  pages: CmsPageOption[];
  onChange: (next: BottomTabAction) => void;
}) {
  const actionName =
    value && "actionName" in value ? String(value.actionName ?? "") : "";
  const params =
    value && "params" in value && value.params && typeof value.params === "object"
      ? value.params
      : {};
  const schema = riyasatActions.find((action) => action.name === actionName);

  const setParam = (key: string, val: unknown) => {
    if (!actionName) {
      onChange({});
      return;
    }
    const nextParams = { ...params, [key]: val };
    const normalized = schema?.normalizeParams
      ? schema.normalizeParams(nextParams)
      : nextParams;
    onChange({ actionName, params: normalized });
  };

  return (
    <s-stack direction="block" gap="small">
      <s-select
        label="Action"
        name="tabAction"
        value={actionName}
        onChange={(event) => {
          const nextName = event.currentTarget.value;
          if (!nextName) {
            onChange({});
            return;
          }
          const next = riyasatActions.find((action) => action.name === nextName);
          onChange({
            actionName: nextName,
            params: { ...(next?.defaultParams ?? {}) },
          });
        }}
      >
        <s-option value={NONE}>None</s-option>
        {riyasatActions.map((action) => (
          <s-option key={action.name} value={action.name}>
            {action.label}
          </s-option>
        ))}
      </s-select>

      {(schema?.fields ?? []).map((field) => {
        const fieldValue = params[field.key];

        if (field.type === "boolean") {
          return (
            <s-checkbox
              key={field.key}
              label={field.label}
              checked={fieldValue !== false}
              onChange={(event) =>
                setParam(field.key, event.currentTarget.checked)
              }
            ></s-checkbox>
          );
        }

        if (field.type === "product-picker") {
          const label =
            String(params.productTitle || params.productHandle || params.productId || "");
          return (
            <s-stack key={field.key} direction="block" gap="small">
              <s-text color="subdued">{field.label}</s-text>
              <s-text>{label || "No product selected."}</s-text>
              <s-stack direction="inline" gap="small">
                <s-button
                  variant="secondary"
                  onClick={async () => {
                    const picked = await pickProduct();
                    if (!picked) return;
                    setParam("productId", picked.productId);
                    onChange({
                      actionName,
                      params: {
                        ...params,
                        productId: picked.productId,
                        productHandle: picked.productHandle,
                        productTitle: picked.productTitle,
                      },
                    });
                  }}
                >
                  {label ? "Change product" : "Select product"}
                </s-button>
              </s-stack>
            </s-stack>
          );
        }

        if (field.type === "collection-picker") {
          const label = String(
            params.collectionTitle || params.collectionHandle || params.collectionId || "",
          );
          return (
            <s-stack key={field.key} direction="block" gap="small">
              <s-text color="subdued">{field.label}</s-text>
              <s-text>{label || "No collection selected."}</s-text>
              <s-stack direction="inline" gap="small">
                <s-button
                  variant="secondary"
                  onClick={async () => {
                    const picked = await pickCollection();
                    if (!picked) return;
                    onChange({
                      actionName,
                      params: {
                        ...params,
                        collectionId: picked.collectionId,
                        collectionHandle: picked.collectionHandle,
                        collectionTitle: picked.collectionTitle,
                      },
                    });
                  }}
                >
                  {label ? "Change collection" : "Select collection"}
                </s-button>
              </s-stack>
            </s-stack>
          );
        }

        if (field.type === "page-select") {
          const current = String(fieldValue ?? params.pageId ?? "");
          return (
            <s-stack key={field.key} direction="block" gap="small">
              <s-select
                label={field.label}
                value={current}
                onChange={(event) => setParam("pageId", event.currentTarget.value)}
              >
                <s-option value="">Select a page</s-option>
                {pages.map((page) => (
                  <s-option key={page.id} value={page.slug || page.id}>
                    {page.title}
                  </s-option>
                ))}
              </s-select>
              <s-text-field
                label="Page ID (or type a custom id)"
                value={current}
                onChange={(event) => setParam("pageId", event.currentTarget.value)}
              ></s-text-field>
            </s-stack>
          );
        }

        if (field.type === "page-params") {
          return (
            <PageParamsField
              key={field.key}
              label={field.label}
              help={field.help}
              actionName={actionName}
              persisted={
                params.pageParams && typeof params.pageParams === "object"
                  ? (params.pageParams as Record<string, unknown>)
                  : {}
              }
              onChange={(rows) => {
                if (!actionName) {
                  onChange({});
                  return;
                }
                const nextParams = {
                  pageId: params.pageId,
                  pageParamRows: rows,
                  pageParams: pageParamsFromRows(rows),
                  pageParamsRaw: "",
                };
                const normalized = schema?.normalizeParams
                  ? schema.normalizeParams(nextParams)
                  : nextParams;
                onChange({ actionName, params: normalized });
              }}
            />
          );
        }

        if (field.type === "textarea") {
          return (
            <s-text-area
              key={field.key}
              label={field.label}
              value={String(fieldValue ?? "")}
              onChange={(event) => setParam(field.key, event.currentTarget.value)}
            ></s-text-area>
          );
        }

        return (
          <s-text-field
            key={field.key}
            label={field.label}
            value={String(fieldValue ?? "")}
            onChange={(event) => setParam(field.key, event.currentTarget.value)}
          ></s-text-field>
        );
      })}
    </s-stack>
  );
}

function PageParamsField({
  label,
  help,
  actionName,
  persisted,
  onChange,
}: {
  label: string;
  help?: string;
  actionName: string;
  persisted: Record<string, unknown>;
  onChange: (rows: Array<{ key: string; value: string }>) => void;
}) {
  const [rows, setRows] = useState(() => pageParamsToRows(persisted));

  useEffect(() => {
    setRows(pageParamsToRows(persisted));
  }, [actionName]);

  const emitRows = (next: Array<{ key: string; value: string }>) => {
    setRows(next);
    onChange(next);
  };

  return (
    <s-stack direction="block" gap="small">
      <s-text>{label}</s-text>
      {help ? <s-text color="subdued">{help}</s-text> : null}
      {rows.map((row, index) => (
        <s-stack key={index} direction="inline" gap="small">
          <s-text-field
            label={index === 0 ? "Key" : ""}
            placeholder="Key (text or number)"
            value={row.key}
            onChange={(event) => {
              const next = rows.map((item, i) =>
                i === index ? { ...item, key: event.currentTarget.value } : item,
              );
              emitRows(next);
            }}
          ></s-text-field>
          <s-text-field
            label={index === 0 ? "Value" : ""}
            placeholder="Value (text or number)"
            value={row.value}
            onChange={(event) => {
              const next = rows.map((item, i) =>
                i === index ? { ...item, value: event.currentTarget.value } : item,
              );
              emitRows(next);
            }}
          ></s-text-field>
          <s-button
            variant="tertiary"
            onClick={() => {
              const next = rows.filter((_, i) => i !== index);
              emitRows(next.length ? next : [{ key: "", value: "" }]);
            }}
          >
            Remove
          </s-button>
        </s-stack>
      ))}
      <s-button variant="secondary" onClick={() => emitRows([...rows, { key: "", value: "" }])}>
        Add param
      </s-button>
    </s-stack>
  );
}
