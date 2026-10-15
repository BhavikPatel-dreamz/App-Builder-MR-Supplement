import {
  DEFAULT_PRODUCT_DETAILS_SETTINGS,
  type ProductDetailsSettings,
} from "../../lib/product-details-settings";

export function ProductDetailsEditor({
  value,
  onChange,
}: {
  value: ProductDetailsSettings;
  onChange: (next: ProductDetailsSettings) => void;
}) {
  const settings = value || DEFAULT_PRODUCT_DETAILS_SETTINGS;

  return (
    <s-section heading="Product details">
      <s-stack direction="block" gap="base">
        <s-paragraph>
          Product detail options for the native app. Saved on GET /cms/settings as
          productDetails.
        </s-paragraph>

        <s-box padding="base" border="base" borderRadius="base">
          <s-stack direction="block" gap="base">
            <s-text-field
              label="Available Payment Method"
              name="paymentMethod"
              placeholder="3"
              value={String(settings.paymentMethod)}
              onChange={(event) =>
                onChange({
                  ...settings,
                  paymentMethod: Math.max(
                    0,
                    Math.floor(Number(event.currentTarget.value) || 0),
                  ),
                })
              }
            ></s-text-field>
          </s-stack>
        </s-box>
      </s-stack>
    </s-section>
  );
}
