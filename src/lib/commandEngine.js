// LOKIN Interface Engine — central command registry.
// One source of truth for every action the app can perform. The CommandEngine
// palette consumes this list; the LOKIN logo is the single entry point.

import {
  Home, Route as RouteIcon, BarChart3, Menu, Brain, Navigation, Fuel, ShoppingBag,
  Wifi, Search, Briefcase, LifeBuoy, LayoutGrid, SlidersHorizontal, Ban, ShieldAlert,
  Coffee, Truck, Calculator, Receipt, Flame, ScanLine, Radar, Power, Sparkles,
  Satellite, Plug, Wrench, Crown, TrendingUp, MapPin, Mic, Settings as SettingsIcon,
} from "lucide-react";

// A command is a single actionable intent. `run(navigate)` executes it.
// Most navigate to a route; voice actions route into the LOKIN AI assistant.
export const COMMAND_GROUPS = [
  {
    label: "Navigate",
    commands: [
      { id: "home", title: "Home", subtitle: "Dashboard & today's goal", icon: Home, keywords: ["start", "dashboard", "main"], run: (n) => n("/") },
      { id: "route", title: "Route Optimizer", subtitle: "Rank & sequence offers", icon: RouteIcon, keywords: ["optimize", "stops", "plan"], run: (n) => n("/route") },
      { id: "drive", title: "Driving Mode", subtitle: "Live route HUD", icon: Navigation, keywords: ["drive", "hud", "nav"], run: (n) => n("/drive") },
      { id: "ai-gps", title: "4D AI GPS", subtitle: "Spatial route scrubber", icon: Satellite, keywords: ["gps", "3d", "4d", "map"], run: (n) => n("/ai-gps") },
      { id: "earnings", title: "Earnings", subtitle: "Pace, profit & insights", icon: BarChart3, keywords: ["money", "income", "pay"], run: (n) => n("/earnings") },
      { id: "more", title: "More", subtitle: "All tools & settings", icon: Menu, keywords: ["menu", "tools", "all"], run: (n) => n("/more") },
    ],
  },
  {
    label: "Earn & Optimize",
    commands: [
      { id: "gigs", title: "Gig Opportunities", subtitle: "Extra paid field tasks", icon: Briefcase, keywords: ["task", "work", "shop"], run: (n) => n("/gigs") },
      { id: "opportunities", title: "Opportunity Scan", subtitle: "Weekly Hampton Roads courier jobs", icon: Radar, keywords: ["hampton", "roads", "courier", "job", "cannabis", "alcohol", "w2", "1099"], run: (n) => n("/opportunities") },
      { id: "showcase", title: "App Showcase", subtitle: "See the full LOKIN vision", icon: LayoutGrid, keywords: ["showcase", "demo", "vision", "brand", "landing"], run: (n) => n("/showcase") },
      { id: "fiveg", title: "5G Signal Boost", subtitle: "Enhanced cellular connectivity", icon: Wifi, keywords: ["5g", "signal", "cellular", "lte", "band", "boost", "network"], run: (n) => n("/5g") },
      { id: "hotspots", title: "Predictive Hotspots", subtitle: "Stronger earning zones", icon: Flame, keywords: ["zone", "heat", "busy"], run: (n) => n("/hotspots") },
      { id: "tax", title: "Tax Engine", subtitle: "Mileage & deductions", icon: Calculator, keywords: ["deduction", "irs", "write off"], run: (n) => n("/tax") },
      { id: "receipts", title: "Receipts", subtitle: "Purchase history", icon: Receipt, keywords: ["invoice", "spend"], run: (n) => n("/receipts") },
    ],
  },
  {
    label: "Road & Shopping",
    commands: [
      { id: "on-the-road", title: "Road Hub", subtitle: "Stops & road tools", icon: Truck, keywords: ["truck", "rest", "travel"], run: (n) => n("/on-the-road") },
      { id: "fuel", title: "Fuel", subtitle: "Discounts & cashback", icon: Fuel, keywords: ["gas", "discount", "price"], run: (n) => n("/fuel") },
      { id: "locator", title: "Shopping AI", subtitle: "Scan, beep, find the shelf", icon: ScanLine, keywords: ["find", "aisle", "barcode"], run: (n) => n("/locator") },
      { id: "shop-deliver", title: "Shop & Deliver", subtitle: "Map shopping runs", icon: ShoppingBag, keywords: ["shop", "deliver", "run"], run: (n) => n("/shop-deliver") },
      { id: "vehicle-care", title: "Vehicle Care", subtitle: "Maintenance logs", icon: Wrench, keywords: ["oil", "tire", "service"], run: (n) => n("/vehicle-care") },
    ],
  },
  {
    label: "Control Center",
    commands: [
      { id: "categories", title: "Work Filters", subtitle: "Choose the work you want", icon: SlidersHorizontal, keywords: ["filter", "accept", "prefer"], run: (n) => n("/categories") },
      { id: "avoid", title: "Avoid List", subtitle: "Block slow stops", icon: Ban, keywords: ["block", "bad", "skip"], run: (n) => n("/avoid") },
      { id: "safety", title: "Safety", subtitle: "SOS & sharing", icon: ShieldAlert, keywords: ["sos", "emergency", "help"], run: (n) => n("/safety") },
      { id: "break-time", title: "Break & Recharge", subtitle: "Music & reset", icon: Coffee, keywords: ["rest", "break", "recharge"], run: (n) => n("/break-time") },
      { id: "settings", title: "Settings", subtitle: "Goals, vehicle & prefs", icon: SettingsIcon, keywords: ["config", "goal", "vehicle"], run: (n) => n("/settings") },
    ],
  },
  {
    label: "LOKIN System",
    commands: [
      { id: "lokin", title: "LOKIN AI Voice", subtitle: "Hands-free assistant", icon: Brain, keywords: ["voice", "ai", "assistant", "talk"], run: (n) => n("/lokin") },
      { id: "connect", title: "AI Connections", subtitle: "ChatGPT & Claude", icon: Plug, keywords: ["mcp", "chatgpt", "claude"], run: (n) => n("/connect") },
      { id: "connectivity", title: "Stay Linked", subtitle: "Signal & network", icon: Wifi, keywords: ["network", "signal", "offline"], run: (n) => n("/connectivity") },
      { id: "brand", title: "LOKIN Brand", subtitle: "Apparel & gear", icon: Crown, keywords: ["store", "merch", "shop"], run: (n) => n("/brand") },
      { id: "support", title: "AI Support", subtitle: "Help & billing", icon: LifeBuoy, keywords: ["help", "bug", "ticket"], run: (n) => n("/support") },
    ],
  },
];

// Flatten for search/filter.
export const ALL_COMMANDS = COMMAND_GROUPS.flatMap((g) =>
  g.commands.map((c) => ({ ...c, group: g.label }))
);

// Simple fuzzy score: matches title and keywords, case-insensitive.
export function searchCommands(query) {
  const q = query.trim().toLowerCase();
  if (!q) return ALL_COMMANDS;
  return ALL_COMMANDS.filter((c) => {
    const hay = [c.title, c.subtitle, ...c.keywords].join(" ").toLowerCase();
    return q.split(/\s+/).every((tok) => hay.includes(tok));
  });
}