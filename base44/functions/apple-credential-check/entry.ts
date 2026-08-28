import { admitEcosystemOperation } from '../../shared/ecosystemAdmission.js';
// Apple App Store Connect credential validation.
// Reads APPLE_ISSUER_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY from app secrets,
// builds an ES256 JWT, and authenticates against the App Store Connect API.
// Returns ONLY a pass/fail + the failing component. Never returns, logs,
// echoes, or passes the secret values anywhere.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';

// ---- helpers (base64url + PEM normalization) ----
function b64urlStr(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlBuf(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Normalize whatever the secret contains (literal "\n", SEC1/PKCS1 header,
// extra whitespace, missing newlines) into a clean base64 body.
function normalizePemBody(raw) {
  let k = (raw || '').trim();
  k = k.replace(/\\n/g, '\n').replace(/\\r/g, '');
  k = k
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '');
  // Strip everything that isn't a valid base64 character (handles stray
  // whitespace, newlines, BOMs, or any other invisible chars the paste may
  // have introduced). Apple .p8 bodies are pure base64.
  const body = k.replace(/[^A-Za-z0-9+/=]/g, '');
  return body;
}

function pemBodyToDer(body) {
  // Pad to a multiple of 4 in case trailing '=' was stripped during paste.
  const padded = body + '='.repeat((4 - (body.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export default async function(req) {
  try {
    // Admin-only: credential validation must not run for unauthenticated users.
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ ok: false, component: 'AUTH', message: 'Not signed in' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ ok: false, component: 'AUTH', message: 'Admin only' }, { status: 403 });
    await admitEcosystemOperation(base44, { sourceApp:'LOKIN AI', domain:'provider', type:'provider_request', operation:'apple_credential_probe', priority:40, estimatedMs:5000, realtime:false, background:true, tags:['provider','scheduled'] });

    const issuerId = secrets.get('APPLE_ISSUER_ID');
    const keyId = secrets.get('APPLE_KEY_ID');
    const privateKeyRaw = secrets.get('APPLE_PRIVATE_KEY');

    // 1. Presence
    if (!issuerId) return Response.json({ ok: false, component: 'APPLE_ISSUER_ID', message: 'Secret is missing or empty.' });
    if (!keyId) return Response.json({ ok: false, component: 'APPLE_KEY_ID', message: 'Secret is missing or empty.' });
    if (!privateKeyRaw) return Response.json({ ok: false, component: 'APPLE_PRIVATE_KEY', message: 'Secret is missing or empty.' });

    // 2. PEM normalization (diagnostics reveal length/charset without the value)
    let pemBody;
    try {
      pemBody = normalizePemBody(privateKeyRaw);
      const rawLen = privateKeyRaw.length;
      const bodyLen = pemBody.length;
      const bodyIsBase64 = /^[A-Za-z0-9+/=]+$/.test(pemBody);
      if (!bodyIsBase64 || bodyLen < 100) {
        return Response.json({
          ok: false,
          component: 'APPLE_PRIVATE_KEY',
          message: 'PEM body did not decode to a valid key blob.',
          rawSecretLength: rawLen,
          bodyLength: bodyLen,
          bodyIsBase64,
          bodyHeadPrefix: pemBody.slice(0, 6)
        });
      }
    } catch (e) {
      return Response.json({ ok: false, component: 'APPLE_PRIVATE_KEY', message: 'Failed to parse PEM: ' + e.message });
    }

    // 3. Import + JWT generation (ES256)
    let jwt;
    try {
      const der = pemBodyToDer(pemBody);
      const cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        der,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
      );
      const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
      const now = Math.floor(Date.now() / 1000);
      const payload = { iss: issuerId, iat: now, exp: now + 1200, aud: 'appstoreconnect-v1' };
      const signingInput = `${b64urlStr(JSON.stringify(header))}.${b64urlStr(JSON.stringify(payload))}`;
      const sig = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        cryptoKey,
        new TextEncoder().encode(signingInput)
      );
      jwt = `${signingInput}.${b64urlBuf(sig)}`;
    } catch (e) {
      // Structural-only diagnostics: DER header bytes and length. Never the key value.
      const der = pemBodyToDer(pemBody);
      const headerHex = Array.from(der.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' ');
      return Response.json({
        ok: false,
        component: 'JWT_GENERATION',
        message: 'Key import or signing failed: ' + e.message,
        derLength: der.length,
        derHeaderHex: headerHex,
        bodyLength: pemBody.length
      });
    }

    // 4. Authenticate against App Store Connect API
    let ascStatus = 0;
    let ascBody = '';
    try {
      const res = await fetch('https://api.appstoreconnect.apple.com/v1/apps?limit=1', {
        headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' }
      });
      ascStatus = res.status;
      ascBody = await res.text();
    } catch (e) {
      return Response.json({ ok: false, component: 'NETWORK', message: 'App Store Connect request failed: ' + e.message });
    }

    if (ascStatus === 200) {
      return Response.json({ ok: true, component: 'NONE', message: 'APPLE CREDENTIALS: VALID — authenticated against App Store Connect.', appsEndpointStatus: 200 });
    }

    let reason = '';
    try {
      const j = JSON.parse(ascBody);
      const errs = j && j.errors && j.errors[0];
      if (errs) reason = (errs.title || errs.code || '') + (errs.detail ? ' — ' + errs.detail : '');
    } catch (_) {}
    if (!reason) reason = `HTTP ${ascStatus}`;

    if (ascStatus === 401) {
      return Response.json({ ok: false, component: 'APPLE_PRIVATE_KEY', message: 'App Store Connect rejected the signed JWT (401). Issuer/Key/secret mismatch or key revoked: ' + reason });
    }
    if (ascStatus === 403) {
      return Response.json({ ok: false, component: 'PERMISSIONS', message: 'Authenticated but the API key lacks App Manager / Admin scope (403): ' + reason });
    }
    return Response.json({ ok: false, component: 'APP_STORE_CONNECT', message: `Unexpected response ${ascStatus}: ${reason}` });
  } catch (error) {
    return Response.json({ ok: false, component: 'UNKNOWN', message: error.message }, { status: 500 });
  }
}