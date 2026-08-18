import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { LokinWordmark } from "@/components/Brand";
import {
  Loader2,
  RefreshCw,
  Store,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import useShopifyAppBridge from "@/hooks/useShopifyAppBridge";
import ShopifyDraftOrders from "@/components/ShopifyDraftOrders";
import ShopifyCommerceIntelligence from "@/components/ShopifyCommerceIntelligence";

// LOKIN Commerce — Shopify embedded-app entry.
// Public route (no Base44 auth gate) so it renders inside the Shopify Admin iframe.
// Backed by the shopify-embed + shopify-oauth backend functions.

function readParams() {
  const sp = new URLSearchParams(window.location.search);
  const obj = {};
  for (const [k, v] of sp.entries()) obj[k] = v;
  return obj;
}

function money(v, cur = "USD") {
  const n = Number(v || 0);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

function badge(s = "") {
  const t = String(s || "unfulfilled").replaceAll("_", " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default function ShopifyEmbed() {
  const params = useMemo(() => readParams(), []);
  const shop = params.shop || "";
  const embedded = params.embedded === "1" || Boolean(params.host) || window.self !== window.top;
  const hasCode = Boolean(params.code);

  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shopInfo, setShopInfo] = useState(null);
  const [products, setProducts] = useState([]);
  const [oauthMsg, setOauthMsg] = useState("");
  const [clientId, setClientId] = useState("");
  const bridge = useShopifyAppBridge({
    apiKey: clientId,
    shop,
    host: params.host || "",
    embedded,
    enabled: !hasCode,
  });

  async function invokeShopify(action, extra = {}, requireSession = false) {
    let sessionToken = "";
    if (requireSession) {
      sessionToken = await bridge.getSessionToken();
      if (!sessionToken) throw new Error("Unable to establish a secure Shopify session. Reload LOKIN Commerce from Shopify Admin.");
    }
    const request = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
      },
      body: JSON.stringify({ action, ...extra, params, ...(sessionToken ? { session_token: sessionToken } : {}) }),
    };
    // Use Base44's function transport for public reads. For Shopify-sensitive
    // actions, prefer App Bridge authenticatedFetch so Shopify itself injects
    // the current short-lived session token on every request.
    // Always use Base44's function transport. The verified Shopify JWT is
    // carried in both Authorization and the JSON payload so it survives the
    // Base44 gateway consistently on mobile Shopify Admin. Calling the raw
    // /api/apps/... URL through authenticatedFetch can hit a different gateway
    // path and lose the payload/session pairing.
    const response = await base44.functions.fetch("/shopify-embed", request);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || `Shopify request failed (${response.status})`);
    return data;
  }

  // OAuth callback: exchange the code, then redirect into Shopify Admin.
  useEffect(() => {
    if (!hasCode) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const res = await base44.functions.invoke("shopify-oauth", { params });
        const data = res?.data || res;
        if (data?.redirect_url) {
          // Shopify may sandbox embedded frames. Prefer a top-level redirect
          // when allowed, but always fall back to the current frame so the
          // callback can complete instead of leaving a blank iframe.
          try {
            if (window.top && window.top !== window.self) window.top.location.assign(data.redirect_url);
            else window.location.assign(data.redirect_url);
          } catch {
            window.location.assign(data.redirect_url);
          }
          return;
        }
        if (!cancelled) setOauthMsg(data?.error || "OAuth completed but no redirect URL returned.");
      } catch (e) {
        if (!cancelled)
          setOauthMsg(e?.response?.data?.error || e?.data?.error || e?.message || "OAuth exchange failed.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasCode]);

  async function load() {
    setLoading(true);
    setError("");
    if (bridge.ready) bridge.setLoading(true);
    try {
      const [sd, hd] = await Promise.all([
        invokeShopify("storefront", { limit: 250 }),
        invokeShopify("health"),
      ]);
      if (sd?.error) setError(String(sd.error));
      setShopInfo(sd?.shop || null);
      setProducts(sd?.products || []);
      setHealth(hd);
      setClientId(hd?.client_id || "");
      if (bridge.ready) bridge.setTitleBar("LOKIN Commerce");
    } catch (e) {
      const msg = e?.response?.data?.error || e?.data?.error || e?.message || "Unable to load store";
      setError(msg);
      if (bridge.ready) bridge.toast(msg, true);
    } finally {
      setLoading(false);
      if (bridge.ready) bridge.setLoading(false);
    }
  }

  const [health, setHealth] = useState(null);
  useEffect(() => {
    if (!hasCode) load();
  }, [hasCode]);
  useEffect(() => {
    if (!bridge.ready || hasCode) return;
    bridge.setTitleBar("LOKIN Commerce");
    // Re-run after App Bridge initializes so authenticated requests carry a
    // fresh Shopify session token rather than relying on URL HMAC parameters.
    load();
  }, [bridge.ready, hasCode]);

  // While the OAuth code exchange is in flight.
  if (hasCode) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <LokinWordmark size={26} className="justify-center" />
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          <div className="text-sm text-white/60">{busy ? "Connecting your store…" : "Redirecting to Shopify Admin…"}</div>
          {oauthMsg && <div className="text-xs text-red-400 max-w-sm mx-auto">{oauthMsg}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <LokinWordmark size={26} />
          <button
            onClick={() => load()}
            disabled={loading}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-white/80 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Not-embedded prompt */}
        {!embedded && (
          <div className="rounded-2xl border border-primary/25 bg-primary/[0.05] p-4 text-sm text-white/75">
            <div className="font-bold text-primary mb-1">Open in Shopify Admin</div>
            <p className="text-xs text-white/55 mb-3">
              LOKIN Commerce runs inside Shopify. Open it from your admin to enable the full embedded experience and order intelligence.
            </p>
            <a
              href={shop ? `https://${shop}/admin` : "https://admin.shopify.com"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-bold text-black"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open Shopify Admin
            </a>
          </div>
        )}

        {/* Shop card */}
        {shopInfo && (
          <div className="rounded-3xl border border-white/10 lokin-panel p-5">
            <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-primary/70 font-display">
              <Store className="h-3.5 w-3.5" /> STORE
            </div>
            <div className="mt-1 text-xl font-bold font-heading text-white">{shopInfo.name || shop || "LOKIN Store"}</div>
            <div className="text-xs text-white/45">
              {shopInfo.domain || shop} · {shopInfo.country || ""} · {shopInfo.currency || "USD"}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-3 text-xs text-red-300 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <ShopifyCommerceIntelligence
              invokeShopify={invokeShopify}
              products={products}
              currency={shopInfo?.currency || "USD"}
              bridge={bridge}
              ready={bridge.ready}
            />

            {/* Draft orders */}
            {bridge.ready && (
              <ShopifyDraftOrders
                invokeShopify={invokeShopify}
                products={products}
                currency={shopInfo?.currency || "USD"}
                bridge={bridge}
                ready={bridge.ready}
              />
            )}

          </>
        )}

        <div className="text-center text-[10px] tracking-[0.2em] text-white/30 pt-2 pb-4">
          LOKIN COMMERCE · LOCK IN. LEVEL UP.
        </div>
      </div>
    </div>
  );
}