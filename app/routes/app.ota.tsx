import type { LoaderFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";
import OtaDashboard from "../components/ota/OtaDashboard";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return {};
};

export default function AppOta() {
  return <OtaDashboard />;
}
