import { Link } from "react-router-dom";
import { Route as RouteIcon, SlidersHorizontal, ScanLine, ShoppingBag, Fuel as FuelIcon, Ban, Settings as SettingsIcon, LogOut, Sparkles, Crown, ClipboardList, Receipt as ReceiptIcon, Headphones, Wrench, ShieldAlert, Coffee, Truck, Car, Zap, Flame, Calculator, Satellite, Plug, Radar, Smartphone, Signal, Package, GraduationCap, Store, BadgeCheck, Building2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PartnerApps from "@/components/PartnerApps";

const GROUPS = [
  {
    label: "Earn & Optimize",
    items: [
      { to: "/opportunities", icon: Radar, title: "Opportunity Scan", desc: "Weekly Hampton Roads courier jobs", color: "text-primary" },
      { to: "/gigs", icon: ClipboardList, title: "Gig Opportunities", desc: "Extra paid work & field tasks", color: "text-primary" },
      { to: "/hotspots", icon: Flame, title: "Predictive Hotspots", desc: "Find stronger earning zones", color: "text-primary" },
      { to: "/tax", icon: Calculator, title: "Tax Engine", desc: "Mileage, deductions & estimates", color: "text-primary" },
      { to: "/receipts", icon: ReceiptIcon, title: "Receipts", desc: "Purchase history & invoices", color: "text-white/60" },
    ],
  },
  {
    label: "Road & Shopping",
    items: [
      { to: "/5g", icon: Signal, title: "5G Signal Boost", desc: "Enhanced cellular connectivity", color: "text-primary" },
      { to: "/active-delivery", icon: Package, title: "Active Delivery", desc: "Live order, status & auto-updates", color: "text-primary" },
      { to: "/driver-dispatch", icon: Truck, title: "Merchant Pickups", desc: "Accept pilot pickup offers & lock into GPS", color: "text-primary" },
      { to: "/on-the-road", icon: Truck, title: "Road Hub", desc: "Stops, rest areas & road tools", color: "text-accent" },
      { to: "/fuel", icon: FuelIcon, title: "Fuel", desc: "Discounts, cashback & costs", color: "text-accent" },
      { to: "/locator", icon: ScanLine, title: "Shopping AI", desc: "Scan, beep, find the shelf", color: "text-primary" },
      { to: "/shop-deliver", icon: ShoppingBag, title: "Shop & Deliver", desc: "Map and manage shopping runs", color: "text-primary" },
    ],
  },
  {
    label: "Control Center",
    items: [
      { to: "/categories", icon: SlidersHorizontal, title: "Work Filters", desc: "Choose the work you want", color: "text-accent" },
      { to: "/avoid", icon: Ban, title: "Avoid List", desc: "Block slow or unwanted stops", color: "text-destructive" },
      { to: "/safety", icon: ShieldAlert, title: "Safety", desc: "SOS, sharing & emergency tools", color: "text-destructive" },
      { to: "/break-time", icon: Coffee, title: "Break & Recharge", desc: "Music, reset & recharge", color: "text-primary" },
    ],
  },
  {
    label: "LOKIN System",
    items: [
      { to: "/certified", icon: GraduationCap, title: "LOKIN Certified", desc: "Driver academy & regulated-delivery training", color: "text-primary" },
      { to: "/merchant-hub", icon: Store, title: "Merchant Hub", desc: "Pilot partners, onboarding & compliance gates", color: "text-primary" },
      { to: "/merchant-portal", icon: Building2, title: "Merchant Portal", desc: "Pickup requests, orders & certified drivers", color: "text-primary" },
      { to: "/compliance-handoff", icon: BadgeCheck, title: "Verified Handoff", desc: "ID check, refusal, return & audit workflow", color: "text-accent" },
      { to: "/brand", icon: Sparkles, title: "LOKIN Brand", desc: "Apparel, gear & commerce", color: "text-primary" },
      { to: "/settings", icon: SettingsIcon, title: "Settings", desc: "Goals, vehicle & preferences", color: "text-primary" },
      { to: "/support", icon: Headphones, title: "AI Support", desc: "Help, bugs & billing", color: "text-accent" },
      { to: "/connect", icon: Plug, title: "AI Connections", desc: "ChatGPT, Claude & Cursor", color: "text-accent" },
      { to: "/showcase", icon: Smartphone, title: "App Showcase", desc: "See the full LOKIN vision", color: "text-primary" },
    ],
  },
];

export default function More() {
  async function logout() {
    await base44.auth.logout("/login");
  }
  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold font-heading metal-text">More</h1>

      {GROUPS.map((g) => (
        <div key={g.label}>
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="text-[11px] tracking-[0.22em] text-white/40 font-display">{g.label.toUpperCase()}</span>
            <div className="flex-1 h-px bg-white/8" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {g.items.map((l) => (
              <Link key={l.to} to={l.to} className="rounded-2xl border border-white/10 lokin-panel p-4 active:scale-[0.98] transition-transform">
                <l.icon className={`h-5 w-5 ${l.color} mb-2`} />
                <div className="text-sm font-semibold text-white">{l.title}</div>
                <div className="text-xs text-white/45 mt-0.5">{l.desc}</div>
              </Link>
            ))}
          </div>
        </div>
      ))}

      <PartnerApps />

      <button onClick={logout} className="w-full rounded-2xl border border-white/10 lokin-panel py-3 text-sm font-medium text-white/55 flex items-center justify-center gap-2">
        <LogOut className="h-4 w-4" /> Sign out
      </button>

      <div className="text-center text-[11px] tracking-[0.18em] text-white/30 pt-1">
        LOKIN AI · LOCK IN. MAKE MORE.<br />ONE APP. EVERY MILE. EVERY DRIVER. EVERY TRIP.
      </div>
    </div>
  );
}