import { useEffect, useRef, useState } from "react";
import { ShieldAlert, Phone, Plus, Trash2, MapPin, Share2, Clock, UserPlus, MessageSquare } from "lucide-react";
import { base44 } from "@/api/base44Client";
import SecuritySentinel from "@/components/security/SecuritySentinel";

export default function Safety() {
  const [contacts, setContacts] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "", relationship: "" });
  const [location, setLocation] = useState(null);
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState("");
  const [shareMsg, setShareMsg] = useState("");
  const [fakeCallActive, setFakeCallActive] = useState(false);
  const [fakeDelay, setFakeDelay] = useState(30);
  const [countdown, setCountdown] = useState(null);
  const timerRef = useRef(null);

  async function load() {
    setContacts(await base44.entities.EmergencyContact.filter({}, "created_date"));
  }
  useEffect(() => { load(); }, []);
  useEffect(() => () => clearInterval(timerRef.current), []);

  async function addContact() {
    if (!newContact.name.trim() || !newContact.phone.trim()) return;
    const created = await base44.entities.EmergencyContact.create({
      name: newContact.name.trim(),
      phone: newContact.phone.trim(),
      relationship: newContact.relationship.trim(),
    });
    setContacts([created, ...contacts]);
    setNewContact({ name: "", phone: "", relationship: "" });
    setShowAdd(false);
  }

  async function removeContact(id) {
    const prev = contacts;
    setContacts(contacts.filter((c) => c.id !== id));
    try { await base44.entities.EmergencyContact.delete(id); } catch { setContacts(prev); }
  }

  function getLocation() {
    setLocLoading(true);
    setLocError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const url = `https://maps.google.com/?q=${latitude},${longitude}`;
        setLocation({ latitude, longitude, url });
        setShareMsg(`LOKIN Safety Alert: I may need help. My current location: ${url}`);
        setLocLoading(false);
      },
      () => {
        setLocError("Could not get location. Check permissions.");
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function call911() {
    window.location.href = "tel:911";
  }

  function sendSms(phone) {
    const msg = encodeURIComponent(shareMsg || "LOKIN Safety: I need help.");
    window.location.href = `sms:${phone}?&body=${msg}`;
  }

  async function shareLocation() {
    if (navigator.share) {
      try { await navigator.share({ title: "LOKIN Safety", text: shareMsg }); } catch {}
    } else if (contacts.length > 0) {
      sendSms(contacts[0].phone);
    }
  }

  function scheduleFakeCall() {
    if (timerRef.current) clearInterval(timerRef.current);
    let remaining = fakeDelay;
    setCountdown(remaining);
    timerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setCountdown(null);
        setFakeCallActive(true);
        if (navigator.vibrate) navigator.vibrate([500, 300, 500, 300, 500, 300, 500]);
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }

  function endFakeCall() {
    setFakeCallActive(false);
    if (navigator.vibrate) navigator.vibrate(0);
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-destructive" />
        <h1 className="text-xl font-bold font-heading metal-text">Safety</h1>
      </div>
      <p className="text-sm text-white/45 -mt-2">Emergency tools to keep you safe on the road.</p>

      <SecuritySentinel />

      {/* SOS */}
      <div className="rounded-3xl border border-destructive/30 bg-destructive/[0.06] p-5 text-center">
        <button onClick={call911} aria-label="Call 911"
          className="mx-auto flex h-32 w-32 items-center justify-center rounded-full border-4 border-destructive bg-destructive/10 active:scale-95 transition-transform"
          style={{ boxShadow: "0 0 24px -4px hsl(0 84% 60% / 0.6)" }}>
          <div className="flex flex-col items-center">
            <Phone className="h-9 w-9 text-destructive" />
            <span className="text-sm font-bold text-destructive mt-1">SOS</span>
          </div>
        </button>
        <div className="text-sm font-bold text-destructive mt-3">Call 911</div>
        <div className="text-xs text-white/45 mt-0.5">Tap to call emergency services</div>
      </div>

      {/* Share location */}
      <div className="rounded-3xl border border-white/10 lokin-panel p-4">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="h-4 w-4 text-accent" />
          <div className="text-sm font-semibold text-white/80">Share My Location</div>
        </div>
        <p className="text-xs text-white/45 mb-3">Send your live location to your emergency contacts.</p>
        {!location ? (
          <button onClick={getLocation} disabled={locLoading}
            className="w-full rounded-xl border border-accent/40 bg-accent/10 py-2.5 text-sm font-bold text-accent glow-cyan disabled:opacity-60 flex items-center justify-center gap-2">
            <MapPin className="h-4 w-4" /> {locLoading ? "Getting location…" : "Get my location"}
          </button>
        ) : (
          <div className="space-y-2">
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="text-xs text-white/50">{shareMsg}</div>
              <a href={location.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary mt-1 block">View on map →</a>
            </div>
            <div className="flex gap-2">
              <button onClick={shareLocation} className="flex-1 rounded-xl bg-accent text-accent-foreground py-2.5 text-sm font-bold glow-cyan flex items-center justify-center gap-2">
                <Share2 className="h-4 w-4" /> Share
              </button>
              <button onClick={getLocation} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white/60">Refresh</button>
            </div>
            {contacts.length > 0 && (
              <div className="pt-1">
                <div className="text-xs text-white/45 mb-1.5">Send to contact:</div>
                <div className="flex flex-wrap gap-2">
                  {contacts.map((c) => (
                    <button key={c.id} onClick={() => sendSms(c.phone)}
                      className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70">
                      <MessageSquare className="h-3 w-3" /> {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {locError && !location && <div className="text-xs text-destructive mt-2">{locError}</div>}
      </div>

      {/* Emergency contacts */}
      <div className="rounded-3xl border border-white/10 lokin-panel p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <div className="text-sm font-semibold text-white/80">Emergency Contacts</div>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
        {showAdd && (
          <div className="space-y-2 mb-3">
            <input value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} placeholder="Name"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30" />
            <input value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} placeholder="Phone number"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30" />
            <input value={newContact.relationship} onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })} placeholder="Relationship (optional)"
              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-white/30" />
            <button onClick={addContact} disabled={!newContact.name.trim() || !newContact.phone.trim()}
              className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-bold disabled:opacity-60 glow-primary">
              Save contact
            </button>
          </div>
        )}
        {contacts.length === 0 ? (
          <div className="text-sm text-white/45 text-center py-3">No emergency contacts yet.</div>
        ) : (
          <div className="space-y-2">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-3">
                <div>
                  <div className="text-sm font-medium text-white">{c.name}</div>
                  <div className="text-xs text-white/45">{c.phone}{c.relationship ? ` · ${c.relationship}` : ""}</div>
                </div>
                <div className="flex items-center gap-1">
                  <a href={`tel:${c.phone}`} aria-label={`Call ${c.name}`} className="text-primary p-1.5"><Phone className="h-4 w-4" /></a>
                  <a href={`sms:${c.phone}`} aria-label={`Text ${c.name}`} className="text-accent p-1.5"><MessageSquare className="h-4 w-4" /></a>
                  <button onClick={() => removeContact(c.id)} aria-label="Remove contact" className="text-destructive p-1.5"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fake incoming call */}
      <div className="rounded-3xl border border-white/10 lokin-panel p-4">
        <div className="flex items-center gap-2 mb-2">
          <Phone className="h-4 w-4 text-primary" />
          <div className="text-sm font-semibold text-white/80">Fake Incoming Call</div>
        </div>
        <p className="text-xs text-white/45 mb-3">Schedule a call to exit uncomfortable situations.</p>
        <div className="flex gap-2 mb-3">
          {[15, 30, 60, 300].map((s) => (
            <button key={s} onClick={() => setFakeDelay(s)}
              className={`flex-1 rounded-xl border px-2 py-2 text-xs font-medium ${fakeDelay === s ? "border-primary bg-primary/15 text-primary" : "border-white/10 bg-white/[0.03] text-white/50"}`}>
              {s < 60 ? `${s}s` : `${s / 60}m`}
            </button>
          ))}
        </div>
        <button onClick={scheduleFakeCall} disabled={countdown !== null}
          className="w-full rounded-xl border border-primary/40 bg-primary/10 py-2.5 text-sm font-bold text-primary flex items-center justify-center gap-2 disabled:opacity-60">
          <Clock className="h-4 w-4" />
          {countdown !== null ? `Calling in ${countdown}s…` : `Schedule fake call (${fakeDelay < 60 ? `${fakeDelay}s` : `${fakeDelay / 60}m`})`}
        </button>
      </div>

      {/* Fake call overlay */}
      {fakeCallActive && (
        <div className="fixed inset-0 z-[100] bg-gradient-to-b from-neutral-900 to-black flex flex-col items-center justify-between py-20 select-none">
          <div className="flex flex-col items-center">
            <div className="text-white/50 text-sm mb-2">Incoming call…</div>
            <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center mb-4">
              <Phone className="h-10 w-10 text-white/60" />
            </div>
            <div className="text-3xl font-bold text-white">Unknown Number</div>
            <div className="text-white/40 text-sm mt-1">Mobile</div>
          </div>
          <div className="flex gap-16">
            <button onClick={endFakeCall} className="flex flex-col items-center gap-2">
              <div className="h-16 w-16 rounded-full bg-red-500 flex items-center justify-center">
                <Phone className="h-7 w-7 text-white rotate-[135deg]" />
              </div>
              <span className="text-xs text-white/60">Decline</span>
            </button>
            <button onClick={endFakeCall} className="flex flex-col items-center gap-2">
              <div className="h-16 w-16 rounded-full bg-green-500 flex items-center justify-center">
                <Phone className="h-7 w-7 text-white" />
              </div>
              <span className="text-xs text-white/60">Accept</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}