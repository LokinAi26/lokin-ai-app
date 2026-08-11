import { Link } from "react-router-dom";
import { Route as RouteIcon, SlidersHorizontal, ScanLine, Fuel as FuelIcon, Ban, Settings as SettingsIcon, LogOut } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PartnerApps from "@/components/PartnerApps";

const LINKS = [
  { to: "/route", icon: RouteIcon, title: "AI Route Optimizer", desc: "Sequenced by mode for max $/hr", color: "text-primary" },
  { to: "/categories", icon: SlidersHorizontal, title: "Work Filters", desc: "Delivery types & blocked customers", color: "text-accent" },
  { to: "/locator", icon: ScanLine, title: "Item Locator", desc: "Scan, beep, find the shelf", color: "text-primary" },
  { to: "/avoid", icon: Ban, title: "Avoid List", desc: "Customers, stores, locations", color: "text-destructive" },
  { to: "/fuel", icon: FuelIcon, title: "Gas Discounts", desc: "Weekly codes & cashback", color: "text-accent" },
  { to: "/settings", icon: SettingsIcon, title: "Settings", desc: "MPG, fuel, goals, mileage cost", color: "text-primary" },
];

export default function More() {
  async function logout() {
    await base44.auth.logout("/login");
  }
  return (
    <div className="p-4 space-y-5">
      <h1 className="text-2xl font-bold font-heading">More</h1>
      <div className="grid grid-cols-2 gap-3">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="rounded-2xl border border-border bg-card p-4 active:scale-[0.98] transition-transform">
            <l.icon className={`h-5 w-5 ${l.color} mb-2`} />
            <div className="text-sm font-semibold">{l.title}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{l.desc}</div>
          </Link>
        ))}
      </div>

      <PartnerApps />

      <button onClick={logout} className="w-full rounded-xl border border-border bg-card py-3 text-sm font-medium text-muted-foreground flex items-center justify-center gap-2">
        <LogOut className="h-4 w-4" /> Sign out
      </button>

      <div className="text-center text-[11px] text-muted-foreground pt-1">
        LOKIN AI · LOCK IN. MAKE MORE.<br />ONE APP. EVERY GIG. MAXIMUM EARNINGS.
      </div>
    </div>
  );
}