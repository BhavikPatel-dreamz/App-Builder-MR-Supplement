import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { handleOtaRequest } from "../lib/ota/handler.server";

// Public + bearer-authed /hot-updater/* API consumed by the mobile app
// (update-checks), the deploy CLI (bundle upload), and the dashboard proxy.
export const loader = ({ request }: LoaderFunctionArgs) => {
  return handleOtaRequest(request);
};

export const action = ({ request }: ActionFunctionArgs) => {
  return handleOtaRequest(request);
};
