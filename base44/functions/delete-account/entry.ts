import { createClientFromRequest } from "npm:@base44/sdk@0.8.43";

export default async function(req: Request) {
  try {
    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

    try {
      await base44.entities.AccountDeletionRequest.create({
        user_id: user.id,
        email: user.email || "",
        requested_at: new Date().toISOString(),
        status: "requested",
        details: "User requested in-app account deletion"
      });
    } catch (_) {}

    // Purge server-owned driver intelligence rows before deleting the built-in User record.
    // These rows are intentionally not user-deletable through normal RLS because they are audit records.
    try {
      const earningsDecisions = await base44.asServiceRole.entities.EarningsDecision.filter({ user_id: String(user.id) });
      await Promise.all(earningsDecisions.map((row: any) => base44.asServiceRole.entities.EarningsDecision.delete(row.id)));
    } catch (error) {
      console.warn("delete-account: EarningsDecision purge skipped", error);
    }

    // Service-role deletion removes the built-in User record itself, not merely local profile data.
    await base44.asServiceRole.entities.User.delete(user.id);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("delete-account failed", error);
    return Response.json({ error: "Account deletion could not be completed" }, { status: 500 });
  }
}
