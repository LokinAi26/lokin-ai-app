import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SlidersHorizontal, ScanLine, ShoppingBag, Fuel as FuelIcon, Ban, Settings as SettingsIcon, LogOut, Sparkles, ClipboardList, Receipt as ReceiptIcon, Headphones, ShieldAlert, Coffee, Truck, Flame, Calculator, Plug, Radar, Smartphone, Signal, Package, GraduationCap, Store, BadgeCheck, Building2, Link2, Leaf, ShieldCheck, ChevronDown, Wallet, Route as Road, Shield, Cpu, BadgeDollarSign } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import PartnerApps from "@/components/PartnerApps";
import { RELEASE_FLAGS } from "@/lib/releaseFlags";

const SECTIONS = [
  {
    id: "earn",
    label: "Earn & Optimize",
    icon: Wallet,
    color: "text-primary",
    items: [
      { to: "/opportunities", icon: Radar, title: "Live Jobs", desc: "Verified current openings" },
      { to: "/gigs", icon: ClipboardList, title: "Live Paid Research", desc: "Mystery shops, food reviews & tests" },
      { to: "/hotspots", icon: Flame, title: "Hotspot Model Preview", desc: "Simulated earning-zone scenarios" },
      { to: "/tax", icon: Calculator, title: "Tax Engine", desc: "Mileage & deductions" },
      { to: "/receipts", icon: ReceiptIcon, title: "Receipts", desc: "Purchase history" },
    ],
  },
  {
    id: "road",
    label: "Road & Shopping",
    icon: Road,
    color: "text-accent",
    items: [
      { to: "/5g", icon: Signal, title: "Connection Diagnostics", desc: "Device-reported network metrics" },
      { to: "/active-delivery", icon: Package, title: "Active Delivery", desc: "Live order status" },
      { to: "/driver-dispatch", icon: Truck, title: "AI Dispatch Center", desc: "Truck freight + local pickups" },
      { to: "/on-the-road", icon: Truck, title: "Road Hub", desc: "Stops & road tools" },
      { to: "/fuel", icon: FuelIcon, title: "Fuel", desc: "Discounts & costs" },
      { to: "/locator", icon: ScanLine, title: "Shopping AI", desc: "Scan & find the shelf" },
      { to: "/shop-deliver", icon: ShoppingBag, title: "Shop & Deliver", desc: "Manage shopping runs" },
    ],
  },
  {
    id: "market",
    label: "Marketplace & Coverage",
    icon: Store,
    color: "text-primary",
    items: [
      { to: "/stash", icon: Leaf, title: "LOKIN Green", desc: "Discreet cannabis ordering", requires: "cannabis" },
      { to: "/green-delivery", icon: Truck, title: "Green Delivery", desc: "Certified cannabis orders", requires: "cannabis" },
      { to: "/insurance", icon: ShieldCheck, title: "LOKIN Cover", desc: "Gig & commercial insurance", requires: "insurance" },
    ],
  },
  {
    id: "control",
    label: "Control Center",
    icon: Shield,
    color: "text-destructive",
    items: [
      { to: "/categories", icon: SlidersHorizontal, title: "Work Filters", desc: "Choose your work" },
      { to: "/avoid", icon: Ban, title: "Avoid List", desc: "Block unwanted stops" },
      { to: "/safety", icon: ShieldAlert, title: "Safety", desc: "SOS & emergency tools" },
      { to: "/break-time", icon: Coffee, title: "Break & Recharge", desc: "Music & reset" },
    ],
  },
  {
    id: "system",
    label: "LOKIN System",
    icon: Cpu,
    color: "text-accent",
    items: [
      { to: "/certified", icon: GraduationCap, title: "LOKIN Certified", desc: "Driver academy" },
      { to: "/merchant-hub", icon: Store, title: "Merchant Hub", desc: "Pilot partners" },
      { to: "/merchant-portal", icon: Building2, title: "Merchant Portal", desc: "Pickups & drivers" },
      { to: "/compliance-handoff", icon: BadgeCheck, title: "Verified Handoff", desc: "ID check workflow" },
      { to: "/oasis", icon: Sparkles, title: "LOKIN OASIS", desc: "Ideas into products and profit" },
      { to: "/brand", icon: Sparkles, title: "LOKIN Brand", desc: "Apparel & gear" },
      { to: "/settings", icon: SettingsIcon, title: "Settings", desc: "Goals & vehicle" },
      { to: "/support", icon: Headphones, title: "AI Support", desc: "Help & billing" },
      { to: "/connect", icon: Plug, title: "AI Connections", desc: "ChatGPT, Claude, Cursor" },
      { to: "/insurance-admin", icon: ShieldCheck, title: "Cover Admin", desc: "Bind insurance apps" },
      { to: "/printful-connect", icon: Link2, title: "Printful Connect", desc: "OAuth account tools" },
      { to: "/showcase", icon: Smartphone, title: "App Showcase", desc: "The LOKIN vision" },
      { to: "/funding-command", icon: BadgeDollarSign, title: "Funding Command", desc: "Virginia grants, contracts & readiness", requires: "admin" },
    ],
  },
];

function Section({ section, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const SIcon = section.icon;
  return (
    <div className="rounded-2xl border border-white/10 lokin-panel overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-white/[0.03] transition-colors"
      >
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 ${section.color}`}>
          <SIcon className="h-4 w-4" />
        </div>
        <div className="flex-1 text-left">
          <div className="text-sm font-semibold text-white">{section.label}</div>
          <div className="text-[11px] text-white/55">{section.items.length} features</div>
        </div>
        <ChevronDown className={`h-4 w-4 text-white/55 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <div className="px-2 pb-2 divide-y divide-white/10">
              {section.items.map((l) => (
                <Link key={l.to} to={l.to} className="flex items-center gap-3 px-2 py-2.5 active:bg-white/[0.03] rounded-xl transition-colors">
                  <l.icon className="h-4 w-4 text-white/55 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-white truncate">{l.title}</div>
                    <div className="text-[11px] text-white/55 truncate">{l.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function More() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let alive = true;
    base44.auth.me().then((user) => { if (alive) setIsAdmin(user?.role === "admin"); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const visibleSections = SECTIONS.map((section) => ({ ...section, items: section.items.filter((item) => item.requires === "cannabis" ? RELEASE_FLAGS.regulatedCannabis : item.requires === "insurance" ? RELEASE_FLAGS.insuranceTransactions : item.requires === "admin" ? isAdmin : true) })).filter((section) => section.items.length > 0);
  async function logout() {
    await base44.auth.logout("/login");
  }
  return (
    <div className="p-4 space-y-3 pb-8">
      <h1 className="text-2xl font-bold font-heading metal-text">More</h1>

      {visibleSections.map((s, i) => (
        <Section key={s.id} section={s} defaultOpen={i === 0} />
      ))}

      <PartnerApps />

      <button onClick={logout} className="w-full rounded-2xl border border-white/10 lokin-panel py-3 text-sm font-medium text-white/55 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
        <LogOut className="h-4 w-4" /> Sign out
      </button>

      <div className="text-center text-[11px] tracking-[0.18em] text-white/45 pt-1">
        LOKIN AI · LOCK IN. LEVEL UP.<br />DRIVE SAFER. WORK SMARTER. LIVE SIMPLER.
      </div>
    </div>
  );
}