import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

const PUBLIC_STORE_URL = "https://mr-supplement-2.myshopify.com/";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  // Embedded / OAuth entry still goes into the app — do not send merchants to the storefront.
  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  throw redirect(PUBLIC_STORE_URL);
};
