import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";
import { getGmailSender, gmailSendMessage } from "../../shared/gmailSend.ts";

// partner-outreach — sends a one-time intro email to each print-on-demand /
// storefront partner so we have a documented contact line for faster issue
// resolution. Runs once (admin trigger). Sends through the connected Gmail
// connector so replies come back to the LOKIN inbox.

const PARTNERS = [
  { name: "Shopify", to: "partners@shopify.com", product: "Shopify" },
  { name: "Printify", to: "support@printify.com", product: "Printify" },
  { name: "Printful", to: "support@printful.com", product: "Printful" },
];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Admin only" }, { status: 403 });

    const { token, fromEmail } = await getGmailSender(base44);
    if (!token || !fromEmail) return Response.json({ error: "Gmail not connected" }, { status: 500 });

    const results = [];
    for (const p of PARTNERS) {
      const subject = `LOKIN AI · ${p.product} integration — opening a support line`;
      const body =
        `Hi ${p.name} team,\n\n` +
        `I'm the developer behind LOKIN AI, a gig-economy operating system for delivery drivers and travelers. ` +
        `We've integrated ${p.product} into our app for our storefront, catalog, and order flows, and I'd like to ` +
        `open a direct line of communication so we can resolve integration questions quickly and ship a smoother ` +
        `experience for our users.\n\n` +
        `Could you confirm the best contact for partner / API support, and anything you need from us to fast-track ` +
        `any issues that come up?\n\n` +
        `Thanks,\nLOKIN AI\n(from: ${fromEmail})`;
      try {
        await gmailSendMessage(token, fromEmail, p.to, `${p.name} Support`, subject, body);
        results.push({ partner: p.name, to: p.to, ok: true });
      } catch (e) {
        results.push({ partner: p.name, to: p.to, ok: false, error: e.message });
      }
    }

    const sent = results.filter((r) => r.ok).length;
    return Response.json({ sent, total: PARTNERS.length, results, sender: fromEmail });
  } catch (error) {
    console.error("partner-outreach error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}