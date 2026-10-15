import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { handleOtaRequest } from "../lib/ota/handler.server";

// Public + bearer-authed /hot-updater/* API consumed by the mobile app
// (update-checks) and the deploy CLI (bundle upload). MANAGEMENT_TOKEN is
// required for CLI management + storage routes. The embedded dashboard uses
// /api/ota/* with authenticate.admin instead.
export const loader = ({ request }: LoaderFunctionArgs) => {
  return handleOtaRequest(request);
};

export const action = ({ request }: ActionFunctionArgs) => {
  return handleOtaRequest(request);
};
