import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { serveProductReviews } from "../lib/reviews-public.server";

/**
 * Public product reviews for the native app.
 *
 *   GET https://appbuilder.dreamzapps.com/reviews/get?product_id=PRODUCT_ID
 *
 * Redis L1/L2 + Cache-Control for Cloudflare GET.
 * Optional: ?shop=example.myshopify.com  ?page=1  ?cache=default|bypass|refresh
 * 20 reviews per page. The full list stays in one cache entry per product.
 */
export const loader = ({ request }: LoaderFunctionArgs) => serveProductReviews(request);
export const action = ({ request }: ActionFunctionArgs) => serveProductReviews(request);
