import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Link } from "react-router-dom";
import { Radar, Clock, MapPin, RefreshCw, Camera, Save, KeyRound, Building2, Check, Maximize2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { CATEGORY_LABELS } from "@/lib/deliveryLabels";
import { guardedInvoke } from "@/lib/creditGuardian";

// Lay stops along a gentle curve in the XZ plane; `perturb` shifts positions
// when the live re-route runs so the 4D sequence visibly evolves over time.
function stopPositions(n, perturb = 0) {
  const pts = [];
  const span = Math.min(18, Math.max(6, n * 2.4));
  for (let i = 0; i < n; i++) {
    const t = n <= 1 ? 0.5 : i / (n - 1);
    const x = -span / 2 + t * span;
    const z = Math.sin(t * Math.PI * 1.4) * 4.5 + perturb * Math.sin(i * 2.3 + perturb);
    pts.push(new THREE.Vector3(x, 0, z));
  }
  return pts;
}

function roadRibbonGeometry(curve, width = 2.2, segments = 96, y = 0.02) {
  const vertices = [];
  const indices = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPoint(t);
    const tangent = curve.getTangent(t).normalize();
    const side = new THREE.Vector3().crossVectors(up, tangent).normalize().multiplyScalar(width / 2);
    vertices.push(p.x + side.x, y, p.z + side.z, p.x - side.x, y, p.z - side.z);
    if (i < segments) {
      const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
      indices.push(a, c, b, c, d, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export default function AiGps4D({ stops: stopsProp, compact = false }) {
  const containerRef = useRef(null);
  const stateRef = useRef({ total: 0, perturb: 0, playing: true, pos: [], time: 0, lastPct: -1 });
  const rebuildRef = useRef(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [stops, setStops] = useState(stopsProp || []);
  const [loading, setLoading] = useState(!stopsProp || stopsProp.length === 0);
  const [rerouting, setRerouting] = useState(false);
  const [pins, setPins] = useState([]);
  const [form, setForm] = useState({ apt: "", gate_code: "", note: "", photo_url: "" });
  const [saving, setSaving] = useState(false);

  const total = stops.length;
  const idx = total > 1 ? Math.round(time * (total - 1)) : 0;
  const current = stops[idx];
  const etaTotal = stops.reduce((s, o) => s + (o.est_minutes || 0), 0);
  const etaRemaining = Math.round(etaTotal * (1 - time));
  const accuracy = pins.length ? 100 : current ? 58 : 0;

  // Load stops (own optimizeRoute call only when not provided)
  useEffect(() => {
    if (stopsProp && stopsProp.length) {
      setStops(stopsProp);
      stateRef.current.total = stopsProp.length;
      setLoading(false);
      if (rebuildRef.current) rebuildRef.current();
      return;
    }
    setLoading(true);
    guardedInvoke(base44, "optimizeRoute", { mode: "most_profit" })
      .then((res) => {
        const s = res.data?.sequenced || [];
        setStops(s);
        stateRef.current.total = s.length;
        if (rebuildRef.current) rebuildRef.current();
      })
      .catch(() => setStops([]))
      .finally(() => setLoading(false));
  }, [stopsProp]);

  // Load saved precision pins for the active stop
  useEffect(() => {
    if (!current?.id) { setPins([]); return; }
    base44.entities.DropOffPin.filter({ offer_id: current.id }).then(setPins).catch(() => setPins([]));
  }, [current?.id]);

  useEffect(() => { stateRef.current.playing = playing; }, [playing]);

  // Three.js scene — mounted once
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const width = el.clientWidth || 320;
    const height = el.clientHeight || 240;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x223746);
    scene.fog = new THREE.Fog(0x223746, 20, 48);
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);
    camera.position.set(0, 9, 15);

    scene.add(new THREE.HemisphereLight(0xc7e6ff, 0x24391f, 1.15));
    const sun = new THREE.DirectionalLight(0xfff2d0, 1.35); sun.position.set(-8, 16, 10); scene.add(sun);
    const pl = new THREE.PointLight(0xa8ff00, 1.25, 42); pl.position.set(0, 9, 0); scene.add(pl);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(54, 54),
      new THREE.MeshStandardMaterial({ color: 0x314d2b, roughness: 1, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.04;
    scene.add(ground);

    const landscape = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3b24, roughness: 1 });
    const leafMats = [0x315d2e, 0x274d28, 0x3d6d35].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1 }));
    const treeSpots = [
      [-11,-9],[-8,-11],[-4,-10],[1,-11],[6,-10],[11,-8],[-12,9],[-8,11],[-3,10],[3,11],[8,10],[12,7],[-13,2],[13,-1]
    ];
    treeSpots.forEach(([x,z], i) => {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.15, 1.15, 7), trunkMat);
      trunk.position.set(x, 0.55, z);
      const crown = new THREE.Mesh(new THREE.SphereGeometry(0.72 + (i % 3) * 0.08, 10, 8), leafMats[i % leafMats.length]);
      crown.scale.y = 1.2;
      crown.position.set(x, 1.45, z);
      landscape.add(trunk, crown);
    });
    const buildingMat = new THREE.MeshStandardMaterial({ color: 0x59636a, roughness: 0.8, metalness: 0.08 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x353b3f, roughness: 0.9 });
    [[-12,-5,2.4,3.2],[-10,5,2.8,4.2],[10,-6,3.4,3.8],[11,4,2.6,4.8],[-5,12,3.6,3.1],[6,12,3.1,3.6]].forEach(([x,z,w,h], i) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.72), buildingMat);
      b.position.set(x, h / 2, z);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.15, 0.18, w * 0.72 + 0.15), roofMat);
      roof.position.set(x, h + 0.08, z);
      landscape.add(b, roof);
    });
    scene.add(landscape);

    let pinMeshes = [], routeLine = null, vehicle = null, roadMeshes = [];

    function rebuild() {
      pinMeshes.forEach((m) => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
      pinMeshes = [];
      roadMeshes.forEach((m) => { scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
      roadMeshes = [];
      if (routeLine) { scene.remove(routeLine); routeLine.geometry.dispose(); routeLine.material.dispose(); routeLine = null; }
      const n = Math.max(stateRef.current.total, 1);
      const pos = stopPositions(n, stateRef.current.perturb);
      stateRef.current.pos = pos;
      pos.forEach((v, i) => {
        const color = i === 0 ? 0x00e5ff : 0xa8ff00;
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(0.32, 1.05, 7),
          new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.3 })
        );
        cone.position.set(v.x, 0.52, v.z); scene.add(cone); pinMeshes.push(cone);
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(0.5, 0.72, 28),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2; ring.position.set(v.x, 0.02, v.z); scene.add(ring); pinMeshes.push(ring);
      });
      if (pos.length >= 2) {
        const roadCurve = new THREE.CatmullRomCurve3(pos.map((p) => new THREE.Vector3(p.x, 0, p.z)));
        const shoulder = new THREE.Mesh(
          roadRibbonGeometry(roadCurve, 3.05, 100, 0.008),
          new THREE.MeshStandardMaterial({ color: 0x7a786e, roughness: 0.95 })
        );
        const asphalt = new THREE.Mesh(
          roadRibbonGeometry(roadCurve, 2.45, 100, 0.025),
          new THREE.MeshStandardMaterial({ color: 0x25292d, roughness: 0.9, metalness: 0.05 })
        );
        scene.add(shoulder, asphalt);
        roadMeshes.push(shoulder, asphalt);

        const routeCurve = new THREE.CatmullRomCurve3(pos.map((p) => new THREE.Vector3(p.x, 0.12, p.z)));
        const tube = new THREE.Mesh(
          new THREE.TubeGeometry(routeCurve, 100, 0.105, 8, false),
          new THREE.MeshBasicMaterial({ color: 0xa8ff00, transparent: true, opacity: 0.94 })
        );
        scene.add(tube); routeLine = tube;
      }
      if (!vehicle) {
        vehicle = new THREE.Mesh(
          new THREE.SphereGeometry(0.4, 18, 18),
          new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xa8ff00, emissiveIntensity: 1.1 })
        );
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.75, 18, 18), new THREE.MeshBasicMaterial({ color: 0xa8ff00, transparent: true, opacity: 0.22 }));
        vehicle.add(glow);
        scene.add(vehicle);
      }
    }
    rebuildRef.current = rebuild;
    rebuild();

    let raf, camAngle = 0;
    function animate() {
      raf = requestAnimationFrame(animate);
      camAngle += 0.0014;
      const r = 15.5;
      camera.position.set(Math.sin(camAngle) * r, 8.2, Math.cos(camAngle) * r);
      camera.lookAt(0, 0, 0);
      if (stateRef.current.playing && stateRef.current.pos.length > 1) {
        stateRef.current.time = (stateRef.current.time + 0.0022) % 1;
        const pct = Math.round(stateRef.current.time * 100);
        if (pct !== stateRef.current.lastPct) { stateRef.current.lastPct = pct; setTime(stateRef.current.time); }
      }
      const pos = stateRef.current.pos;
      if (vehicle && pos.length) {
        const tt = stateRef.current.time * (pos.length - 1);
        const i = Math.floor(tt), f = tt - i;
        const a = pos[Math.min(i, pos.length - 1)], b = pos[Math.min(i + 1, pos.length - 1)];
        vehicle.position.set(a.x + (b.x - a.x) * f, 0.5, a.z + (b.z - a.z) * f);
      }
      renderer.render(scene, camera);
    }
    animate();

    const ro = new ResizeObserver(() => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    });
    ro.observe(el);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      pinMeshes.forEach((m) => { m.geometry.dispose(); m.material.dispose(); });
      roadMeshes.forEach((m) => { m.geometry.dispose(); m.material.dispose(); });
      if (routeLine) { routeLine.geometry.dispose(); routeLine.material.dispose(); }
      if (vehicle) { vehicle.geometry.dispose(); vehicle.material.dispose(); }
      ground.geometry.dispose(); ground.material.dispose();
      landscape.traverse((obj) => { if (obj.isMesh) { obj.geometry?.dispose(); obj.material?.dispose(); } });
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      rebuildRef.current = null;
    };
  }, []);

  function onTime(v) {
    setPlaying(false);
    stateRef.current.playing = false;
    stateRef.current.time = v;
    stateRef.current.lastPct = Math.round(v * 100);
    setTime(v);
  }
  function reroute() {
    setRerouting(true);
    setPlaying(false);
    stateRef.current.playing = false;
    setTimeout(() => {
      const next = (stateRef.current.perturb + 1);
      stateRef.current.perturb = next;
      if (rebuildRef.current) rebuildRef.current();
      setPlaying(true);
      setRerouting(false);
    }, 700);
  }

  async function onPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm((f) => ({ ...f, photo_url: file_url }));
    } catch {}
  }
  async function savePin() {
    if (!current?.id || saving) return;
    setSaving(true);
    try {
      const rec = await base44.entities.DropOffPin.create({
        offer_id: current.id,
        merchant: current.merchant || "",
        dropoff_address: current.dropoff_address || "",
        apt: form.apt, gate_code: form.gate_code, note: form.note, photo_url: form.photo_url,
      });
      setPins((p) => [rec, ...p]);
      setForm({ apt: "", gate_code: "", note: "", photo_url: "" });
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      {/* 3D scene */}
      <div className="relative rounded-3xl border border-accent/25 bg-black overflow-hidden glow-cyan">
        <div ref={containerRef} className="w-full" style={{ height: compact ? 200 : 360 }} />
        <div className="absolute inset-0 brand-grid opacity-20 pointer-events-none" />
        <div className="absolute top-2 left-3 flex items-center gap-1.5 text-[10px] tracking-[0.2em] text-accent/80 font-display">
          <Radar className="h-3.5 w-3.5" /> 4D AI GPS
        </div>
        <div className="absolute top-2 right-3 text-right">
          <div className="text-[9px] tracking-wider text-white/40">ETA · 4D</div>
          <div className="font-display text-sm font-bold text-accent text-glow-cyan">{etaRemaining}m</div>
        </div>
        {rerouting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="flex items-center gap-2 text-sm text-primary text-glow animate-pulse">
              <RefreshCw className="h-4 w-4 animate-spin" /> Re-routing live…
            </div>
          </div>
        )}
        {total === 0 && !loading && (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-white/50">No drop-offs to map.</div>
        )}
      </div>

      {/* Time (4th dimension) scrubber */}
      <div className="rounded-2xl border border-white/10 lokin-panel p-3">
        <div className="flex items-center justify-between text-[11px] text-white/50 mb-2">
          <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-accent" /> TIME · 4D SCRUB</span>
          <span>{Math.round(time * 100)}%</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setPlaying((p) => { stateRef.current.playing = !p; return !p; })}
            className="shrink-0 h-9 w-9 rounded-full border border-accent/40 bg-accent/10 text-accent flex items-center justify-center text-xs active:scale-95">
            {playing ? "❚❚" : "▶"}
          </button>
          <input type="range" min={0} max={1} step={0.001} value={time} onChange={(e) => onTime(parseFloat(e.target.value))}
            className="flex-1 accent-[#06d9f9]" />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <button onClick={reroute} className="text-[11px] flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-white/70 active:scale-95">
            <RefreshCw className="h-3 w-3 text-primary" /> Re-route live
          </button>
          <span className="text-[10px] text-white/40">{total} stops · sequence evolves over time</span>
        </div>
      </div>

      {compact ? (
        <Link to="/ai-gps" className="flex items-center justify-between rounded-2xl border border-primary/30 bg-primary/[0.06] p-3 active:scale-[0.99] transition-transform">
          <span className="text-sm font-semibold text-primary flex items-center gap-2"><Maximize2 className="h-4 w-4" /> Open full 4D AI GPS</span>
          <span className="text-xs text-white/50">precision pins · live re-route</span>
        </Link>
      ) : (
        <>
          {/* Precision drop-off pin capture */}
          {current && (
            <div className="rounded-3xl border border-white/10 lokin-panel p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-[11px] tracking-[0.18em] text-primary/80 font-display">PRECISION DROP-OFF · STOP {idx + 1}/{total}</div>
                <span className={`text-[11px] font-bold ${accuracy >= 100 ? "text-primary" : "text-white/50"}`}>{accuracy}% ACC</span>
              </div>
              <div className="font-semibold text-white">{current.merchant}</div>
              <div className="text-xs text-white/45 flex items-start gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                <span className="truncate">{current.dropoff_address || "—"}</span>
              </div>
              <div className="h-2 rounded-full bg-white/8 overflow-hidden">
                <div className="h-full rounded-full bg-primary" style={{ width: `${accuracy}%`, boxShadow: "0 0 8px hsl(80 100% 50% / 0.7)" }} />
              </div>

              {pins.length > 0 && (
                <div className="rounded-xl border border-primary/25 bg-primary/[0.06] p-2.5 text-xs text-white/80 flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate">Saved: {pins[0].apt ? `Apt ${pins[0].apt}` : "pin"}{pins[0].gate_code ? ` · gate ${pins[0].gate_code}` : ""}{pins[0].note ? ` · ${pins[0].note}` : ""}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <PinInput icon={Building2} placeholder="Apt / unit" value={form.apt} onChange={(v) => setForm((f) => ({ ...f, apt: v }))} />
                <PinInput icon={KeyRound} placeholder="Gate code" value={form.gate_code} onChange={(v) => setForm((f) => ({ ...f, gate_code: v }))} />
              </div>
              <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Drop-off note (e.g. side door, leave at porch)"
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/30" />
              <div className="flex gap-2">
                <label className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-sm text-white/60 flex items-center justify-center gap-2 cursor-pointer active:scale-95">
                  <Camera className="h-4 w-4 text-primary" /> {form.photo_url ? "Photo ✓" : "Drop photo"}
                  <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
                </label>
                <button onClick={savePin} disabled={saving}
                  className="flex-1 rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-bold glow-primary flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95">
                  <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save pin"}
                </button>
              </div>
            </div>
          )}

          {/* Stop list — click to jump the time scrub */}
          {total > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-semibold text-white/80">Drop-off sequence</div>
              {stops.map((o, i) => (
                <button key={o.id || i} onClick={() => onTime(total > 1 ? i / (total - 1) : 0)}
                  className={`w-full rounded-2xl border p-3 text-left ${i === idx ? "border-primary/40 bg-primary/[0.06]" : "border-white/10 lokin-panel"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white truncate">{i + 1}. {o.merchant}</span>
                    <span className="text-xs text-primary font-bold">${((o.payout || 0) + (o.tip || 0)).toFixed(2)}</span>
                  </div>
                  <div className="text-[11px] text-white/45 truncate">{o.dropoff_address || CATEGORY_LABELS[o.category] || o.category}</div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PinInput({ icon: Icon, placeholder, value, onChange }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3">
      <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-transparent py-2 text-sm text-white placeholder:text-white/30" />
    </div>
  );
}