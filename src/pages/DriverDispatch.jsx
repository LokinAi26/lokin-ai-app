import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  DollarSign,
  Gauge,
  LockKeyhole,
  MapPin,
  Navigation,
  PackageCheck,
  Plus,
  Radio,
  RefreshCw,
  Route as RouteIcon,
  Settings2,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";

const EQUIPMENT = ["dry_van", "reefer", "flatbed", "step_deck", "power_only", "box_truck", "cargo_van", "other"];

function errorText(error) {
  return error?.response?.data?.error || error?.message || "Dispatch request failed";
}

function money(value) {
  return `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function decimalMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function hours(minutes) {
  const n = Number(minutes);
  return Number.isFinite(n) ? `${(n / 60).toFixed(1)}h` : "—";
}

function title(value) {
  return String(value || "").replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function DriverDispatch() {
  const [mode, setMode] = useState("freight");
  const [freight, setFreight] = useState(null);
  const [local, setLocal] = useState({ available: [], mine: [], certified: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [routeResult, setRouteResult] = useState(null);
  const [profileForm, setProfileForm] = useState({});
  const [vehicleForm, setVehicleForm] = useState({});
  const [hosForm, setHosForm] = useState({});
  const [loadForm, setLoadForm] = useState({ equipment_type: "dry_van" });
  const navigate = useNavigate();

  async function loadFreight(silent = false) {
    if (!silent) setBusy(true);
    setError("");
    try {
      const res = await base44.functions.invoke("driver-dispatch", { action: "freight_dashboard" });
      const data = res.data;
      setFreight(data);
      setProfileForm((prev) => Object.keys(prev).length ? prev : {
        carrier_name: data.profile?.carrier_name || "",
        usdot_number: data.profile?.usdot_number || "",
        mc_number: data.profile?.mc_number || "",
        driver_mode: data.profile?.driver_mode || "owner_operator",
        cdl_class: data.profile?.cdl_class || "A",
        endorsements: (data.profile?.endorsements || []).join(", "),
        home_terminal: data.profile?.home_terminal || "",
        preferred_equipment: (data.profile?.preferred_equipment || ["dry_van"]).join(", "),
        max_deadhead_miles: data.profile?.max_deadhead_miles ?? 75,
        min_rate_per_mile: data.profile?.min_rate_per_mile ?? 2,
        min_load_rate: data.profile?.min_load_rate ?? 500,
        operating_cost_per_mile: data.profile?.operating_cost_per_mile ?? 1.15,
        target_net_per_hour: data.profile?.target_net_per_hour ?? 45,
      });
      const v = data.selected_vehicle;
      setVehicleForm((prev) => Object.keys(prev).length ? prev : {
        unit_number: v?.unit_number || "",
        vehicle_type: v?.vehicle_type || "tractor_trailer",
        equipment_type: v?.equipment_type || "dry_van",
        gross_weight_lbs: v?.gross_weight_lbs ?? 80000,
        current_weight_lbs: v?.current_weight_lbs ?? 0,
        max_payload_lbs: v?.max_payload_lbs ?? 45000,
        height_ft: v?.height_ft ?? 13.5,
        width_ft: v?.width_ft ?? 8.5,
        length_ft: v?.length_ft ?? 70,
        axles: v?.axles ?? 5,
        mpg: v?.mpg ?? 6.5,
        hazmat_capable: Boolean(v?.hazmat_capable),
      });
      setHosForm((prev) => Object.keys(prev).length ? prev : {
        duty_status: data.hos?.duty_status || "off_duty",
        drive_minutes_remaining: data.hos?.drive_minutes_remaining ?? 660,
        shift_minutes_remaining: data.hos?.shift_minutes_remaining ?? 840,
        cycle_minutes_remaining: data.hos?.cycle_minutes_remaining ?? 4200,
        break_due_in_minutes: data.hos?.break_due_in_minutes ?? 480,
      });
    } catch (e) {
      setError(errorText(e));
    } finally {
      if (!silent) setBusy(false);
    }
  }

  async function loadLocal() {
    setBusy(true); setError("");
    try {
      const res = await base44.functions.invoke("driver-dispatch", { action: "list" });
      setLocal(res.data || { available: [], mine: [] });
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }

  useEffect(() => { loadFreight(); }, []);
  useEffect(() => { if (mode === "local") loadLocal(); }, [mode]);

  const topDecision = freight?.loads?.find((row) => row.decision?.action !== "PASS") || freight?.loads?.[0] || null;
  const profileReady = Boolean(freight?.profile);
  const vehicleReady = Boolean(freight?.selected_vehicle);
  const hosReady = Boolean(freight?.hos && freight?.hos_fresh);
  const dispatchReady = profileReady && vehicleReady && hosReady;

  async function saveProfile(e) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await base44.functions.invoke("driver-dispatch", {
        action: "freight_save_profile",
        profile: {
          ...profileForm,
          endorsements: String(profileForm.endorsements || "").split(",").map((v) => v.trim()).filter(Boolean),
          preferred_equipment: String(profileForm.preferred_equipment || "").split(",").map((v) => v.trim()).filter(Boolean),
        },
      });
      setProfileForm({});
      await loadFreight(true);
    } catch (e2) { setError(errorText(e2)); }
    finally { setBusy(false); }
  }

  async function saveVehicle(e) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await base44.functions.invoke("driver-dispatch", { action: "freight_save_vehicle", vehicle: vehicleForm });
      setVehicleForm({});
      await loadFreight(true);
    } catch (e2) { setError(errorText(e2)); }
    finally { setBusy(false); }
  }

  async function saveHos(e) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await base44.functions.invoke("driver-dispatch", { action: "freight_save_hos", hos: hosForm });
      setHosForm({});
      await loadFreight(true);
    } catch (e2) { setError(errorText(e2)); }
    finally { setBusy(false); }
  }

  async function addManualLoad(e) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await base44.functions.invoke("driver-dispatch", { action: "freight_ingest_manual", load: loadForm });
      setLoadForm({ equipment_type: vehicleForm.equipment_type || freight?.selected_vehicle?.equipment_type || "dry_van" });
      await loadFreight(true);
    } catch (e2) { setError(errorText(e2)); }
    finally { setBusy(false); }
  }

  async function acceptFreight(row) {
    const load = row.load;
    const decision = row.decision;
    const confirmed = window.confirm(`Accept this load for ${money(load.total_rate)} at ${decimalMoney(decision.economics.rate_per_mile)}/mi? LOKIN will never accept a freight load without your confirmation.`);
    if (!confirmed) return;
    setBusy(true); setError("");
    try {
      await base44.functions.invoke("driver-dispatch", { action: "freight_accept", id: load.id });
      await loadFreight(true);
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }

  async function advanceAssignment(item, status) {
    setBusy(true); setError("");
    try {
      await base44.functions.invoke("driver-dispatch", { action: "freight_status", assignment_id: item.assignment.id, status });
      await loadFreight(true);
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }

  async function checkTruckRoute(load) {
    setBusy(true); setError(""); setRouteResult(null);
    try {
      const res = await base44.functions.invoke("truck-route", {
        origin_address: load.pickup_address,
        destination_address: load.dropoff_address,
        vehicle_id: freight?.selected_vehicle?.id,
        hazmat: Boolean(load.hazmat),
      });
      setRouteResult({ load, ...res.data });
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); }
  }

  async function acceptLocal(order) {
    setBusy(true); setError("");
    try {
      await base44.functions.invoke("driver-dispatch", { action: "accept", id: order.id });
      await loadLocal();
      navigate(`/ai-gps?focus=locked&nav=1&view=real&order=${encodeURIComponent(order.id)}&destination=${encodeURIComponent(order.pickup_address || "")}`);
    } catch (e) { setError(errorText(e)); setBusy(false); }
  }

  async function pickupLocal(order) {
    setBusy(true); setError("");
    try {
      await base44.functions.invoke("driver-dispatch", { action: "pickup", id: order.id });
      await loadLocal();
      navigate(`/ai-gps?focus=locked&nav=1&view=real&order=${encodeURIComponent(order.id)}&destination=${encodeURIComponent(order.dropoff_address || "")}`);
    } catch (e) { setError(errorText(e)); setBusy(false); }
  }

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="rounded-3xl border border-primary/25 lokin-panel radial-fade p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-primary"><Truck className="h-5 w-5"/><span className="text-[11px] tracking-[0.2em] font-display">LOKIN AI DISPATCH</span></div>
          <span className={`rounded-full border px-2.5 py-1 text-[9px] font-extrabold tracking-wider ${dispatchReady ? "border-primary/35 bg-primary/10 text-primary" : "border-amber-400/25 bg-amber-400/[0.06] text-amber-300"}`}>
            {dispatchReady ? "DISPATCH READY" : "SETUP REQUIRED"}
          </span>
        </div>
        <h1 className="text-3xl font-extrabold font-display metal-text mt-2">AI Dispatch Center</h1>
        <p className="text-sm text-white/55 mt-2">Freight load intelligence for truck drivers and owner-operators, with driver-controlled acceptance, HOS gating, truck-fit checks, and commercial route validation.</p>
      </div>

      <div className="grid grid-cols-2 rounded-2xl border border-white/10 bg-black/40 p-1">
        <button onClick={() => setMode("freight")} className={`rounded-xl py-2.5 text-xs font-extrabold ${mode === "freight" ? "bg-primary text-black" : "text-white/50"}`}>TRUCK FREIGHT</button>
        <button onClick={() => setMode("local")} className={`rounded-xl py-2.5 text-xs font-extrabold ${mode === "local" ? "bg-accent text-black" : "text-white/50"}`}>LOCAL PICKUPS</button>
      </div>

      {error && <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-3 text-sm text-red-300 flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0 mt-0.5"/>{error}</div>}

      {mode === "freight" ? (
        <FreightCenter
          data={freight}
          busy={busy}
          topDecision={topDecision}
          dispatchReady={dispatchReady}
          routeResult={routeResult}
          onRefresh={() => loadFreight()}
          onAccept={acceptFreight}
          onAdvance={advanceAssignment}
          onTruckRoute={checkTruckRoute}
          profileForm={profileForm}
          setProfileForm={setProfileForm}
          vehicleForm={vehicleForm}
          setVehicleForm={setVehicleForm}
          hosForm={hosForm}
          setHosForm={setHosForm}
          loadForm={loadForm}
          setLoadForm={setLoadForm}
          saveProfile={saveProfile}
          saveVehicle={saveVehicle}
          saveHos={saveHos}
          addManualLoad={addManualLoad}
        />
      ) : (
        <LocalDispatch data={local} busy={busy} onRefresh={loadLocal} onAccept={acceptLocal} onPickup={pickupLocal} navigate={navigate} />
      )}
    </div>
  );
}

function FreightCenter(props) {
  const { data, busy, topDecision, dispatchReady, routeResult, onRefresh, onAccept, onAdvance, onTruckRoute } = props;
  if (!data) return <div className="rounded-2xl border border-white/10 p-5 text-sm text-white/45">Loading dispatch intelligence…</div>;

  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-2">
      <Metric icon={PackageCheck} label="Available loads" value={data.metrics?.available_loads || 0} />
      <Metric icon={DollarSign} label="Avg all-in $/mi" value={decimalMoney(data.metrics?.average_rate_per_mile || 0)} />
      <Metric icon={Truck} label="Active freight" value={data.metrics?.active_loads || 0} />
      <Metric icon={Clock3} label="Drive remaining" value={data.hos ? hours(data.hos.drive_minutes_remaining) : "Set HOS"} />
    </div>

    <div className="rounded-3xl border border-white/10 lokin-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Radio className="h-4 w-4 text-primary"/><span className="text-xs font-bold">SYSTEM READINESS</span></div>
        <button onClick={onRefresh} disabled={busy} className="rounded-xl border border-white/10 px-3 py-2 text-[10px] font-bold text-white/55"><RefreshCw className={`inline h-3.5 w-3.5 mr-1 ${busy ? "animate-spin" : ""}`}/>REFRESH</button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <Readiness ok={Boolean(data.profile)} label="Driver profile" />
        <Readiness ok={Boolean(data.selected_vehicle)} label="Truck profile" />
        <Readiness ok={Boolean(data.hos && data.hos_fresh)} label="Fresh HOS state" />
        <Readiness ok={data.provider_status?.truck_routing === "ready"} label="Truck routing" />
      </div>
      <div className="mt-3 text-[10px] leading-relaxed text-white/40">Load acceptance always requires driver confirmation. HOS values are a planning aid; certified ELD/RODS remains the source of truth.</div>
    </div>

    {topDecision && <div className={`rounded-3xl border p-4 ${topDecision.decision.action === "TAKE" ? "border-primary/30 bg-primary/[0.055]" : topDecision.decision.action === "CONSIDER" ? "border-amber-400/25 bg-amber-400/[0.04]" : "border-white/10 bg-white/[0.02]"}`}>
      <div className="flex items-center gap-2 text-primary"><BrainCircuit className="h-5 w-5"/><span className="text-[10px] tracking-[0.18em] font-display">TOP DISPATCH DECISION</span></div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div><div className="text-2xl font-black text-white">{topDecision.decision.action}</div><div className="text-xs text-white/45">SEAL-style freight score {topDecision.decision.score}/100</div></div>
        <div className="text-right"><div className="text-xl font-black text-primary">{decimalMoney(topDecision.decision.economics.rate_per_mile)}/mi</div><div className="text-[10px] text-white/40">{money(topDecision.load.total_rate)} all-in</div></div>
      </div>
      <div className="mt-3 text-xs text-white/55 truncate">{topDecision.load.pickup_address} → {topDecision.load.dropoff_address}</div>
    </div>}

    {routeResult && <TruckRouteResult result={routeResult} />}

    <section>
      <div className="mb-2 flex items-center justify-between"><div className="text-xs tracking-[0.18em] text-primary/75 font-display">ACTIVE LOADS</div><span className="text-[10px] text-white/35">{data.active?.length || 0} active</span></div>
      <div className="space-y-2">
        {!data.active?.length && <Empty text="No active freight assignments." />}
        {(data.active || []).map((item) => <ActiveLoadCard key={item.assignment.id} item={item} busy={busy} onAdvance={onAdvance} onTruckRoute={onTruckRoute} />)}
      </div>
    </section>

    <section>
      <div className="mb-2 flex items-center justify-between"><div className="text-xs tracking-[0.18em] text-accent/75 font-display">AI-RANKED LOAD BOARD</div><span className="text-[10px] text-white/35">manual + authorized feeds only</span></div>
      <div className="space-y-2">
        {!data.loads?.length && <Empty text={dispatchReady ? "No current freight loads are available." : "Finish driver, truck, and HOS setup to activate dispatch ranking."} />}
        {(data.loads || []).map((row) => <FreightLoadCard key={row.load.id} row={row} busy={busy} onAccept={onAccept} onTruckRoute={onTruckRoute} />)}
      </div>
    </section>

    <DispatchSetup {...props} />
  </div>;
}

function FreightLoadCard({ row, busy, onAccept, onTruckRoute }) {
  const { load, decision } = row;
  const blocked = decision.action === "PASS";
  return <div className="rounded-3xl border border-white/10 lokin-panel p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><div className="font-bold text-white">{title(load.equipment_type)} · {load.commodity || "General freight"}</div><div className="text-[10px] text-white/40 mt-0.5">{load.broker_name || "Broker/shipper not supplied"}{load.broker_mc_number ? ` · MC ${load.broker_mc_number}` : ""}</div></div>
      <DecisionBadge action={decision.action} score={decision.score} />
    </div>
    <div className="mt-3 grid grid-cols-4 gap-1.5 text-center">
      <Mini label="rate" value={money(load.total_rate)} />
      <Mini label="$/mi" value={decimalMoney(decision.economics.rate_per_mile)} />
      <Mini label="loaded" value={`${decision.economics.loaded_miles}mi`} />
      <Mini label="deadhead" value={`${decision.economics.deadhead_miles}mi`} />
    </div>
    <div className="mt-3 space-y-1.5 text-xs text-white/50"><Address value={load.pickup_address}/><Address value={load.dropoff_address} accent/></div>
    <div className="mt-3 flex flex-wrap gap-1.5">
      <Pill ok={decision.hos.feasible} text={decision.hos.feasible ? "HOS FIT" : "HOS BLOCK"}/>
      <Pill ok={decision.fit.equipment_ok} text="EQUIPMENT"/>
      <Pill ok={decision.fit.payload_ok} text="PAYLOAD"/>
      {load.hazmat && <Pill ok={decision.fit.hazmat_ok} text="HAZMAT"/>}
      <span className="rounded-full border border-white/10 px-2 py-1 text-[9px] text-white/40">{title(load.verification_status)}</span>
    </div>
    {decision.hard_blocks?.length > 0 && <div className="mt-2 text-[10px] text-amber-300/80">Blocked: {decision.hard_blocks.map(title).join(" · ")}</div>}
    {decision.preference_misses?.length > 0 && !blocked && <div className="mt-2 text-[10px] text-white/35">Below preference: {decision.preference_misses.map(title).join(" · ")}</div>}
    <div className="mt-4 grid grid-cols-2 gap-2">
      <button onClick={() => onTruckRoute(load)} disabled={busy || load.hazmat} className="rounded-2xl border border-white/10 py-3 text-[10px] font-extrabold text-white/65 disabled:opacity-35"><RouteIcon className="inline h-3.5 w-3.5 mr-1"/>TRUCK ROUTE CHECK</button>
      <button onClick={() => onAccept(row)} disabled={busy || blocked} className="rounded-2xl bg-primary py-3 text-[10px] font-extrabold text-black disabled:opacity-35"><LockKeyhole className="inline h-3.5 w-3.5 mr-1"/>ACCEPT LOAD</button>
    </div>
    {load.hazmat && <div className="mt-2 text-[9px] text-amber-300/65">Hazmat truck routing remains blocked until the specific HERE hazardous-goods category is supplied.</div>}
  </div>;
}

function ActiveLoadCard({ item, busy, onAdvance, onTruckRoute }) {
  const { assignment, load } = item;
  if (!load) return null;
  const next = assignment.status === "accepted" ? ["en_route_pickup", "START TO PICKUP"] : assignment.status === "en_route_pickup" ? ["picked_up", "CONFIRM PICKUP"] : assignment.status === "picked_up" ? ["in_transit", "START TRANSIT"] : assignment.status === "in_transit" ? ["delivered", "MARK DELIVERED"] : null;
  return <div className="rounded-3xl border border-primary/20 bg-primary/[0.035] p-4">
    <div className="flex items-start justify-between"><div><div className="font-bold text-white">{title(assignment.status)}</div><div className="text-[10px] text-primary mt-0.5">Score {assignment.decision_score || "—"} · {decimalMoney(assignment.expected_rate_per_mile)}/mi</div></div><Truck className="h-5 w-5 text-primary"/></div>
    <div className="mt-3 space-y-1.5 text-xs text-white/50"><Address value={load.pickup_address}/><Address value={load.dropoff_address} accent/></div>
    <div className="mt-3 grid grid-cols-2 gap-2">
      <button onClick={() => onTruckRoute(load)} disabled={busy || load.hazmat} className="rounded-2xl border border-primary/20 py-3 text-[10px] font-extrabold text-primary disabled:opacity-35"><Navigation className="inline h-3.5 w-3.5 mr-1"/>VALIDATE ROUTE</button>
      {next && <button onClick={() => onAdvance(item, next[0])} disabled={busy} className="rounded-2xl bg-primary py-3 text-[10px] font-extrabold text-black disabled:opacity-35">{next[1]}</button>}
    </div>
  </div>;
}

function TruckRouteResult({ result }) {
  return <div className={`rounded-3xl border p-4 ${result.route?.restriction_clear ? "border-primary/30 bg-primary/[0.05]" : "border-amber-400/30 bg-amber-400/[0.05]"}`}>
    <div className="flex items-center gap-2"><ShieldCheck className={`h-5 w-5 ${result.route?.restriction_clear ? "text-primary" : "text-amber-300"}`}/><div className="font-bold text-white">Commercial Truck Route Check</div></div>
    <div className="mt-2 text-xs text-white/55">{result.origin?.label} → {result.destination?.label}</div>
    <div className="mt-3 grid grid-cols-3 gap-2"><Mini label="distance" value={`${result.route?.distance_miles || 0}mi`}/><Mini label="ETA" value={`${result.route?.duration_minutes || 0}m`}/><Mini label="critical" value={result.route?.critical_notices?.length || 0}/></div>
    <div className="mt-3 text-[10px] text-white/40">Provider: {result.provider}. Vehicle dimensions and weight were included in the truck-routing request.</div>
  </div>;
}

function DispatchSetup({ profileForm, setProfileForm, vehicleForm, setVehicleForm, hosForm, setHosForm, loadForm, setLoadForm, saveProfile, saveVehicle, saveHos, addManualLoad, busy }) {
  return <section className="space-y-2">
    <div className="text-xs tracking-[0.18em] text-white/55 font-display">DISPATCH CONFIGURATION</div>
    <details className="rounded-2xl border border-white/10 lokin-panel p-3">
      <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-bold"><Settings2 className="h-4 w-4 text-primary"/>Driver economics & authority</summary>
      <form onSubmit={saveProfile} className="mt-3 grid grid-cols-2 gap-2">
        <Field label="Carrier name" value={profileForm.carrier_name} onChange={(v) => setProfileForm({ ...profileForm, carrier_name: v })} wide />
        <Field label="USDOT" value={profileForm.usdot_number} onChange={(v) => setProfileForm({ ...profileForm, usdot_number: v })} />
        <Field label="MC number" value={profileForm.mc_number} onChange={(v) => setProfileForm({ ...profileForm, mc_number: v })} />
        <Select label="CDL class" value={profileForm.cdl_class || "A"} options={["A","B","C","not_required","unknown"]} onChange={(v) => setProfileForm({ ...profileForm, cdl_class: v })}/>
        <Field label="Endorsements CSV" value={profileForm.endorsements} onChange={(v) => setProfileForm({ ...profileForm, endorsements: v })}/>
        <Field label="Home terminal" value={profileForm.home_terminal} onChange={(v) => setProfileForm({ ...profileForm, home_terminal: v })} wide />
        <Field label="Equipment CSV" value={profileForm.preferred_equipment} onChange={(v) => setProfileForm({ ...profileForm, preferred_equipment: v })} wide />
        <NumberField label="Max deadhead mi" value={profileForm.max_deadhead_miles} onChange={(v) => setProfileForm({ ...profileForm, max_deadhead_miles: v })}/>
        <NumberField label="Min $/mi" value={profileForm.min_rate_per_mile} step="0.05" onChange={(v) => setProfileForm({ ...profileForm, min_rate_per_mile: v })}/>
        <NumberField label="Min load $" value={profileForm.min_load_rate} onChange={(v) => setProfileForm({ ...profileForm, min_load_rate: v })}/>
        <NumberField label="Operating $/mi" value={profileForm.operating_cost_per_mile} step="0.05" onChange={(v) => setProfileForm({ ...profileForm, operating_cost_per_mile: v })}/>
        <button disabled={busy} className="col-span-2 rounded-2xl bg-primary py-3 text-xs font-extrabold text-black disabled:opacity-40">SAVE DRIVER PROFILE</button>
      </form>
    </details>

    <details className="rounded-2xl border border-white/10 lokin-panel p-3">
      <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-bold"><Truck className="h-4 w-4 text-primary"/>Truck dimensions & equipment</summary>
      <form onSubmit={saveVehicle} className="mt-3 grid grid-cols-2 gap-2">
        <Field label="Unit number" value={vehicleForm.unit_number} onChange={(v) => setVehicleForm({ ...vehicleForm, unit_number: v })}/>
        <Select label="Equipment" value={vehicleForm.equipment_type || "dry_van"} options={EQUIPMENT} onChange={(v) => setVehicleForm({ ...vehicleForm, equipment_type: v })}/>
        <NumberField label="Gross weight lbs" value={vehicleForm.gross_weight_lbs} onChange={(v) => setVehicleForm({ ...vehicleForm, gross_weight_lbs: v })}/>
        <NumberField label="Current weight lbs" value={vehicleForm.current_weight_lbs} onChange={(v) => setVehicleForm({ ...vehicleForm, current_weight_lbs: v })}/>
        <NumberField label="Max payload lbs" value={vehicleForm.max_payload_lbs} onChange={(v) => setVehicleForm({ ...vehicleForm, max_payload_lbs: v })}/>
        <NumberField label="Height ft" value={vehicleForm.height_ft} step="0.1" onChange={(v) => setVehicleForm({ ...vehicleForm, height_ft: v })}/>
        <NumberField label="Width ft" value={vehicleForm.width_ft} step="0.1" onChange={(v) => setVehicleForm({ ...vehicleForm, width_ft: v })}/>
        <NumberField label="Length ft" value={vehicleForm.length_ft} step="0.1" onChange={(v) => setVehicleForm({ ...vehicleForm, length_ft: v })}/>
        <label className="col-span-2 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-xs text-white/60"><input type="checkbox" checked={Boolean(vehicleForm.hazmat_capable)} onChange={(e) => setVehicleForm({ ...vehicleForm, hazmat_capable: e.target.checked })}/> Hazmat-capable equipment</label>
        <button disabled={busy} className="col-span-2 rounded-2xl bg-primary py-3 text-xs font-extrabold text-black disabled:opacity-40">SAVE TRUCK</button>
      </form>
    </details>

    <details className="rounded-2xl border border-white/10 lokin-panel p-3">
      <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-bold"><Clock3 className="h-4 w-4 text-primary"/>HOS planning state</summary>
      <form onSubmit={saveHos} className="mt-3 grid grid-cols-2 gap-2">
        <NumberField label="Drive min left" value={hosForm.drive_minutes_remaining} onChange={(v) => setHosForm({ ...hosForm, drive_minutes_remaining: v })}/>
        <NumberField label="Shift min left" value={hosForm.shift_minutes_remaining} onChange={(v) => setHosForm({ ...hosForm, shift_minutes_remaining: v })}/>
        <NumberField label="Cycle min left" value={hosForm.cycle_minutes_remaining} onChange={(v) => setHosForm({ ...hosForm, cycle_minutes_remaining: v })}/>
        <NumberField label="Break due in min" value={hosForm.break_due_in_minutes} onChange={(v) => setHosForm({ ...hosForm, break_due_in_minutes: v })}/>
        <button disabled={busy} className="col-span-2 rounded-2xl bg-primary py-3 text-xs font-extrabold text-black disabled:opacity-40">REFRESH DRIVER-ENTERED HOS</button>
        <div className="col-span-2 text-[9px] leading-relaxed text-white/35">LOKIN caps driver-entered planning values to the property-carrier reference limits and does not replace the ELD/RODS.</div>
      </form>
    </details>

    <details className="rounded-2xl border border-accent/15 lokin-panel p-3">
      <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-bold"><Plus className="h-4 w-4 text-accent"/>Add a freight load manually</summary>
      <form onSubmit={addManualLoad} className="mt-3 grid grid-cols-2 gap-2">
        <Field label="Pickup address" value={loadForm.pickup_address} onChange={(v) => setLoadForm({ ...loadForm, pickup_address: v })} wide />
        <Field label="Drop-off address" value={loadForm.dropoff_address} onChange={(v) => setLoadForm({ ...loadForm, dropoff_address: v })} wide />
        <Field label="Broker" value={loadForm.broker_name} onChange={(v) => setLoadForm({ ...loadForm, broker_name: v })}/>
        <Field label="Broker MC" value={loadForm.broker_mc_number} onChange={(v) => setLoadForm({ ...loadForm, broker_mc_number: v })}/>
        <Select label="Equipment" value={loadForm.equipment_type || "dry_van"} options={EQUIPMENT} onChange={(v) => setLoadForm({ ...loadForm, equipment_type: v })}/>
        <Field label="Commodity" value={loadForm.commodity} onChange={(v) => setLoadForm({ ...loadForm, commodity: v })}/>
        <NumberField label="Loaded miles" value={loadForm.loaded_miles} onChange={(v) => setLoadForm({ ...loadForm, loaded_miles: v })}/>
        <NumberField label="Deadhead miles" value={loadForm.deadhead_miles} onChange={(v) => setLoadForm({ ...loadForm, deadhead_miles: v })}/>
        <NumberField label="All-in rate $" value={loadForm.total_rate} onChange={(v) => setLoadForm({ ...loadForm, total_rate: v })}/>
        <NumberField label="Weight lbs" value={loadForm.weight_lbs} onChange={(v) => setLoadForm({ ...loadForm, weight_lbs: v })}/>
        <button disabled={busy} className="col-span-2 rounded-2xl bg-accent py-3 text-xs font-extrabold text-black disabled:opacity-40">ADD TO PRIVATE LOAD BOARD</button>
      </form>
    </details>
  </section>;
}

function LocalDispatch({ data, busy, onRefresh, onAccept, onPickup, navigate }) {
  return <div className="space-y-4">
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3 text-xs text-white/45">Existing LOKIN merchant pickups remain separate from freight dispatch. This preserves the local-delivery workflow instead of mixing commercial freight and gig orders.</div>
    <button onClick={onRefresh} className="w-full rounded-2xl border border-white/10 lokin-panel py-3 text-sm font-semibold text-white/70 flex justify-center items-center gap-2"><RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`}/>Refresh local pickups</button>
    <section><div className="text-xs tracking-[0.18em] text-primary/75 font-display mb-2">AVAILABLE LOCAL PICKUPS</div><div className="space-y-2">{!data.available?.length && <Empty text="No merchant pickup requests are waiting right now."/>}{(data.available || []).map((o) => <LocalOrderCard key={o.id} order={o} actionLabel="ACCEPT & LOCK IN" onAction={() => onAccept(o)} busy={busy}/>)}</div></section>
    <section><div className="text-xs tracking-[0.18em] text-accent/75 font-display mb-2">MY ACTIVE PICKUPS</div><div className="space-y-2">{(data.mine || []).filter((o) => !["delivered","returned","canceled","refused"].includes(o.status)).map((o) => <LocalOrderCard key={o.id} order={o} actionLabel={o.status === "driver_assigned" ? "CONFIRM PICKUP & NAVIGATE" : o.status === "picked_up" ? "VERIFY HANDOFF" : "OPEN LOCKED GPS"} onAction={() => o.status === "driver_assigned" ? onPickup(o) : o.status === "picked_up" ? navigate(`/compliance-handoff?order=${encodeURIComponent(o.id)}`) : navigate(`/ai-gps?focus=locked&nav=1&view=real&order=${encodeURIComponent(o.id)}&destination=${encodeURIComponent(o.status === "driver_assigned" ? (o.pickup_address || "") : (o.dropoff_address || o.pickup_address || ""))}`)} busy={busy}/>)}</div></section>
  </div>;
}

function LocalOrderCard({ order, actionLabel, onAction, busy }) {
  return <div className="rounded-3xl border border-white/10 lokin-panel p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-bold text-white capitalize">{order.category?.replaceAll("_"," ")}</div><div className="text-xs text-primary mt-0.5 capitalize">{order.status?.replaceAll("_"," ")}</div></div><Navigation className="h-5 w-5 text-primary"/></div><div className="mt-3 space-y-1 text-xs text-white/50"><Address value={order.pickup_address || "Pickup address pending"}/>{order.dropoff_address && <Address value={order.dropoff_address} accent/>}</div><button onClick={onAction} disabled={busy} className="mt-4 w-full rounded-2xl bg-primary text-black py-3 font-bold disabled:opacity-40">{actionLabel}</button></div>;
}

function Metric({ icon: Icon, label, value }) {
  return <div className="rounded-2xl border border-white/10 lokin-panel p-3"><Icon className="h-4 w-4 text-primary mb-2"/><div className="text-xl font-black font-display">{value}</div><div className="text-[10px] text-white/40">{label}</div></div>;
}
function Readiness({ ok, label }) { return <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.02] p-2"><span className={`h-2 w-2 rounded-full ${ok ? "bg-primary" : "bg-amber-300"}`}/><span className="text-white/55">{label}</span></div>; }
function Mini({ label, value }) { return <div className="rounded-xl border border-white/8 bg-white/[0.025] p-2"><div className="text-xs font-bold text-white">{value}</div><div className="mt-0.5 text-[8px] uppercase tracking-wide text-white/35">{label}</div></div>; }
function DecisionBadge({ action, score }) { const cls = action === "TAKE" ? "border-primary/35 bg-primary/10 text-primary" : action === "CONSIDER" ? "border-amber-400/25 bg-amber-400/[0.06] text-amber-300" : "border-red-400/20 bg-red-400/[0.05] text-red-300"; return <div className={`rounded-xl border px-2.5 py-1.5 text-center ${cls}`}><div className="text-[10px] font-black">{action}</div><div className="text-[8px] opacity-70">{score}/100</div></div>; }
function Pill({ ok, text }) { return <span className={`rounded-full border px-2 py-1 text-[9px] ${ok ? "border-primary/25 bg-primary/[0.05] text-primary" : "border-red-400/20 bg-red-400/[0.04] text-red-300"}`}>{ok ? "✓" : "×"} {text}</span>; }
function Address({ value, accent = false }) { return <div className="flex gap-2"><MapPin className={`h-3.5 w-3.5 shrink-0 ${accent ? "text-accent" : "text-primary"}`}/><span>{value || "Address pending"}</span></div>; }
function Empty({ text }) { return <div className="rounded-2xl border border-white/10 p-4 text-sm text-white/40">{text}</div>; }
function Field({ label, value = "", onChange, wide = false }) { return <label className={`${wide ? "col-span-2" : ""} text-[10px] text-white/45`}>{label}<input value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/45 px-3 py-2.5 text-xs text-white outline-none focus:border-primary/35"/></label>; }
function NumberField({ label, value = "", onChange, step = "1" }) { return <label className="text-[10px] text-white/45">{label}<input type="number" step={step} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))} className="mt-1 w-full rounded-xl border border-white/10 bg-black/45 px-3 py-2.5 text-xs text-white outline-none focus:border-primary/35"/></label>; }
function Select({ label, value, options, onChange }) { return <label className="text-[10px] text-white/45">{label}<select value={value || options[0]} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/80 px-3 py-2.5 text-xs text-white outline-none">{options.map((o) => <option key={o} value={o}>{title(o)}</option>)}</select></label>; }
