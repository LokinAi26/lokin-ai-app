// Base44 Payments checkout starter — base44/functions/create-checkout/entry.ts
//
// Provided by the platform. Do NOT rewrite the plumbing (session construct + persisting the
// join key + return-URL resolution). Edit only the region marked `// ===== APP-SPECIFIC =====`
// to resolve — SERVER-SIDE — what the buyer is purchasing and its price.
//
// PUBLIC by default: a buyer does NOT need to be logged in to check out. Backend function routes
// are callable anonymously, and storefront buyers often have no account — requiring login here is
// what blocks real purchases. If a buyer IS signed in we record their app-user id as the
// fulfillment target; otherwise the webhook grants by the buyer's email. Never 401 here.
//
// CRITICAL: Wix's checkout has NO custom-metadata field, so the returned `checkoutSession.id` is
// the ONLY thing that ties this payment back to this purchase. We persist it on a pending
// Base44Purchase BEFORE redirecting; the webhook resolves the purchase by that same id
// (order.checkoutId === checkoutSession.id). Skipping this write makes fulfillment impossible.

import { createClientFromRequest } from "npm:@base44/sdk@0.8.31";

const CONSTRUCT_URL = "https://www.wixapis.com/payments/platform/v1/checkout-sessions/construct";

// The app's public base URL for the buyer's return links. Use the platform-injected
// `X-Base44-App-Url` header (server-set from app state — correct behind custom domains), then the
// server-owned `WIX_CHECKOUT_APP_URL` secret. We do NOT fall back to the request `Origin`: it's
// caller-controlled, so a spoofed Origin would make Wix send the paid buyer to an attacker page
// (open redirect). Both sources above are always present for a connected payments app.
function resolveAppUrl(req: Request): string {
  return (
    req.headers.get("x-base44-app-url") ||
    Deno.env.get("WIX_CHECKOUT_APP_URL") ||
    ""
  );
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
    }
    // Read per request, never at module scope: disconnecting payments blanks these, and a warm
    // isolate that captured them at startup would keep charging with the old credentials.
    const WIX_API_KEY = Deno.env.get("WIX_CHECKOUT_API_KEY");
    const WIX_SITE_ID = Deno.env.get("WIX_CHECKOUT_SITE_ID");
    if (!WIX_API_KEY || !WIX_SITE_ID) {
      console.error("create-checkout: Wix payment config not set");
      return new Response(JSON.stringify({ error: "Payments not configured" }), { status: 500 });
    }

    const appUrl = resolveAppUrl(req);
    if (!appUrl) {
      // Fail closed: with no server-owned app URL (both the X-Base44-App-Url header AND the
      // WIX_CHECKOUT_APP_URL secret are absent — e.g. a slug-less or partially-wired app) we'd build
      // relative return links like `/ThankYou` and strand the paid buyer. Never fall back to the
      // caller-controlled Origin (open redirect). Reconnecting payments repopulates the secret.
      console.error("create-checkout: no app URL (X-Base44-App-Url header and WIX_CHECKOUT_APP_URL both empty)");
      return new Response(JSON.stringify({ error: "Payments not configured" }), { status: 500 });
    }
    const base44 = createClientFromRequest(req);

    // Capture the buyer's app-user id IF signed in — but never REQUIRE it. This is the
    // fulfillment target the webhook grants to; when absent (anonymous buyer) the webhook grants
    // by the email the buyer enters on Wix's checkout page.
    let appUser = null;
    try {
      appUser = await base44.auth.me();
    } catch (_) {
      appUser = null;
    }

    const body = await req.json().catch(() => ({}));

    // ===== APP-SPECIFIC =====
    // Resolve what is being bought AND its price SERVER-SIDE. NEVER trust a price sent by the
    // client — a buyer can tamper the request body and pay any amount. Two paths:
    //   1) Subscription plan: client sends only a productId; price resolved from the catalog below.
    //   2) Cannabis order: client sends a cannabisOrderId; we recompute the total from the stored
    //      CannabisOrder line items (asServiceRole, authoritative) and build a Wix cart from them.
    const cannabisOrderId = String(body.cannabisOrderId ?? "");
    let productId: string;
    let productName: string;
    let price: string;            // per-unit price (subscription path)
    let currency: string;
    let subscriptionInfo: any;
    let quantity: number;
    let thankYouPath: string;
    let postFlowPath: string;
    let cartItems: Array<{ name: string; quantity: number; price: string; subscriptionInfo?: any }>;

    if (cannabisOrderId) {
      // Cannabis order — authoritative price from the stored order. asServiceRole bypasses RLS so
      // an anonymous buyer's order can still be resolved and charged.
      const coRows = await base44.asServiceRole.entities.CannabisOrder.filter({ id: cannabisOrderId });
      const co = coRows?.[0];
      if (!co) return new Response(JSON.stringify({ error: "Order not found" }), { status: 404 });
      if (co.payment_status === "paid") return new Response(JSON.stringify({ error: "Order already paid" }), { status: 409 });
      if (!co.age_verified) return new Response(JSON.stringify({ error: "Age confirmation required" }), { status: 403 });

      // Regulated-commerce fail-closed gate. Cannabis checkout is disabled unless an admin has
      // explicitly enabled licensed sales, delivery, and payments for the order's delivery state.
      // This keeps the storefront usable as a demo/marketplace shell without accidentally turning
      // on regulated sales in an unapproved market or with an ineligible payment provider.
      const deliveryState = String(co.delivery_state || "").trim().toUpperCase();
      if (!deliveryState) return new Response(JSON.stringify({ error: "Delivery state required" }), { status: 400 });
      const marketRows = await base44.asServiceRole.entities.CannabisMarketConfig.filter({ state: deliveryState, enabled: true });
      const market = marketRows?.find((m: any) => m.licensed_sales_enabled && m.delivery_enabled && m.payments_enabled);
      if (!market) {
        return new Response(JSON.stringify({ error: "LOKIN Green checkout is not enabled for this market yet" }), { status: 403 });
      }

      const items: any[] = Array.isArray(co.items) ? co.items : [];
      if (!items.length) return new Response(JSON.stringify({ error: "Empty order" }), { status: 400 });
      cartItems = items.map((it: any) => ({
        name: String(it.name || "LOKIN Green item").slice(0, 255),
        quantity: Math.max(1, Math.min(100, Number(it.qty) || 1)),
        price: Number(it.price).toFixed(2),
      }));
      productId = "cannabis_order";
      productName = "LOKIN Green Order";
      price = "0";              // not used for cannabis; total derived from cartItems
      currency = "USD";
      subscriptionInfo = undefined;
      quantity = 1;
      thankYouPath = "/ThankYou";
      postFlowPath = "/stash";
    } else {
      // Subscription plan — client sends only a productId; price/tier resolved here.
      productId = String(body.productId ?? "");
      quantity = 1; // subscriptions are fixed-entitlement — ignore any client-sent quantity
      const PRODUCTS: Record<string, { name: string; price: string; tier: string; subscriptionInfo: any }> = {
        pro_monthly: {
          name: "LOKIN Pro — Monthly",
          price: "9.99",
          tier: "pro",
          subscriptionInfo: { subscriptionSettings: { frequency: "MONTH" }, title: "LOKIN Pro Monthly", description: "Advanced routing & deeper AI analytics" },
        },
        elite_monthly: {
          name: "LOKIN Elite — Monthly",
          price: "19.99",
          tier: "elite",
          subscriptionInfo: { subscriptionSettings: { frequency: "MONTH" }, title: "LOKIN Elite Monthly", description: "All Pro features + priority AI & elite routing" },
        },
        elite_annual: {
          name: "LOKIN Elite — Annual",
          price: "149.99",
          tier: "elite",
          subscriptionInfo: { subscriptionSettings: { frequency: "YEAR", freeTrialPeriod: { frequency: "DAY", interval: 14 } }, title: "LOKIN Elite Annual", description: "Yearly billing with a 14-day free trial" },
        },
      };
      const product = PRODUCTS[productId];
      if (!product) return new Response(JSON.stringify({ error: "Unknown plan" }), { status: 400 });
      productName = product.name;
      price = product.price;
      currency = "USD";
      subscriptionInfo = product.subscriptionInfo;
      thankYouPath = "/ThankYou";
      postFlowPath = "/pricing";
      cartItems = [{ name: productName, quantity, price, ...(subscriptionInfo ? { subscriptionInfo } : {}) }];
    }
    // ===== END APP-SPECIFIC =====

    const total = cannabisOrderId
      ? cartItems.reduce((s, it) => s + Number(it.price) * it.quantity, 0)
      : parseFloat(price) * quantity;
    if (!(total >= 0.5)) {
      // Wix rejects charges under 0.50 in the charged currency (major units, not cents).
      return new Response(JSON.stringify({ error: "Amount must be at least 0.50" }), { status: 400 });
    }

    const constructBody = {
      cart: {
        items: cartItems,
        // Prefill the signed-in buyer's email if we have one; anonymous buyers enter it on Wix.
        ...(appUser?.email ? { customerInfo: { email: appUser.email } } : {}),
      },
      callbackUrls: {
        thankYouPageUrl: `${appUrl}${thankYouPath}`,
        postFlowUrl: `${appUrl}${postFlowPath}`,
      },
    };

    const wixRes = await fetch(CONSTRUCT_URL, {
      method: "POST",
      headers: {
        "Authorization": WIX_API_KEY,
        "wix-site-id": WIX_SITE_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(constructBody),
    });

    if (!wixRes.ok) {
      const errText = await wixRes.text();
      console.error("create-checkout: Wix construct failed", { status: wixRes.status, errText });
      return new Response(JSON.stringify({ error: "Could not start checkout" }), { status: 502 });
    }

    const { checkoutSession } = await wixRes.json();
    const checkoutSessionId: string = checkoutSession?.id;
    const redirectUrl: string = checkoutSession?.redirectUrl;

    if (!checkoutSessionId || !redirectUrl) {
      console.error("create-checkout: missing checkoutSession id/redirectUrl", checkoutSession);
      return new Response(JSON.stringify({ error: "Could not start checkout" }), { status: 502 });
    }

    // PERSIST THE JOIN KEY (the whole point). Pending until the webhook flips it to "paid".
    // asServiceRole so the row is trustworthy — Base44Purchase RLS blocks client writes, so a buyer
    // can't forge a paid purchase. appUserId is the fulfillment target when known; null for an
    // anonymous buyer (the webhook then grants by buyerEmail).
    await base44.asServiceRole.entities.Base44Purchase.create({
      checkoutSessionId,
      status: "pending",
      appUserId: appUser?.id ?? null,
      buyerEmail: appUser?.email ?? null,
      // The server-resolved product key — the webhook grant reads this to decide what to unlock.
      productId,
      productName,
      // Persist the validated quantity so the webhook's grant can award the RIGHT count
      // (seats/credits/items) for a multi-unit purchase — the grant runs later from this row and has
      // no other authoritative count. (Fixed-entitlement plans keep quantity 1.)
      quantity,
      // Charged total (unit price × quantity), so the record matches what Wix charged.
      amount: total.toFixed(2),
      currency,
    });

    // ===== APP-SPECIFIC: link a cannabis order to this checkout session =====
    // The webhook resolves the CannabisOrder by checkout_session_id to mark it paid and spawn the
    // dispatch MerchantOrder. asServiceRole so an anonymous buyer's order can be linked.
    if (cannabisOrderId) {
      try {
        await base44.asServiceRole.entities.CannabisOrder.update(cannabisOrderId, {
          checkout_session_id: checkoutSessionId,
          payment_status: "awaiting_payment",
        });
      } catch (e) {
        console.error("create-checkout: cannabis order link failed", e);
      }
    }
    // ===== END APP-SPECIFIC =====

    return new Response(JSON.stringify({ redirectUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("create-checkout: unhandled error", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500 });
  }
});