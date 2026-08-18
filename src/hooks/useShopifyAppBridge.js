import { useEffect, useRef, useState } from "react";

// Shopify App Bridge integration for the embedded experience.
// Initializes only when genuinely embedded (inside the Shopify Admin iframe),
// exposing TitleBar, Loading, Toast and Redirect actions. Outside the iframe
// it stays a no-op so the standalone preview still works.
let appBridge = null;

export default function useShopifyAppBridge({ apiKey, shop, host, embedded, enabled }) {
  const [ready, setReady] = useState(false);
  const actionsRef = useRef(null);
  const titleBarRef = useRef(null);
  const loadingRef = useRef(null);

  useEffect(() => {
    if (!enabled || !embedded || !apiKey || (!host && !shop) || ready) return;
    let cancelled = false;
    (async () => {
      try {
        const mod = await import("@shopify/app-bridge");
        const actions = await import("@shopify/app-bridge/actions");
        if (cancelled) return;
        const createApp = mod.createApp || mod.default?.createApp || mod.default;
        if (typeof createApp !== "function") throw new Error("Shopify App Bridge createApp export is unavailable");
        // Shopify's mobile Admin app can omit `shop` while still providing the
        // signed `host`. App Bridge only needs apiKey + host for embedded auth;
        // don't block initialization on a redundant shop query parameter.
        appBridge = createApp({ apiKey, ...(shop ? { shop } : {}), host: host || undefined, forceRedirect: false });
        actionsRef.current = actions;
        setReady(true);
      } catch (e) {
        console.warn("Shopify App Bridge init failed:", e?.message || e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, embedded, apiKey, shop, host, ready]);

  function setTitleBar(title) {
    if (!appBridge || !actionsRef.current) return;
    try {
      const { TitleBar } = actionsRef.current;
      if (!titleBarRef.current) titleBarRef.current = TitleBar.create(appBridge, { title });
      else titleBarRef.current.dispatch(TitleBar.Action.UPDATE, { title });
    } catch {
      /* no-op */
    }
  }

  function setLoading(on) {
    if (!appBridge || !actionsRef.current) return;
    try {
      const { Loading } = actionsRef.current;
      if (!loadingRef.current) loadingRef.current = Loading.create(appBridge);
      loadingRef.current.dispatch(on ? Loading.Action.START : Loading.Action.STOP);
    } catch {
      /* no-op */
    }
  }

  function toast(message, isError = false) {
    if (!appBridge || !actionsRef.current) return;
    try {
      const { Toast } = actionsRef.current;
      Toast.create(appBridge, { content: String(message), duration: 3500, isError });
    } catch {
      /* no-op */
    }
  }

  async function getSessionToken() {
    if (!appBridge || !ready) return "";
    try {
      // App Bridge v3 exposes authenticatedFetch as the supported way to attach
      // Shopify session tokens. Keep getSessionToken as the primary path, but
      // normalize the result because some builds return a token-like object.
      const utilities = await import("@shopify/app-bridge/utilities");
      const raw = await utilities.getSessionToken(appBridge);
      if (typeof raw === "string") return raw;
      return raw?.token || raw?.id_token || raw?.accessToken || "";
    } catch (e) {
      console.warn("Shopify session token request failed:", e?.message || e);
      return "";
    }
  }

  async function authenticatedFetch(url, init = {}) {
    if (!appBridge || !ready) return fetch(url, init);
    try {
      const utilities = await import("@shopify/app-bridge/utilities");
      if (typeof utilities.authenticatedFetch === "function") {
        return utilities.authenticatedFetch(appBridge)(url, init);
      }
    } catch (e) {
      console.warn("Shopify authenticatedFetch unavailable:", e?.message || e);
    }
    const token = await getSessionToken();
    return fetch(url, {
      ...init,
      headers: { ...(init.headers || {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  }

  function redirectRemote(url) {
    if (!appBridge || !actionsRef.current) {
      window.open(url, "_blank", "noopener");
      return;
    }
    try {
      const { Redirect } = actionsRef.current;
      const redirect = Redirect.create(appBridge);
      redirect.dispatch(Redirect.Action.REMOTE, url);
    } catch {
      window.open(url, "_blank", "noopener");
    }
  }

  return { ready, setTitleBar, setLoading, toast, redirectRemote, getSessionToken, authenticatedFetch };
}