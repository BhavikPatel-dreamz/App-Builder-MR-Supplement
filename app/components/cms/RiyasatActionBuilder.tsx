// Local ActionBuilder — extends the kit with boolean dropdown fields.
import { useEffect, useState } from "gutenberg-block-kit/wp/element";
import {
  Button,
  ComboboxControl,
  Notice,
  SelectControl,
  TextareaControl,
  TextControl,
} from "gutenberg-block-kit/wp/components";
import {
  ACTION_NAMES,
  denormalizeAction,
  getDefaultActionForType,
  normalizeAction,
  useActionBuilderHost,
  useActionRegistry,
  validateAction,
} from "gutenberg-block-kit/actions-kit";

function isTruthyBoolean(value, defaultValue = true) {
  if (value === true) return true;
  if (value === false) return false;
  if (value === undefined || value === null || value === "") return defaultValue;
  return String(value).toLowerCase() !== "false";
}

function FieldLabel({ children }) {
  return <p className="gbk-action-builder__field-label">{children}</p>;
}

export function RiyasatActionBuilder({ label = "Action", value, onChange }) {
  const host = useActionBuilderHost();
  const registry = useActionRegistry();
  const [pages, setPages] = useState(host?.pages || []);
  const [loadingPages, setLoadingPages] = useState(false);
  const fallbackName = registry.list[0]?.name || ACTION_NAMES.OPEN_URL;
  const editorAction = denormalizeAction(
    value || getDefaultActionForType(fallbackName, registry),
    registry,
  );
  const { actionName, params = {} } = editorAction;
  const schema = registry.getSchema(actionName);
  const validation = validateAction(editorAction, registry);

  useEffect(() => {
    let cancelled = false;
    async function loadPages() {
      if (!host?.fetchPages) {
        setPages(host?.pages || []);
        return;
      }
      setLoadingPages(true);
      try {
        const result = await host.fetchPages();
        if (!cancelled) setPages(result || []);
      } catch {
        if (!cancelled) setPages(host?.pages || []);
      } finally {
        if (!cancelled) setLoadingPages(false);
      }
    }
    loadPages();
    return () => {
      cancelled = true;
    };
  }, [host]);

  const emit = (next) => {
    onChange(normalizeAction(denormalizeAction(next, registry), registry));
  };

  const handleActionTypeChange = (nextName) => {
    emit(getDefaultActionForType(nextName, registry));
  };

  const handleParamChange = (key, val) => {
    emit({
      actionName,
      params: {
        ...params,
        [key]: val,
      },
    });
  };

  const renderField = (field) => {
    const fieldValue = params[field.key] ?? "";

    if (field.type === "boolean") {
      const isTrue = isTruthyBoolean(params[field.key], true);
      return (
        <SelectControl
          key={field.key}
          label={field.label}
          help={field.help}
          value={isTrue ? "true" : "false"}
          options={[
            { label: "True", value: "true" },
            { label: "False", value: "false" },
          ]}
          onChange={(val) => handleParamChange(field.key, val === "true")}
        />
      );
    }

    if (field.type === "product-picker") {
      const title =
        params.productTitle || params.productHandle || params.productId;
      return (
        <div key={field.key} className="gbk-action-builder__picker">
          <FieldLabel>{field.label}</FieldLabel>
          {title ? (
            <p className="gbk-action-builder__picker-value">{title}</p>
          ) : (
            <p className="gbk-action-builder__picker-empty">No product selected</p>
          )}
          <Button
            variant="secondary"
            onClick={async () => {
              if (!host?.pickProduct) return;
              const picked = await host.pickProduct();
              if (!picked) return;
              emit({
                actionName,
                params: {
                  ...params,
                  productId: picked.productId,
                  productHandle: picked.productHandle || "",
                  productTitle: picked.productTitle || picked.title || "",
                },
              });
            }}
            disabled={!host?.pickProduct}
          >
            {host?.pickProduct ? "Select Product" : "Connect Shopify product picker"}
          </Button>
        </div>
      );
    }

    if (field.type === "collection-picker") {
      const title =
        params.collectionTitle || params.collectionHandle || params.collectionId;
      return (
        <div key={field.key} className="gbk-action-builder__picker">
          <FieldLabel>{field.label}</FieldLabel>
          {title ? (
            <p className="gbk-action-builder__picker-value">{title}</p>
          ) : (
            <p className="gbk-action-builder__picker-empty">No collection selected</p>
          )}
          <Button
            variant="secondary"
            onClick={async () => {
              if (!host?.pickCollection) return;
              const picked = await host.pickCollection();
              if (!picked) return;
              emit({
                actionName,
                params: {
                  ...params,
                  collectionId: picked.collectionId,
                  collectionHandle: picked.collectionHandle || "",
                  collectionTitle: picked.collectionTitle || picked.title || "",
                },
              });
            }}
            disabled={!host?.pickCollection}
          >
            {host?.pickCollection
              ? "Select Collection"
              : "Connect Shopify collection picker"}
          </Button>
        </div>
      );
    }

    if (field.type === "page-select") {
      const pageOptions = pages.map((page) => ({
        label: page.title || page.id,
        value: page.id,
      }));
      if (
        params[field.key] &&
        !pageOptions.some((option) => option.value === params[field.key])
      ) {
        pageOptions.unshift({
          label: params[field.key],
          value: params[field.key],
        });
      }
      return (
        <ComboboxControl
          key={field.key}
          label={field.label}
          help={
            field.help || "Pick a CMS page, or type a page ID if it is not listed."
          }
          placeholder={loadingPages ? "Loading pages…" : "Search pages…"}
          value={params[field.key] || ""}
          options={pageOptions}
          onChange={(val) => handleParamChange(field.key, val || "")}
          onFilterValueChange={(input) => {
            if (!pages.some((page) => page.id === input || page.title === input)) {
              handleParamChange(field.key, input);
            }
          }}
          allowReset
        />
      );
    }

    if (field.type === "page-params") {
      return (
        <TextControl
          key={field.key}
          label={field.label}
          help={field.help}
          value={params[field.key] || ""}
          onChange={(val) => handleParamChange(field.key, val)}
        />
      );
    }

    if (field.type === "textarea") {
      return (
        <TextareaControl
          key={field.key}
          label={field.label}
          value={fieldValue}
          onChange={(val) => handleParamChange(field.key, val)}
        />
      );
    }

    return (
      <TextControl
        key={field.key}
        label={field.label}
        type={field.type === "url" ? "url" : "text"}
        value={fieldValue}
        onChange={(val) => handleParamChange(field.key, val)}
        help={field.help}
        readOnly={field.readOnly}
      />
    );
  };

  return (
    <div className="gbk-action-builder">
      {label ? <FieldLabel>{label}</FieldLabel> : null}
      <SelectControl
        label="Action Type"
        value={actionName}
        options={registry.options}
        onChange={handleActionTypeChange}
      />
      {schema.fields.map(renderField)}
      {!validation.valid && validation.errors.length > 0 ? (
        <Notice status="warning" isDismissible={false}>
          {validation.errors.join(". ")}
        </Notice>
      ) : null}
    </div>
  );
}
