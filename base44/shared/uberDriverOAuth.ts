export const UBER_PROVIDER_KEY = "uber_eats";
export const UBER_DRIVER_SCOPES = Object.freeze(["partner.accounts", "partner.trips", "partner.payments"]);
export const UBER_AUTHORIZE_URL = "https://auth.uber.com/oauth/v2/authorize";
export const UBER_TOKEN_URL = "https://auth.uber.com/oauth/v2/token";
export const UBER_API_BASE = "https://api.uber.com/v1";

function text(value: unknown, max = 10000) {
  return String(value || "").trim().slice(0, max);
}

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmac(message: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message))));
}

async function aesKey(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export function uberOAuthConfigured(secrets: any) {
  return Boolean(
    text(secrets.get("UBER_DRIVER_CLIENT_ID")) &&
    text(secrets.get("UBER_DRIVER_CLIENT_SECRET")) &&
    text(secrets.get("UBER_DRIVER_REDIRECT_URI")) &&
    text(secrets.get("LOKIN_OAUTH_TOKEN_ENCRYPTION_KEY")),
  );
}

export function uberOAuthMissingSecrets(secrets: any) {
  return [
    "UBER_DRIVER_CLIENT_ID",
    "UBER_DRIVER_CLIENT_SECRET",
    "UBER_DRIVER_REDIRECT_URI",
    "LOKIN_OAUTH_TOKEN_ENCRYPTION_KEY",
  ].filter((name) => !text(secrets.get(name)));
}

export async function makeUberState(userId: string, clientSecret: string) {
  const exp = Math.floor(Date.now() / 1000) + 10 * 60;
  const nonce = crypto.randomUUID();
  const payload = `${String(userId)}.${exp}.${nonce}`;
  return `${payload}.${await hmac(payload, clientSecret)}`;
}

export async function verifyUberState(state: string, userId: string, clientSecret: string) {
  const parts = String(state || "").split(".");
  if (parts.length !== 4) return false;
  const [uid, exp, nonce, sig] = parts;
  if (uid !== String(userId)) return false;
  if (!Number.isFinite(Number(exp)) || Number(exp) < Math.floor(Date.now() / 1000)) return false;
  const expected = await hmac(`${uid}.${exp}.${nonce}`, clientSecret);
  return expected === sig;
}

export function buildUberAuthorizeUrl(secrets: any, state: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: text(secrets.get("UBER_DRIVER_CLIENT_ID")),
    redirect_uri: text(secrets.get("UBER_DRIVER_REDIRECT_URI")),
    scope: UBER_DRIVER_SCOPES.join(" "),
    state,
  });
  return `${UBER_AUTHORIZE_URL}?${params.toString()}`;
}

export async function encryptUberTokenBundle(bundle: Record<string, unknown>, encryptionSecret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await aesKey(encryptionSecret);
  const plaintext = new TextEncoder().encode(JSON.stringify(bundle));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return { token_ciphertext: base64Url(new Uint8Array(ciphertext)), token_iv: base64Url(iv) };
}

export async function decryptUberTokenBundle(ciphertext: string, iv: string, encryptionSecret: string) {
  const key = await aesKey(encryptionSecret);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64Url(iv) },
    key,
    fromBase64Url(ciphertext),
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

export async function getUberCredential(base44: any, userId: string) {
  const rows = await base44.asServiceRole.entities.DriverOAuthCredential.filter({
    user_id: String(userId),
    provider: UBER_PROVIDER_KEY,
  });
  return rows?.[0] || null;
}

async function saveTokenBundle(base44: any, userId: string, credential: any, tokenData: any, secrets: any, existingBundle: any = null) {
  const expiresIn = Math.max(60, Number(tokenData.expires_in || 0));
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const bundle = {
    access_token: text(tokenData.access_token),
    refresh_token: text(tokenData.refresh_token) || text(existingBundle?.refresh_token),
    token_type: text(tokenData.token_type) || "Bearer",
    scope: text(tokenData.scope) || text(existingBundle?.scope),
  };
  if (!bundle.access_token || !bundle.refresh_token) throw new Error("Uber did not return a usable OAuth token bundle");
  const encrypted = await encryptUberTokenBundle(bundle, text(secrets.get("LOKIN_OAUTH_TOKEN_ENCRYPTION_KEY")));
  const scopes = String(bundle.scope || UBER_DRIVER_SCOPES.join(" ")).split(/[ ,]+/).filter(Boolean);
  const values = {
    user_id: String(userId),
    provider: UBER_PROVIDER_KEY,
    ...encrypted,
    expires_at: expiresAt,
    scopes,
    status: "connected",
    connected_at: credential?.connected_at || new Date().toISOString(),
    last_refreshed_at: new Date().toISOString(),
    last_error: "",
  };
  if (credential) return await base44.asServiceRole.entities.DriverOAuthCredential.update(credential.id, values);
  return await base44.asServiceRole.entities.DriverOAuthCredential.create(values);
}

export async function storeUberAuthorization(base44: any, userId: string, tokenData: any, secrets: any) {
  const credential = await getUberCredential(base44, userId);
  return await saveTokenBundle(base44, userId, credential, tokenData, secrets, null);
}

export async function exchangeUberAuthorizationCode(code: string, secrets: any) {
  const body = new URLSearchParams({
    client_id: text(secrets.get("UBER_DRIVER_CLIENT_ID")),
    client_secret: text(secrets.get("UBER_DRIVER_CLIENT_SECRET")),
    grant_type: "authorization_code",
    redirect_uri: text(secrets.get("UBER_DRIVER_REDIRECT_URI")),
    code: text(code),
  });
  const response = await fetch(UBER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error_description || data?.message || data?.error || `Uber token exchange failed (${response.status})`);
  return data;
}

async function refreshUberToken(base44: any, userId: string, credential: any, bundle: any, secrets: any) {
  const body = new URLSearchParams({
    client_id: text(secrets.get("UBER_DRIVER_CLIENT_ID")),
    client_secret: text(secrets.get("UBER_DRIVER_CLIENT_SECRET")),
    grant_type: "refresh_token",
    refresh_token: text(bundle.refresh_token),
  });
  const response = await fetch(UBER_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    await base44.asServiceRole.entities.DriverOAuthCredential.update(credential.id, {
      status: response.status === 401 ? "expired" : "error",
      last_error: text(data?.error_description || data?.message || data?.error || `Refresh failed (${response.status})`, 500),
    });
    throw new Error(data?.error_description || data?.message || data?.error || `Uber refresh failed (${response.status})`);
  }
  const saved = await saveTokenBundle(base44, userId, credential, data, secrets, bundle);
  return {
    credential: saved,
    bundle: {
      access_token: text(data.access_token),
      refresh_token: text(data.refresh_token) || text(bundle.refresh_token),
      token_type: text(data.token_type) || text(bundle.token_type) || "Bearer",
      scope: text(data.scope) || text(bundle.scope),
    },
  };
}

export async function getValidUberAccessToken(base44: any, userId: string, secrets: any) {
  if (!uberOAuthConfigured(secrets)) throw new Error(`Uber OAuth is not configured: ${uberOAuthMissingSecrets(secrets).join(", ")}`);
  let credential = await getUberCredential(base44, userId);
  if (!credential) throw new Error("Uber is not authorized for this driver");
  let bundle = await decryptUberTokenBundle(
    credential.token_ciphertext,
    credential.token_iv,
    text(secrets.get("LOKIN_OAUTH_TOKEN_ENCRYPTION_KEY")),
  );
  const expiresAt = Date.parse(String(credential.expires_at || ""));
  if (!Number.isFinite(expiresAt) || expiresAt - Date.now() < 5 * 60 * 1000) {
    const refreshed = await refreshUberToken(base44, userId, credential, bundle, secrets);
    credential = refreshed.credential;
    bundle = refreshed.bundle;
  }
  return { accessToken: text(bundle.access_token), credential, bundle };
}
