import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { serveProductReviews } from "../lib/reviews-public.server";

/**
 * Public product reviews for the native app.
 *
 *   GET https://appbuilder.dreamzapps.com/reviews/get?product_id=PRODUCT_ID
 *
 * Redis L1/L2 + Cache-Control for Cloudflare GET.
 * Without ?page= the body matches the old get_reviews.php shape (every review).
 * With ?page=1 the same cached list is returned 20 reviews at a time.
 */
export const loader = ({ request }: LoaderFunctionArgs) => serveProductReviews(request);
export const action = ({ request }: ActionFunctionArgs) => serveProductReviews(request);
