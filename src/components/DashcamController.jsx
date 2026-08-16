import { useEffect, useRef, useState } from "react";
import { Camera, Circle, Save, Square } from "lucide-react";
import { base44 } from "@/api/base44Client";

const DB = "lokin_dashcam";
const STORE = "clips";

function saveBlob(key, blob) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const tx = req.result.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    };
  });
}

function postNative(message) {
  try {
    if (window.webkit?.messageHandlers?.lokinDashcam?.postMessage) {
      window.webkit.messageHandlers.lokinDashcam.postMessage(message);
      return true;
    }
    if (window.LokinAndroidDashcam?.postMessage) {
      window.LokinAndroidDashcam.postMessage(JSON.stringify(message));
      return true;
    }
  } catch {}
  return false;
}

export default function DashcamController() {
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState("");
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const sessionRef = useRef(null);
  const startedRef = useRef(null);

  async function start(source = "manual") {
    if (recording) return;
    if (postNative({ type: "start", source })) {
      setRecording(true); setStatus("Native dashcam recording");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: true });
      const mime = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find(t => MediaRecorder.isTypeSupported?.(t));
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = e => { if (e.data?.size) chunksRef.current.push(e.data); };
      streamRef.current = stream;
      recorderRef.current = rec;
      startedRef.current = Date.now();
      const me = await base44.auth.me().catch(() => null);
      sessionRef.current = me?.id ? await base44.entities.DashcamSession.create({ user_id: me.id, status: "recording", started_at: new Date().toISOString(), source, storage_mode: "local_device", camera_facing: "environment", has_audio: true, incident_marked: false }).catch(() => null) : null;
      rec.start(1000);
      setRecording(true); setStatus("Recording locally on this device");
      window.dispatchEvent(new CustomEvent("lokin:dashcam-status", { detail: { recording: true, mode: "browser" } }));
    } catch (e) {
      setStatus(/permission|notallowed/i.test(String(e?.name)+String(e?.message)) ? "Camera or microphone permission is blocked" : "Dashcam could not start");
    }
  }

  async function stop({ incident = false } = {}) {
    if (postNative({ type: incident ? "saveIncident" : "stop" })) {
      setRecording(false); setStatus(incident ? "Incident saved by native dashcam" : "Dashcam stopped"); return;
    }
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") return;
    const stopped = new Promise(r => { rec.onstop = r; });
    rec.stop(); await stopped;
    streamRef.current?.getTracks?.().forEach(t => t.stop());
    const blob = new Blob(chunksRef.current, { type: rec.mimeType || "video/webm" });
    const key = `clip_${new Date().toISOString()}_${Math.random().toString(36).slice(2,8)}`;
    if (blob.size) await saveBlob(key, blob).catch(() => null);
    const ended = Date.now();
    if (sessionRef.current?.id) await base44.entities.DashcamSession.update(sessionRef.current.id, { status: "saved", stopped_at: new Date().toISOString(), duration_seconds: Math.round((ended - startedRef.current)/1000), incident_marked: Boolean(incident) }).catch(() => null);
    if (incident) {
      const me = await base44.auth.me().catch(() => null);
      let pos = null;
      try { pos = await new Promise((resolve) => navigator.geolocation.getCurrentPosition(p => resolve(p), () => resolve(null), { timeout: 4000 })); } catch {}
      if (me?.id) await base44.entities.DashcamIncident.create({ user_id: me.id, session_id: sessionRef.current?.id || "", marked_at: new Date().toISOString(), reason: "driver_marked_incident", latitude: pos?.coords?.latitude, longitude: pos?.coords?.longitude, local_clip_key: key, status: "saved_local" }).catch(() => null);
    }
    recorderRef.current = null; streamRef.current = null; chunksRef.current = [];
    setRecording(false); setStatus(incident ? "Incident clip saved locally" : "Dashcam clip saved locally");
    window.dispatchEvent(new CustomEvent("lokin:dashcam-status", { detail: { recording: false, saved: true, incident } }));
  }

  useEffect(() => {
    const onCommand = (e) => {
      const action = e?.detail?.action;
      if (action === "start") start(e?.detail?.source || "voice");
      if (action === "stop") stop({ incident: false });
      if (action === "incident") stop({ incident: true });
    };
    window.addEventListener("lokin:dashcam", onCommand);
    window.LOKINDashcam = { start, stop: () => stop({ incident:false }), saveIncident: () => stop({ incident:true }), isRecording: () => recording };
    return () => { window.removeEventListener("lokin:dashcam", onCommand); try { delete window.LOKINDashcam; } catch {} };
  }, [recording]);

  if (!recording && !status) return null;
  return <div className="fixed left-3 right-3 z-40 max-w-md mx-auto" style={{top:"calc(env(safe-area-inset-top) + 3.4rem)"}}>
    <div className={`rounded-2xl border px-3 py-2.5 glass flex items-center gap-3 ${recording ? "border-red-500/40" : "border-white/10"}`}>
      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${recording ? "bg-red-500/15" : "bg-white/5"}`}>{recording ? <Circle className="h-4 w-4 text-red-400 fill-current animate-pulse"/> : <Camera className="h-4 w-4 text-white/50"/>}</div>
      <div className="flex-1"><div className="text-xs font-bold">LOKIN DASHCAM {recording ? "REC" : ""}</div><div className="text-[10px] text-white/45">{status}</div></div>
      {recording && <><button onClick={()=>stop({incident:true})} className="rounded-lg border border-primary/30 px-2 py-1.5 text-[10px] text-primary flex items-center gap-1"><Save className="h-3 w-3"/>Incident</button><button onClick={()=>stop({incident:false})} className="rounded-lg border border-white/10 p-2"><Square className="h-3.5 w-3.5"/></button></>}
    </div>
  </div>;
}
