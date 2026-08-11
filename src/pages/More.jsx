import { Link } from "react-router-dom";
import { Route as RouteIcon, SlidersHorizontal, ScanLine, Fuel as FuelIcon, Ban, Settings as SettingsIcon, LogOut, Sparkles, Crown, ClipboardList, Receipt as ReceiptIcon, Headphones, Wrench, ShieldAlert } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PartnerApps from "@/components/PartnerApps";

const LINKS = [
  { to: "/pricing", icon: Crown, title: "Unlock Premium", desc: "Advanced routing & deeper AI", color: "text-primary" },
  { to: "/safety", icon: ShieldAlert, title: "Safety", desc: "SOS, location sharing & contacts", color: "text-destructive" },
  { to: "/gigs", icon: ClipboardList, title: "Gig Opportunities", desc: "Mystery shops & food reviews", color: "text-primary" },
  { to: "/receipts", icon: ReceiptIcon, title: "Receipts", desc: "Purchase history & invoices", color: "text-white/60" },
  { to: "/route", icon: RouteIcon, title: "AI Route Optimizer", desc: "Sequenced by mode for max $/hr", color: "text-primary" },
  { to: "/categories", icon: SlidersHorizontal, title: "Work Filters", desc: "Delivery types & blocked customers", color: "text-accent" },
  { to: "/locator", icon: ScanLine, title: "Shopping AI", desc: "Scan, beep, find the shelf", color: "text-primary" },
  { to: "/avoid", icon: Ban, title: "Avoid List", desc: "Customers, stores, locations", color: "text-destructive" },
  { to: "/fuel", icon: FuelIcon, title: "Gas Discounts", desc: "Weekly codes & cashback", color: "text-accent" },
  { to: "/vehicle-care", icon: Wrench, title: "Vehicle Care", desc: "Maintenance & mechanic finder", color: "text-primary" },
  { to: "/settings", icon: SettingsIcon, title: "Settings", desc: "MPG, fuel, goals, mileage cost", color: "text-primary" },
  { to: "/brand", icon: Sparkles, title: "LOKIN Brand", desc: "Brand system & apparel", color: "text-primary" },
  { to: "/support", icon: Headphones, title: "AI Support Rep", desc: "Get help, report bugs, billing", color: "text-accent" },
];

export default function More() {
  async function logout() {
    await base44.auth.logout("/login");
  }
  return (
    <div className="p-4 space-y-5">
      <h1 className="text-2xl font-bold font-heading metal-text">More</h1>
      <div className="grid grid-cols-2 gap-3">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="rounded-2xl border border-white/10 lokin-panel p-4 active:scale-[0.98] transition-transform">
            <l.icon className={`h-5 w-5 ${l.color} mb-2`} />
            <div className="text-sm font-semibold text-white">{l.title}</div>
            <div className="text-xs text-white/45 mt-0.5">{l.desc}</div>
          </Link>
        ))}
      </div>

      <PartnerApps />

      <button onClick={logout} className="w-full rounded-2xl border border-white/10 lokin-panel py-3 text-sm font-medium text-white/55 flex items-center justify-center gap-2">
        <LogOut className="h-4 w-4" /> Sign out
      </button>

      <div className="text-center text-[11px] tracking-[0.18em] text-white/30 pt-1">
        LOKIN AI · LOCK IN. MAKE MORE.<br />ONE APP. EVERY GIG. MAXIMUM EARNINGS.
      </div>
    </div>
  );
}