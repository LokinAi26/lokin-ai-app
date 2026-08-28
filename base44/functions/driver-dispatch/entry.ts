import { invokeLLMWithAdmission } from '../../shared/ecosystemAdmission.js';
import { createClientFromRequest } from "npm:@base44/sdk@0.8.40";

const FREIGHT_SOURCES = new Set(["manual", "official_api", "carrier_feed", "broker_feed"]);
const TERMINAL_ASSIGNMENT_STATUSES = new Set(["delivered", "canceled"]);
const TERMINAL_LOAD_STATUSES = new Set(["delivered", "canceled", "rejected"]);
const MAX_HOS = Object.freeze({ drive: 660, shift: 840, cycle: 4200, break: 480 });

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round((Number(value) || 0) * factor) / factor;
}

function nowIso() {
  return new Date().toISOString();
}

function cleanText(value, max = 300) {
  return String(value || "").trim().slice(0, max);
}

function isFreshHos(hos) {
  const ts = Date.parse(String(hos?.last_synced_at || ""));
  return Number.isFinite(ts) && Date.now() - ts <= 6 * 60 * 60 * 1000;
}

function equipmentMatches(load, vehicle, profile) {
  const required = String(load?.equipment_type || "other");
  const vehicleEquipment = String(vehicle?.equipment_type || "");
  const preferred = new Set(profile?.preferred_equipment || []);
  if (required === "other") return true;
  if (vehicleEquipment) return vehicleEquipment === required;
  if (preferred.size) return preferred.has(required);
  return true;
}

function hazmatEligible(load, vehicle, profile) {
  if (!load?.hazmat) return true;
  const endorsements = new Set((profile?.endorsements || []).map((v) => String(v).toUpperCase()));
  return Boolean(vehicle?.hazmat_capable) && (endorsements.has("H") || endorsements.has("X") || endorsements.has("HAZMAT"));
}

function payloadEligible(load, vehicle) {
  const loadWeight = Number(load?.weight_lbs || 0);
  const maxPayload = Number(vehicle?.max_payload_lbs || 0);
  if (!loadWeight || !maxPayload) return true;
  return loadWeight <= maxPayload;
}

function evaluateFreightLoad(load, profile = {}, vehicle = null, hos = null) {
  const loadedMiles = Math.max(0, Number(load?.loaded_miles || 0));
  const deadheadMiles = Math.max(0, Number(load?.deadhead_miles || 0));
  const totalMiles = loadedMiles + deadheadMiles;
  const totalRate = Math.max(0, Number(load?.total_rate || 0));
  const operatingCostPerMile = Math.max(0, Number(profile?.operating_cost_per_mile || 1.15));
  const minRpm = Math.max(0.25, Number(profile?.min_rate_per_mile || 2));
  const minLoadRate = Math.max(0, Number(profile?.min_load_rate || 500));
  const targetNetPerHour = Math.max(1, Number(profile?.target_net_per_hour || 45));
  const maxDeadhead = Math.max(1, Number(profile?.max_deadhead_miles || 75));
  const ratePerMile = totalMiles > 0 ? totalRate / totalMiles : 0;
  const operatingCost = totalMiles * operatingCostPerMile;
  const expectedNet = totalRate - operatingCost;
  const estimatedDriveMinutes = Math.ceil((totalMiles / 50) * 60);
  const breakNeeded = hos && Number(hos.break_due_in_minutes) >= 0 && Number(hos.break_due_in_minutes) < estimatedDriveMinutes;
  const estimatedServiceMinutes = 120 + (breakNeeded ? 30 : 0);
  const estimatedTotalMinutes = Math.max(1, estimatedDriveMinutes + estimatedServiceMinutes);
  const netPerHour = expectedNet / (estimatedTotalMinutes / 60);
  const hosFresh = isFreshHos(hos);
  const hosFeasible = Boolean(
    hosFresh &&
    Number(hos?.drive_minutes_remaining || 0) >= estimatedDriveMinutes &&
    Number(hos?.shift_minutes_remaining || 0) >= estimatedTotalMinutes &&
    Number(hos?.cycle_minutes_remaining || 0) >= estimatedTotalMinutes
  );
  const equipmentOk = equipmentMatches(load, vehicle, profile);
  const hazmatOk = hazmatEligible(load, vehicle, profile);
  const payloadOk = payloadEligible(load, vehicle);
  const deadheadOk = deadheadMiles <= maxDeadhead;
  const hardBlocks = [];
  if (!hos) hardBlocks.push("HOS_REQUIRED");
  else if (!hosFresh) hardBlocks.push("HOS_STALE");
  else if (!hosFeasible) hardBlocks.push("HOS_INSUFFICIENT");
  if (!equipmentOk) hardBlocks.push("EQUIPMENT_MISMATCH");
  if (!hazmatOk) hardBlocks.push("HAZMAT_NOT_ELIGIBLE");
  if (!payloadOk) hardBlocks.push("PAYLOAD_EXCEEDED");
  if (!deadheadOk) hardBlocks.push("DEADHEAD_LIMIT");
  if (!loadedMiles || !totalRate) hardBlocks.push("INVALID_LOAD_ECONOMICS");

  const rpmScore = clamp((ratePerMile / minRpm) * 70, 0, 100);
  const netHourScore = clamp((netPerHour / targetNetPerHour) * 70, 0, 100);
  const deadheadScore = clamp(100 - (deadheadMiles / maxDeadhead) * 70, 0, 100);
  const sourceScore = load?.verification_status === "rate_verified" ? 100 : load?.verification_status === "source_verified" ? 88 : load?.source_type === "manual" ? 62 : 72;
  const fitScore = equipmentOk && hazmatOk && payloadOk ? 100 : 0;
  const hosScore = hosFeasible ? 100 : 0;
  const score = Math.round(clamp(
    rpmScore * 0.26 + netHourScore * 0.24 + deadheadScore * 0.12 + sourceScore * 0.10 + fitScore * 0.13 + hosScore * 0.15,
    0,
    100,
  ));

  const preferenceMisses = [];
  if (ratePerMile < minRpm) preferenceMisses.push("BELOW_RATE_PER_MILE_TARGET");
  if (totalRate < minLoadRate) preferenceMisses.push("BELOW_MIN_LOAD_RATE");
  if (netPerHour < targetNetPerHour) preferenceMisses.push("BELOW_NET_HOURLY_TARGET");

  let action = "CONSIDER";
  if (hardBlocks.length) action = "PASS";
  else if (!preferenceMisses.length && score >= 78) action = "TAKE";

  return {
    load_id: String(load?.id || ""),
    action,
    score,
    hard_blocks: hardBlocks,
    preference_misses: preferenceMisses,
    economics: {
      total_rate: round(totalRate),
      loaded_miles: round(loadedMiles, 1),
      deadhead_miles: round(deadheadMiles, 1),
      total_miles: round(totalMiles, 1),
      rate_per_mile: round(ratePerMile),
      operating_cost: round(operatingCost),
      expected_net: round(expectedNet),
      expected_net_per_hour: round(netPerHour),
    },
    hos: {
      present: Boolean(hos),
      fresh: hosFresh,
      feasible: hosFeasible,
      source: hos?.source || null,
      advisory_only: hos?.advisory_only !== false,
      estimated_drive_minutes: estimatedDriveMinutes,
      estimated_service_minutes: estimatedServiceMinutes,
      break_included: breakNeeded,
    },
    fit: {
      equipment_ok: equipmentOk,
      hazmat_ok: hazmatOk,
      payload_ok: payloadOk,
      deadhead_ok: deadheadOk,
    },
    driver_confirmation_required: true,
    automatic_load_acceptance: false,
  };
}

async function logEvent(base44, userId, event) {
  try {
    return await base44.asServiceRole.entities.DispatchEvent.create({
      user_id: userId,
      load_id: event.load_id || "",
      assignment_id: event.assignment_id || "",
      event_type: event.event_type || "exception",
      severity: event.severity || "info",
      message: cleanText(event.message || "", 500),
      occurred_at: nowIso(),
      metadata: event.metadata || {},
    });
  } catch (e) {
    console.error("driver-dispatch audit event failed", e);
    return null;
  }
}

async function getFreightContext(base44, user) {
  const [profiles, vehicles, hosRows, assignmentRows, eventRows] = await Promise.all([
    base44.entities.TruckDriverProfile.filter({ user_id: user.id }),
    base44.entities.TruckVehicle.filter({ owner_user_id: user.id }),
    base44.entities.DriverHosState.filter({ user_id: user.id }, "-last_synced_at"),
    base44.entities.DispatchAssignment.filter({ user_id: user.id }, "-assigned_at"),
    base44.entities.DispatchEvent.filter({ user_id: user.id }, "-occurred_at", 30),
  ]);
  return {
    profile: profiles?.[0] || null,
    vehicles: vehicles || [],
    vehicle: (vehicles || []).find((v) => v.status !== "maintenance" && v.status !== "offline") || vehicles?.[0] || null,
    hos: hosRows?.[0] || null,
    assignments: assignmentRows || [],
    events: eventRows || [],
  };
}

async function freightDashboard(base44, user) {
  const ctx = await getFreightContext(base44, user);
  const rows = await base44.asServiceRole.entities.FreightLoad.filter({ status: "available" }, "-captured_at", 250);
  const now = Date.now();
  const visibleLoads = (rows || []).filter((load) => {
    if (!FREIGHT_SOURCES.has(String(load.source_type || ""))) return false;
    if (load.verification_status === "rejected") return false;
    if (load.scope_user_id && load.scope_user_id !== user.id) return false;
    if (load.scope_usdot_number && String(load.scope_usdot_number) !== String(ctx.profile?.usdot_number || "")) return false;
    const expires = Date.parse(String(load.expires_at || ""));
    if (Number.isFinite(expires) && expires <= now) return false;
    return true;
  });

  const decisions = visibleLoads
    .map((load) => ({ load, decision: evaluateFreightLoad(load, ctx.profile || {}, ctx.vehicle, ctx.hos) }))
    .sort((a, b) => {
      const order = { TAKE: 0, CONSIDER: 1, PASS: 2 };
      return (order[a.decision.action] - order[b.decision.action]) || b.decision.score - a.decision.score;
    });
  const activeAssignments = ctx.assignments.filter((a) => !TERMINAL_ASSIGNMENT_STATUSES.has(a.status));
  const activeLoadIds = new Set(activeAssignments.map((a) => a.load_id));
  const activeLoads = [];
  for (const loadId of activeLoadIds) {
    const found = await base44.asServiceRole.entities.FreightLoad.filter({ id: loadId });
    if (found?.[0]) activeLoads.push(found[0]);
  }
  const active = activeAssignments.map((assignment) => ({
    assignment,
    load: activeLoads.find((load) => load.id === assignment.load_id) || null,
  }));

  const avgRpm = decisions.length
    ? decisions.reduce((sum, row) => sum + Number(row.decision.economics.rate_per_mile || 0), 0) / decisions.length
    : 0;

  return {
    mode: "freight_dispatch",
    generated_at: nowIso(),
    profile: ctx.profile,
    vehicles: ctx.vehicles,
    selected_vehicle: ctx.vehicle,
    hos: ctx.hos,
    hos_fresh: isFreshHos(ctx.hos),
    hos_reference: {
      property_carrier_drive_limit_minutes: 660,
      property_carrier_shift_window_minutes: 840,
      break_after_cumulative_driving_minutes: 480,
      cycle_limit_minutes: 4200,
      note: "Planning aid only. The driver's certified ELD/RODS remains the compliance source of truth.",
    },
    provider_status: {
      truck_routing: Deno.env.get("HERE_API_KEY") ? "ready" : "setup_required",
      truck_routing_provider: "HERE Routing API v8",
      load_feeds: Deno.env.get("LOKIN_FREIGHT_FEED_SECRET") ? "authorized_feed_ready" : "manual_only_until_feed_secret",
      feed_ingest_function: "freight-feed-ingest",
      automatic_load_acceptance: false,
    },
    metrics: {
      available_loads: decisions.length,
      recommended_take: decisions.filter((row) => row.decision.action === "TAKE").length,
      active_loads: active.length,
      average_rate_per_mile: round(avgRpm),
    },
    loads: decisions,
    active,
    events: ctx.events.slice(0, 12),
  };
}

async function upsertUserEntity(base44, entityName, query, data) {
  const rows = await base44.entities[entityName].filter(query);
  if (rows?.[0]) return await base44.entities[entityName].update(rows[0].id, data);
  return await base44.entities[entityName].create({ ...query, ...data });
}

async function handleFreight(base44, user, body, action) {
  if (action === "freight_dashboard") return Response.json(await freightDashboard(base44, user));

  if (action === "freight_briefing") {
    const dashboard = await freightDashboard(base44, user);
    const candidates = (dashboard.loads || []).slice(0, 5);
    if (!candidates.length) {
      return Response.json({ briefing: "No current freight loads are available to rank. Add a private load or connect an authorized freight feed." });
    }
    const briefing = await invokeLLMWithAdmission(base44, {
      prompt: [
        "You are LOKIN AI Dispatch, a commercial-truck decision assistant.",
        "Advise only; never claim to accept, book, negotiate, or dispatch a load automatically.",
        "Never advise violating HOS, vehicle restrictions, hazmat requirements, posted restrictions, or carrier policy.",
        "Prefer verified data. Explicitly identify manual/unverified load data as unverified.",
        `Driver HOS planning state fresh: ${dashboard.hos_fresh ? "yes" : "no"}.`,
        `Truck: ${dashboard.selected_vehicle ? `${dashboard.selected_vehicle.unit_number} ${dashboard.selected_vehicle.equipment_type}` : "not configured"}.`,
        "Top current candidates:",
        ...candidates.map((row, i) => `${i + 1}. ${row.decision.action} score ${row.decision.score}; ${row.load.pickup_address} -> ${row.load.dropoff_address}; all-in $${Number(row.load.total_rate || 0).toFixed(2)}; ${row.decision.economics.rate_per_mile}/mi; expected net $${row.decision.economics.expected_net}; expected net/hr $${row.decision.economics.expected_net_per_hour}; source ${row.load.source_type}/${row.load.verification_status}; hard blocks ${row.decision.hard_blocks.join(",") || "none"}; preference misses ${row.decision.preference_misses.join(",") || "none"}.`),
        "Return a concise dispatch briefing: best next load, why it wins, the main risk/check before booking, and one fallback. Keep it under 140 words.",
      ].join("\n"),
    });
    return Response.json({ briefing, generated_at: nowIso(), driver_confirmation_required: true });
  }

  if (action === "freight_save_profile") {
    const input = body.profile || {};
    const allowed = {
      carrier_name: cleanText(input.carrier_name, 160),
      usdot_number: cleanText(input.usdot_number, 24),
      mc_number: cleanText(input.mc_number, 24),
      driver_mode: ["owner_operator", "company_driver", "fleet_dispatcher"].includes(input.driver_mode) ? input.driver_mode : "owner_operator",
      cdl_class: ["A", "B", "C", "not_required", "unknown"].includes(input.cdl_class) ? input.cdl_class : "unknown",
      endorsements: Array.isArray(input.endorsements) ? input.endorsements.map((v) => cleanText(v, 24)).filter(Boolean).slice(0, 20) : [],
      home_terminal: cleanText(input.home_terminal, 240),
      preferred_equipment: Array.isArray(input.preferred_equipment) ? input.preferred_equipment.map((v) => cleanText(v, 40)).filter(Boolean).slice(0, 12) : [],
      preferred_regions: Array.isArray(input.preferred_regions) ? input.preferred_regions.map((v) => cleanText(v, 80)).filter(Boolean).slice(0, 20) : [],
      max_deadhead_miles: clamp(input.max_deadhead_miles ?? 75, 0, 500),
      min_rate_per_mile: clamp(input.min_rate_per_mile ?? 2, 0, 20),
      min_load_rate: clamp(input.min_load_rate ?? 500, 0, 100000),
      operating_cost_per_mile: clamp(input.operating_cost_per_mile ?? 1.15, 0, 20),
      target_net_per_hour: clamp(input.target_net_per_hour ?? 45, 0, 1000),
      status: ["available", "on_load", "off_duty", "paused"].includes(input.status) ? input.status : "available",
      updated_at: nowIso(),
    };
    const record = await upsertUserEntity(base44, "TruckDriverProfile", { user_id: user.id }, allowed);
    await logEvent(base44, user.id, { event_type: "profile_updated", message: "Truck dispatch profile updated." });
    return Response.json({ ok: true, profile: record });
  }

  if (action === "freight_save_vehicle") {
    const input = body.vehicle || {};
    const unitNumber = cleanText(input.unit_number, 40);
    if (!unitNumber) return Response.json({ error: "Unit number is required" }, { status: 400 });
    const allowed = {
      unit_number: unitNumber,
      vehicle_type: ["tractor_trailer", "straight_truck", "box_truck", "cargo_van"].includes(input.vehicle_type) ? input.vehicle_type : "tractor_trailer",
      equipment_type: ["dry_van", "reefer", "flatbed", "step_deck", "power_only", "box_truck", "cargo_van", "other"].includes(input.equipment_type) ? input.equipment_type : "dry_van",
      vin_last6: cleanText(input.vin_last6, 6),
      gross_weight_lbs: clamp(input.gross_weight_lbs ?? 80000, 0, 300000),
      current_weight_lbs: clamp(input.current_weight_lbs ?? 0, 0, 300000),
      max_payload_lbs: clamp(input.max_payload_lbs ?? 0, 0, 200000),
      height_ft: clamp(input.height_ft ?? 13.5, 0, 30),
      width_ft: clamp(input.width_ft ?? 8.5, 0, 20),
      length_ft: clamp(input.length_ft ?? 70, 0, 150),
      axles: clamp(input.axles ?? 5, 1, 20),
      mpg: clamp(input.mpg ?? 6.5, 1, 40),
      hazmat_capable: Boolean(input.hazmat_capable),
      status: ["available", "dispatched", "maintenance", "offline"].includes(input.status) ? input.status : "available",
      updated_at: nowIso(),
    };
    const rows = await base44.entities.TruckVehicle.filter({ owner_user_id: user.id, unit_number: unitNumber });
    const record = rows?.[0]
      ? await base44.entities.TruckVehicle.update(rows[0].id, allowed)
      : await base44.entities.TruckVehicle.create({ owner_user_id: user.id, ...allowed });
    await logEvent(base44, user.id, { event_type: "vehicle_updated", message: `Truck unit ${unitNumber} updated.` });
    return Response.json({ ok: true, vehicle: record });
  }

  if (action === "freight_save_hos") {
    const input = body.hos || {};
    const data = {
      source: "user_entered",
      duty_status: ["off_duty", "sleeper", "driving", "on_duty_not_driving"].includes(input.duty_status) ? input.duty_status : "off_duty",
      drive_minutes_remaining: clamp(input.drive_minutes_remaining ?? MAX_HOS.drive, 0, MAX_HOS.drive),
      shift_minutes_remaining: clamp(input.shift_minutes_remaining ?? MAX_HOS.shift, 0, MAX_HOS.shift),
      cycle_minutes_remaining: clamp(input.cycle_minutes_remaining ?? MAX_HOS.cycle, 0, MAX_HOS.cycle),
      break_due_in_minutes: clamp(input.break_due_in_minutes ?? MAX_HOS.break, 0, MAX_HOS.break),
      last_synced_at: nowIso(),
      advisory_only: true,
      notes: cleanText(input.notes, 500),
    };
    const record = await upsertUserEntity(base44, "DriverHosState", { user_id: user.id }, data);
    await logEvent(base44, user.id, { event_type: "hos_updated", message: "Driver HOS planning state updated from driver-entered values." });
    return Response.json({ ok: true, hos: record });
  }

  if (action === "freight_ingest_manual") {
    const input = body.load || {};
    const pickup = cleanText(input.pickup_address, 300);
    const dropoff = cleanText(input.dropoff_address, 300);
    const loadedMiles = clamp(input.loaded_miles, 0, 10000);
    const totalRate = clamp(input.total_rate, 0, 1000000);
    if (!pickup || !dropoff || loadedMiles <= 0 || totalRate <= 0) {
      return Response.json({ error: "Pickup, drop-off, loaded miles, and total rate are required" }, { status: 400 });
    }
    const capturedAt = nowIso();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    const load = await base44.asServiceRole.entities.FreightLoad.create({
      source_type: "manual",
      source_reference: cleanText(input.source_reference, 120),
      verification_status: "unverified",
      scope_user_id: user.id,
      broker_name: cleanText(input.broker_name, 160),
      broker_mc_number: cleanText(input.broker_mc_number, 40),
      shipper_name: cleanText(input.shipper_name, 160),
      commodity: cleanText(input.commodity, 160),
      equipment_type: ["dry_van", "reefer", "flatbed", "step_deck", "power_only", "box_truck", "cargo_van", "other"].includes(input.equipment_type) ? input.equipment_type : "dry_van",
      weight_lbs: clamp(input.weight_lbs ?? 0, 0, 200000),
      hazmat: Boolean(input.hazmat),
      pickup_address: pickup,
      pickup_window_start: input.pickup_window_start || undefined,
      pickup_window_end: input.pickup_window_end || undefined,
      dropoff_address: dropoff,
      delivery_window_start: input.delivery_window_start || undefined,
      delivery_window_end: input.delivery_window_end || undefined,
      loaded_miles: loadedMiles,
      deadhead_miles: clamp(input.deadhead_miles ?? 0, 0, 3000),
      linehaul_amount: clamp(input.linehaul_amount ?? totalRate, 0, 1000000),
      fuel_surcharge: clamp(input.fuel_surcharge ?? 0, 0, 100000),
      accessorial_amount: clamp(input.accessorial_amount ?? 0, 0, 100000),
      total_rate: totalRate,
      status: "available",
      captured_at: capturedAt,
      expires_at: expiresAt,
      notes: cleanText(input.notes, 1000),
    });
    return Response.json({ ok: true, load });
  }

  if (action === "freight_accept") {
    const id = cleanText(body.id, 80);
    if (!id) return Response.json({ error: "Load id required" }, { status: 400 });
    const ctx = await getFreightContext(base44, user);
    if (!ctx.profile) return Response.json({ error: "Complete the truck dispatch profile before accepting loads" }, { status: 409 });
    if (!ctx.vehicle) return Response.json({ error: "Add an active truck before accepting loads" }, { status: 409 });
    if (!ctx.hos || !isFreshHos(ctx.hos)) return Response.json({ error: "Refresh HOS planning data before accepting this load" }, { status: 409 });
    const rows = await base44.asServiceRole.entities.FreightLoad.filter({ id });
    const load = rows?.[0];
    if (!load) return Response.json({ error: "Load not found" }, { status: 404 });
    if (load.scope_user_id && load.scope_user_id !== user.id) return Response.json({ error: "Load is not available to this driver" }, { status: 403 });
    if (load.status !== "available" || load.assigned_driver_user_id) return Response.json({ error: "Load is no longer available" }, { status: 409 });
    const decision = evaluateFreightLoad(load, ctx.profile, ctx.vehicle, ctx.hos);
    if (decision.hard_blocks.length) {
      await logEvent(base44, user.id, { load_id: id, event_type: decision.hard_blocks.some((v) => v.startsWith("HOS")) ? "hos_block" : "exception", severity: "warning", message: `Load acceptance blocked: ${decision.hard_blocks.join(", ")}`, metadata: { decision } });
      return Response.json({ error: "Load does not pass dispatch safety gates", decision }, { status: 409 });
    }
    const acceptedAt = nowIso();
    const assignment = await base44.asServiceRole.entities.DispatchAssignment.create({
      user_id: user.id,
      load_id: load.id,
      vehicle_id: ctx.vehicle.id,
      status: "accepted",
      decision_score: decision.score,
      expected_rate_per_mile: decision.economics.rate_per_mile,
      expected_net: decision.economics.expected_net,
      expected_net_per_hour: decision.economics.expected_net_per_hour,
      total_miles: decision.economics.total_miles,
      deadhead_miles: decision.economics.deadhead_miles,
      estimated_drive_minutes: decision.hos.estimated_drive_minutes,
      estimated_service_minutes: decision.hos.estimated_service_minutes,
      hos_feasible: decision.hos.feasible,
      hos_source: decision.hos.source || "unknown",
      driver_confirmation_required: true,
      assigned_at: acceptedAt,
      accepted_at: acceptedAt,
    });
    const updated = await base44.asServiceRole.entities.FreightLoad.update(load.id, {
      status: "assigned",
      assigned_driver_user_id: user.id,
      assigned_vehicle_id: ctx.vehicle.id,
    });
    await base44.entities.TruckVehicle.update(ctx.vehicle.id, { status: "dispatched", updated_at: acceptedAt });
    if (ctx.profile?.id) await base44.entities.TruckDriverProfile.update(ctx.profile.id, { status: "on_load", updated_at: acceptedAt });
    await logEvent(base44, user.id, { load_id: load.id, assignment_id: assignment.id, event_type: "load_accepted", message: `Load accepted: ${load.pickup_address} to ${load.dropoff_address}.`, metadata: { score: decision.score, rate_per_mile: decision.economics.rate_per_mile } });
    return Response.json({ ok: true, load: updated, assignment, decision });
  }

  if (action === "freight_status") {
    const assignmentId = cleanText(body.assignment_id, 80);
    const nextStatus = cleanText(body.status, 40);
    const allowedTransitions = {
      accepted: ["en_route_pickup", "canceled"],
      en_route_pickup: ["picked_up", "canceled"],
      picked_up: ["in_transit"],
      in_transit: ["delivered"],
    };
    const rows = await base44.entities.DispatchAssignment.filter({ id: assignmentId, user_id: user.id });
    const assignment = rows?.[0];
    if (!assignment) return Response.json({ error: "Dispatch assignment not found" }, { status: 404 });
    if (!(allowedTransitions[assignment.status] || []).includes(nextStatus)) {
      return Response.json({ error: `Invalid transition ${assignment.status} -> ${nextStatus}` }, { status: 409 });
    }
    const stamp = nowIso();
    const patch = { status: nextStatus };
    if (nextStatus === "picked_up") patch.picked_up_at = stamp;
    if (nextStatus === "delivered") patch.delivered_at = stamp;
    const updatedAssignment = await base44.entities.DispatchAssignment.update(assignment.id, patch);
    const loadStatus = nextStatus === "accepted" ? "assigned" : nextStatus;
    const updatedLoad = await base44.asServiceRole.entities.FreightLoad.update(assignment.load_id, { status: loadStatus });
    if (nextStatus === "delivered") {
      const vehicles = await base44.entities.TruckVehicle.filter({ id: assignment.vehicle_id, owner_user_id: user.id });
      if (vehicles?.[0]) await base44.entities.TruckVehicle.update(vehicles[0].id, { status: "available", updated_at: stamp });
      const profiles = await base44.entities.TruckDriverProfile.filter({ user_id: user.id });
      if (profiles?.[0]) await base44.entities.TruckDriverProfile.update(profiles[0].id, { status: "available", updated_at: stamp });
    }
    const eventType = nextStatus === "en_route_pickup" ? "en_route_pickup" : nextStatus;
    await logEvent(base44, user.id, { load_id: assignment.load_id, assignment_id: assignment.id, event_type: eventType, message: `Dispatch status changed to ${nextStatus}.` });
    return Response.json({ ok: true, assignment: updatedAssignment, load: updatedLoad });
  }

  return null;
}

async function handleLegacyMerchantDispatch(base44, user, body, action) {
  const certs = await base44.entities.DriverCertification.filter({ user_id: user.id, status: "passed" });
  const certified = certs.length > 0;
  const cannabisCert = certs.some((c) => c.program === "cannabis_training" && c.eligible_for_regulated_offers);

  if (action === "list") {
    const categoryFilter = body.category ? String(body.category) : null;
    const available = [];
    if (!categoryFilter || categoryFilter === "non_controlled") {
      const rows = await base44.asServiceRole.entities.MerchantOrder.filter({ status: "driver_requested", category: "non_controlled" }, "-requested_at");
      (rows || []).forEach((o) => available.push(o));
    }
    if (cannabisCert && (!categoryFilter || categoryFilter === "cannabis_future")) {
      const rows = await base44.asServiceRole.entities.MerchantOrder.filter({ status: "driver_requested", category: "cannabis_future" }, "-requested_at");
      (rows || []).forEach((o) => available.push(o));
    }
    const mine = await base44.asServiceRole.entities.MerchantOrder.filter({ assigned_driver_user_id: user.id }, "-requested_at");
    return Response.json({ available, mine: mine || [], certified, cannabis_certified: cannabisCert, regulated_enabled: cannabisCert });
  }

  if (action === "accept") {
    const id = String(body.id || "");
    if (!id) return Response.json({ error: "Order id required" }, { status: 400 });
    const rows = await base44.asServiceRole.entities.MerchantOrder.filter({ id });
    const order = rows[0];
    if (!order) return Response.json({ error: "Order not found" }, { status: 404 });
    if (!["non_controlled", "cannabis_future"].includes(order.category)) return Response.json({ error: "This category is not enabled for dispatch" }, { status: 403 });
    if (order.category === "cannabis_future" && !cannabisCert) return Response.json({ error: "Cannabis certification required for this order" }, { status: 403 });
    if (order.status !== "driver_requested" || order.assigned_driver_user_id) return Response.json({ error: "Order is no longer available" }, { status: 409 });
    const updated = await base44.asServiceRole.entities.MerchantOrder.update(id, { assigned_driver_user_id: user.id, status: "driver_assigned" });
    if (order.category === "cannabis_future" && order.customer_reference) {
      try {
        const coRows = await base44.asServiceRole.entities.CannabisOrder.filter({ id: order.customer_reference });
        if (coRows?.[0]) await base44.asServiceRole.entities.CannabisOrder.update(coRows[0].id, { status: "accepted", driver_user_id: user.id });
      } catch (e) { console.error("driver-dispatch: cannabis accept sync failed", e); }
    }
    return Response.json({ ok: true, order: updated });
  }

  if (action === "pickup") {
    const id = String(body.id || "");
    const rows = await base44.asServiceRole.entities.MerchantOrder.filter({ id, assigned_driver_user_id: user.id });
    const order = rows[0];
    if (!order) return Response.json({ error: "Assigned order not found" }, { status: 404 });
    const updated = await base44.asServiceRole.entities.MerchantOrder.update(id, { status: "picked_up" });
    if (order.category === "cannabis_future" && order.customer_reference) {
      try {
        const coRows = await base44.asServiceRole.entities.CannabisOrder.filter({ id: order.customer_reference });
        if (coRows?.[0]) await base44.asServiceRole.entities.CannabisOrder.update(coRows[0].id, { status: "picked_up" });
      } catch (e) { console.error("driver-dispatch: cannabis pickup sync failed", e); }
    }
    return Response.json({ ok: true, order: updated });
  }

  return null;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "list");

    if (action.startsWith("freight_")) {
      const freight = await handleFreight(base44, user, body, action);
      if (freight) return freight;
    }

    const legacy = await handleLegacyMerchantDispatch(base44, user, body, action);
    if (legacy) return legacy;
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    console.error("driver-dispatch error", error);
    return Response.json({ error: error?.message || "Dispatch request failed" }, { status: 500 });
  }
}
