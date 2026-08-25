import { createClientFromRequest } from "npm:@base44/sdk@0.8.43";

const ALLOWED_SCENARIOS = new Set([
  "tunnel_garage",
  "highway_parallel_road",
  "urban_canyon",
  "battery_profile",
  "offline_recovery",
  "background_screen_lock",
]);

function safeJson(value: unknown) {
  try { return JSON.stringify(value ?? {}); }
  catch { return "{}"; }
}

export default async function(req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.id) return Response.json({ error: "Authentication required" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const scenario = String(body?.scenario || "").trim();
    const platform = String(body?.platform || "unknown").trim().slice(0, 32);
    const result = String(body?.result || "").trim().toLowerCase();
    if (!ALLOWED_SCENARIOS.has(scenario)) {
      return Response.json({ error: "Unsupported calibration scenario" }, { status: 400 });
    }
    if (!["pass", "fail", "incomplete"].includes(result)) {
      return Response.json({ error: "result must be pass, fail, or incomplete" }, { status: 400 });
    }

    const metricsJson = safeJson(body?.metrics);
    if (metricsJson.length > 60_000) {
      return Response.json({ error: "Calibration metrics payload is too large" }, { status: 413 });
    }

    const created = await base44.entities.NavigationCalibrationRun.create({
      scenario,
      platform,
      result,
      metrics_json: metricsJson,
      build_id: String(body?.build_id || "").slice(0, 120),
    });

    return Response.json({ ok: true, id: created?.id || null, scenario, result });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Calibration report failed" }, { status: 500 });
  }
}
