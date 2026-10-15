import { useCallback } from "react";

import {
  DEFAULT_CART_SETTINGS,
  type CartHandyItem,
  type CartSettings,
} from "../../lib/cart-settings";
import { hasProductRef } from "../../lib/settings-resources";

async function pickProducts(
  current: CartHandyItem[],
): Promise<CartHandyItem[] | null> {
  const picker =
    typeof window !== "undefined" ? window.shopify?.resourcePicker : null;
  if (!picker) return null;

  const selection = await picker({
    type: "product",
    multiple: true,
    selectionIds: current
      .filter((item) => item.productId)
      .map((item) => ({ id: item.productId })),
  });

  if (!selection) return null;

  const picked: CartHandyItem[] = [];
  for (const product of selection) {
    if (!product?.id) continue;
    const productId = String(product.id);
    if (picked.some((item) => item.productId === productId)) continue;
    picked.push({
      productId,
      handle: product.handle ? String(product.handle) : "",
      title: product.title ? String(product.title) : "",
    });
  }
  return picked;
}

export function CartOptionsEditor({
  value,
  onChange,
}: {
  value: CartSettings;
  onChange: (next: CartSettings) => void;
}) {
  const settings = value || DEFAULT_CART_SETTINGS;
  const progressbar = settings.cartFreeShippingProgressbar;
  const handyItems = settings.cartHandyItems;

  const setProgressbar = useCallback(
    (patch: Partial<CartSettings["cartFreeShippingProgressbar"]>) => {
      onChange({
        ...settings,
        cartFreeShippingProgressbar: { ...progressbar, ...patch },
      });
    },
    [onChange, progressbar, settings],
  );

  const setHandyItems = useCallback(
    (patch: Partial<CartSettings["cartHandyItems"]>) => {
      onChange({
        ...settings,
        cartHandyItems: { ...handyItems, ...patch },
      });
    },
    [handyItems, onChange, settings],
  );

  return (
    <s-section heading="Cart options">
      <s-stack direction="block" gap="base">
        <s-paragraph>
          Cart options for the native app. Saved on GET /cms/settings as cart.
        </s-paragraph>

        <s-box padding="base" border="base" borderRadius="base">
          <s-stack direction="block" gap="base">
            <s-heading>Cart Free Shipping Progressbar</s-heading>

            <s-text-field
              label="Price"
              name="cartFreeShippingPrice"
              placeholder="100"
              value={String(progressbar.price)}
              onChange={(event) =>
                setProgressbar({
                  price: Math.max(0, Number(event.currentTarget.value) || 0),
                })
              }
            ></s-text-field>

            <s-checkbox
              label="Enable"
              name="cartFreeShippingEnable"
              checked={progressbar.enable}
              onChange={(event) =>
                setProgressbar({ enable: event.currentTarget.checked })
              }
            ></s-checkbox>
          </s-stack>
        </s-box>

        <s-box padding="base" border="base" borderRadius="base">
          <s-stack direction="block" gap="base">
            <s-heading>Cart Handy Items</s-heading>

            <s-text-field
              label="Title"
              name="cartHandyItemsTitle"
              placeholder="HandyLastMinuteItems"
              value={handyItems.title}
              onChange={(event) =>
                setHandyItems({ title: event.currentTarget.value })
              }
            ></s-text-field>

            <s-checkbox
              label="Enable"
              name="cartHandyItemsEnable"
              checked={handyItems.enable}
              onChange={(event) =>
                setHandyItems({ enable: event.currentTarget.checked })
              }
            ></s-checkbox>

            <s-stack direction="block" gap="small">
              <s-text color="subdued">Products</s-text>
              {handyItems.items.length ? (
                handyItems.items.map((item) => (
                  <s-box
                    key={item.productId}
                    padding="base"
                    border="base"
                    borderRadius="base"
                  >
                    <s-stack
                      direction="inline"
                      gap="small"
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <s-stack direction="block" gap="small">
                        <s-text>
                          <strong>
                            {item.title ||
                              (hasProductRef(item)
                                ? "Selected product"
                                : "Untitled product")}
                          </strong>
                        </s-text>
                        {item.handle ? (
                          <s-text color="subdued">{item.handle}</s-text>
                        ) : (
                          <s-text color="subdued">{item.productId}</s-text>
                        )}
                      </s-stack>
                      <s-button
                        variant="tertiary"
                        tone="critical"
                        onClick={() =>
                          setHandyItems({
                            items: handyItems.items.filter(
                              (current) => current.productId !== item.productId,
                            ),
                          })
                        }
                      >
                        Remove
                      </s-button>
                    </s-stack>
                  </s-box>
                ))
              ) : (
                <s-text color="subdued">No products selected.</s-text>
              )}
              <s-stack direction="inline" gap="small" alignItems="center">
                <s-button
                  variant="secondary"
                  onClick={async () => {
                    const picked = await pickProducts(handyItems.items);
                    if (picked) setHandyItems({ items: picked });
                  }}
                >
                  {handyItems.items.length
                    ? "Change products"
                    : "Select products"}
                </s-button>
                {handyItems.items.length ? (
                  <s-button
                    variant="tertiary"
                    onClick={() => setHandyItems({ items: [] })}
                  >
                    Clear
                  </s-button>
                ) : null}
              </s-stack>
            </s-stack>
          </s-stack>
        </s-box>
      </s-stack>
    </s-section>
  );
}
