import { hasInternalJobKey } from "../../shared/internalJobKey.ts";

// Temporary deployment pipeline probe — deleted after diagnostics.
export default async function(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const keyOk = await hasInternalJobKey(req, body);
    return Response.json({ probe: "deploy-probe", version: 1, keyOk });
  } catch (e) {
    return Response.json({ probe: "deploy-probe", version: 1, error: String(e).slice(0, 200) });
  }
}