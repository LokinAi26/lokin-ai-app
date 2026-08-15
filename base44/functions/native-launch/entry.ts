import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// LOKIN AI — Native launcher (Siri Shortcut / Google Assistant App Action)
// Input: { target?: "route"|"lokin"|"earnings"|"home" }
// Returns the deep-link URL, custom scheme, and exact voice phrases an AI
// client (ChatGPT, Claude) can hand to the driver so the Siri / Assistant
// integration is genuinely callable on a device with the LOKIN native app.
// Read-only and idempotent; no user data read, no auth gate (the tool is
// safe to call pre-consent — it only returns launch metadata).
export default async function(req) {
  try {
    // createClientFromRequest is required by the platform runtime.
    void createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const VALID = ["route", "lokin", "earnings", "home"];
    const target = VALID.includes(body.target) ? body.target : "route";

    const appUrl =
      (req.headers.get("X-Base44-App-Url") || "").replace(/\/$/, "") ||
      new URL(req.url).origin;

    const pathMap = { route: "/route", lokin: "/lokin", earnings: "/earnings", home: "/" };
    const path = pathMap[target];

    const siri = {
      route: { phrase: "Optimize my LOKIN route", intent: "LokinRouteIntent" },
      lokin: { phrase: "Ask LOKIN", intent: "LokinAssistantIntent" },
      earnings: { phrase: "Show my LOKIN earnings", intent: "LokinEarningsIntent" },
      home: { phrase: "Open LOKIN", intent: "LokinRouteIntent" },
    };
    const assistantPhrase = {
      route: "optimize my LOKIN route",
      lokin: "ask LOKIN",
      earnings: "show my LOKIN earnings",
      home: "open LOKIN",
    };

    return Response.json({
      target,
      deepLink: `${appUrl}${path}?action=${target}&via=assistant`,
      customScheme: `lokin://${target}`,
      siri: {
        phrase: siri[target].phrase,
        intent: siri[target].intent,
        appShortcut: "Shortcuts app → LOKIN AI",
      },
      googleAssistant: {
        phrase: `Hey Google, ${assistantPhrase[target]}`,
        intent: "actions.intent.OPEN_APP_FEATURE",
      },
      nativeFiles: {
        ios: "native/ios/LokinIntents.swift",
        android: "native/android/actions.xml",
      },
      message:
        `LOKIN ${target} is one tap or voice phrase away. Open the deep link now, ` +
        `or on a device with the LOKIN native app installed say "${siri[target].phrase}" ` +
        `(Siri) or "Hey Google, ${assistantPhrase[target]}" (Google Assistant).`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}