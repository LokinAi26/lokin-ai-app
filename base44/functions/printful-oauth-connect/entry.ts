import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { secrets } from "base44:runtime";
import { makeState, oauthConfigured } from "../../shared/printfulOAuth.ts";

/**
 * printful-oauth-connect — builds the Printful OAuth authorization URL for the
 * signed-in user. The frontend redirects the browser to the returned authorizeUrl;
 * after the user approves on Printful, they are sent back to PRINTFUL_OAUTH_REDIRECT_URI
 * (the /printful/callback route) with ?code=..&state=.. which the printful-oauth-callback
 * function exchanges for tokens.
 *
 * Secrets: PRINTFUL_OAUTH_CLIENT_ID, PRINTFUL_OAUTH_REDIRECT_URI
 */
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!oauthConfigured(secrets)) {
      return Response.json({ configured: false, error: "Printful OAuth is not fully configured. Set PRINTFUL_OAUTH_CLIENT_ID, PRINTFUL_OAUTH_CLIENT_SECRET, and PRINTFUL_OAUTH_REDIRECT_URI." }, { status: 503 });
    }

    const clientId = secrets.get("PRINTFUL_OAUTH_CLIENT_ID");
    const redirectUri = secrets.get("PRINTFUL_OAUTH_REDIRECT_URI");
    const state = await makeState(user.id, secrets.get("PRINTFUL_OAUTH_CLIENT_SECRET") || "lokin-printful-fallback");
    const authorizeUrl = `https://www.printful.com/oauth/authorize?client_id=${encodeURIComponent(clientId)}&state=${encodeURIComponent(state)}&redirect_url=${encodeURIComponent(redirectUri)}`;

    return Response.json({ configured: true, authorizeUrl, state });
  } catch (error) {
    console.error("printful-oauth-connect error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}