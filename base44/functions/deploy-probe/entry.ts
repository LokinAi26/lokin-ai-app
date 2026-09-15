import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { hasInternalJobKey } from "../../shared/internalJobKey.ts";

// Temporary deployment pipeline probe — deleted after diagnostics.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const body = await req.json().catch(() => ({}));
    const keyOk = await hasInternalJobKey(req, body);
    return Response.json({ probe: "deploy-probe", version: 3, hasUser: Boolean(user), keyOk });
  } catch (e) {
    return Response.json({ probe: "deploy-probe", version: 3, error: String(e).slice(0, 200) });
  }
}