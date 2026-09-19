import { useState } from "react";
import { Search } from "lucide-react";
import ApparelMockup from "@/components/ApparelMockup";

// Full LOKIN catalog — 25 categories, 92 products.
// Apparel + delivery systems from the Driver Collection poster,
// plus the 7-piece Delivery Hardware ecosystem lineup.
// Mockup variants map each item to the closest ApparelMockup visual;
// Printful carries apparel + totes + socks; specialty food-delivery gear
// is shown here as the LOKIN collection and created in Printful where supported.
const SECTIONS = [
  {
    title: "Apparel Collection",
    items: [
      { variant: "hoodie", name: "AI Pullover Hoodie", sub: "Signature lockup" },
      { variant: "hoodie", name: "AI Tech Jacket", sub: "Driver tech shell" },
      { variant: "tee", name: "Sleeve Detail Tee", sub: "Long sleeve" },
      { variant: "cap", name: "LOKIN Bucket Hat", sub: "Embroidered lock mark" },
      { variant: "tee", name: "Long Sleeve Tee", sub: "Signature lockup" },
    ],
  },
  {
    title: "Driver Collection",
    items: [
      { variant: "hoodie", name: "Driver Hoodie", sub: "Hi-vis trim" },
      { variant: "tee", name: "Driver Polo", sub: "Reflective logo" },
      { variant: "hoodie", name: "Reflective Driver Jacket", sub: "Night visibility" },
      { variant: "tee", name: "Hi-Vis Driver Vest", sub: "ANSI-style panels" },
    ],
  },
  {
    title: "Bottoms & Headwear",
    items: [
      { variant: "tee", name: "Driver Joggers", sub: "Athletic fit" },
      { variant: "cap", name: "LOKIN Snapback", sub: "Embroidered lock mark" },
      { variant: "shiesty", name: "Driver Beanie", sub: "Thermal knit" },
    ],
  },
  {
    title: "Rain Gear Collection",
    items: [
      { variant: "hoodie", name: "Rain Jacket", sub: "Waterproof shell" },
      { variant: "hoodie", name: "Long Rain Coat", sub: "Full coverage" },
      { variant: "hoodie", name: "Driver Poncho", sub: "Packable" },
      { variant: "hoodie", name: "Packable Rain Jacket", sub: "Packs to pouch" },
    ],
  },
  {
    title: "Winter Headgear",
    items: [
      { variant: "hoodie", name: "Thermal Hoodie", sub: "Fleece-lined" },
      { variant: "shiesty", name: "Ski Mask", sub: "Full-face thermal" },
      { variant: "shiesty", name: "LOKIN Balaclava", sub: "Fleece · One size" },
      { variant: "shiesty", name: "Neck Gaiter", sub: "Fleece tube" },
      { variant: "shiesty", name: "Winter Beanie", sub: "Thermal knit" },
    ],
  },
  {
    title: "Winter Outerwear",
    items: [
      { variant: "hoodie", name: "Insulated Winter Coat", sub: "Heavy fill" },
      { variant: "hoodie", name: "Driver Puffer Jacket", sub: "Packable warmth" },
    ],
  },
  {
    title: "Glow in the Dark",
    items: [
      { variant: "hoodie", name: "Glow Hoodie", sub: "Glow-in-the-dark print" },
      { variant: "tee", name: "Glow Tee", sub: "Glow-in-the-dark print" },
      { variant: "hoodie", name: "Glow Jacket", sub: "Glow-in-the-dark print" },
      { variant: "hoodie", name: "Glow Sweatshirt", sub: "Glow-in-the-dark print" },
    ],
  },
  {
    title: "Pizza Bags — Insulated",
    items: [
      { variant: "pizza", name: "Pizza Bag · Small", sub: "18\" · 1-pie" },
      { variant: "pizza", name: "Pizza Bag · Medium", sub: "20\" · 2-pie" },
      { variant: "pizza", name: "Pizza Bag · Large", sub: "24\" · 3-pie" },
      { variant: "pizza", name: "Pizza Bag · XL", sub: "Multi-pie" },
      { variant: "pizza", name: "Pizza Bag · XXL", sub: "Catering size" },
    ],
  },
  {
    title: "Catering Bags — Insulated",
    items: [
      { variant: "catering", name: "Catering Bag · Compact", sub: "13\" × 10\" × 9\"" },
      { variant: "catering", name: "Catering Bag · Medium", sub: "18\" × 14\" × 12\"" },
      { variant: "catering", name: "Catering Bag · Large", sub: "22\" × 16\" × 13\"" },
      { variant: "catering", name: "Catering Bag · XL", sub: "26\" × 18\" × 14\"" },
    ],
  },
  {
    title: "Tote Bags — Delivery",
    items: [
      { variant: "tote", name: "LOKIN Tote · Small", sub: "Everyday carry" },
      { variant: "tote", name: "LOKIN Tote · Medium", sub: "Grocery runs" },
      { variant: "tote", name: "LOKIN Tote · Large", sub: "Bulk hauls" },
    ],
  },
  {
    title: "Drink Cup Holders",
    items: [
      { variant: "cupholder", name: "Cup Carrier · 2-Cup", sub: "Spill-proof slots" },
      { variant: "cupholder", name: "Cup Carrier · 4-Cup", sub: "Spill-proof slots" },
      { variant: "cupholder", name: "Cup Carrier · 6-Cup", sub: "Spill-proof slots" },
    ],
  },
  {
    title: "Food Warming & Transport",
    items: [
      { variant: "delivery", name: "Insulated Food Blanket", sub: "Hot/cold hold" },
      { variant: "delivery", name: "Insulated Bag Cover", sub: "Extra layer" },
      { variant: "delivery", name: "Hot/Cold Gel Pack", sub: "Reusable" },
      { variant: "delivery", name: "Thermal Foil Liner", sub: "Heat reflector" },
    ],
  },
  {
    title: "Bags & Carry Gear",
    items: [
      { variant: "tote", name: "Shoulder Delivery Bag", sub: "Padded strap" },
      { variant: "tote", name: "Driver Fanny Pack", sub: "Quick access" },
      { variant: "tote", name: "Chest Bag", sub: "Ride-ready" },
      { variant: "tote", name: "Crossbody Bag", sub: "Secure fit" },
    ],
  },
  {
    title: "Bike Delivery Gear",
    items: [
      { variant: "delivery", name: "Bike Delivery Bag", sub: "Frame-mount ready" },
      { variant: "delivery", name: "Handlebar Bag", sub: "Quick access" },
      { variant: "delivery", name: "Pannier Bags · Pair", sub: "Rack-mount" },
    ],
  },
  {
    title: "Comfort on the Go",
    items: [
      { variant: "seatcushion", name: "Travel Pillow", sub: "Memory foam" },
      { variant: "seatcushion", name: "Neck Pillow", sub: "Memory foam" },
    ],
  },
  {
    title: "Comfort Seat & Support",
    items: [
      { variant: "seatcushion", name: "Driver Seat Cushion", sub: "Mesh · breathable" },
      { variant: "seatcushion", name: "Lumbar Support Cushion", sub: "Driver back support" },
      { variant: "massagecover", name: "Massage Seat Cover", sub: "Vibration nodes" },
    ],
  },
  {
    title: "Moisture-Wicking Socks",
    items: [
      { variant: "socks", name: "Socks · Summer Low-Cut 3-Pack", sub: "Cool & dry" },
      { variant: "socks", name: "Socks · Summer Crew 3-Pack", sub: "Cool & dry" },
      { variant: "socks", name: "Socks · Winter Crew 3-Pack", sub: "Thermal" },
    ],
  },
  {
    title: "Safety & Light Protection",
    items: [
      { variant: "selfdefense", name: "Safety Glasses", sub: "Impact-rated" },
      { variant: "selfdefense", name: "Anti-Glare Glasses", sub: "Day driving" },
      { variant: "selfdefense", name: "Night Vision Glasses", sub: "Low-light" },
      { variant: "selfdefense", name: "UV Protection Sleeves", sub: "Sun defense" },
      { variant: "selfdefense", name: "Hand Warmers", sub: "Reusable" },
    ],
  },
  {
    title: "Stay Warm & Protected",
    items: [
      { variant: "selfdefense", name: "Heated Gloves", sub: "Battery-powered" },
      { variant: "selfdefense", name: "Winter Work Gloves", sub: "Grip & warmth" },
    ],
  },
  {
    title: "Tech & Phone Accessories",
    items: [
      { variant: "selfdefense", name: "Bike/Moto Phone Holder", sub: "Handlebar mount" },
      { variant: "selfdefense", name: "Magnetic Phone Mount", sub: "Dash mount" },
      { variant: "selfdefense", name: "Waterproof Phone Pouch", sub: "Touch-through" },
    ],
  },
  {
    title: "Lanyards & Keychains",
    items: [
      { variant: "sticker", name: "LOKIN Lanyard", sub: "Breakaway clasp" },
      { variant: "sticker", name: "Retractable Keychain", sub: "Belt clip" },
      { variant: "sticker", name: "LOKIN Keychain", sub: "Lock mark fob" },
    ],
  },
  {
    title: "Delivery Tools & Accessories",
    items: [
      { variant: "selfdefense", name: "Insulated Water Bottle", sub: "24-hr cold" },
      { variant: "selfdefense", name: "Mini Flashlight", sub: "Pocket beam" },
      { variant: "selfdefense", name: "Portable Tire Inflator", sub: "Roadside ready" },
      { variant: "selfdefense", name: "Multi-Tool Card", sub: "Wallet size" },
      { variant: "sticker", name: "LOKIN Enamel Pin", sub: "Lock mark" },
    ],
  },
  {
    title: "Safety & Visibility",
    items: [
      { variant: "selfdefense", name: "LED Safety Light", sub: "Clip-on beacon" },
      { variant: "selfdefense", name: "Reflective Strap", sub: "Arm/ankle band" },
      { variant: "sticker", name: "Reflective Sticker Pack", sub: "Night visibility" },
    ],
  },
  {
    title: "Brand Extras",
    items: [
      { variant: "sticker", name: "LOKIN Sticker Pack", sub: "Signature lockup" },
      { variant: "sticker", name: "LOKIN Car Decal", sub: "Vinyl · weatherproof" },
      { variant: "sticker", name: "License Plate Frame", sub: "Chrome lock mark" },
    ],
  },
  {
    title: "Delivery Hardware",
    items: [
      { variant: "delivery", name: "Insulated Rolling Delivery Bag", sub: "16\"L × 14\"W × 16\"H · Hot/cold for hours" },
      { variant: "delivery", name: "Foldable Wagon / Cart", sub: "36\"L × 24\"W × 20\"H · 200+ lb" },
      { variant: "delivery", name: "Stair Climber Hand Truck", sub: "20\"W × 16\"D × 52\"H · Tri-wheel assist" },
      { variant: "delivery", name: "Package Rolling Tote", sub: "22\"H × 14\"W × 12\"D · Route-ready" },
      { variant: "delivery", name: "Foldable Package Delivery Cart", sub: "36\"L × 24\"W × 20\"H · 200+ lb" },
      { variant: "delivery", name: "Trunk / Rear Seat Organizer", sub: "36\"L × 16\"W × 10\"H · Anti-slip" },
      { variant: "delivery", name: "Car Dividing Tray", sub: "36\"L × 34\"W × 10\"H · Modular" },
    ],
  },
];

function matchesItem(it, words) {
  const hay = `${it.name} ${it.sub}`.toLowerCase();
  return words.every((w) => hay.includes(w));
}

export default function GearShowcase() {
  const [query, setQuery] = useState("");
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const total = SECTIONS.reduce((n, s) => n + s.items.length, 0);
  const visible = words.length
    ? SECTIONS.map((s) => ({ ...s, items: s.items.filter((it) => matchesItem(it, words)) })).filter((s) => s.items.length > 0)
    : SECTIONS;
  const shown = visible.reduce((n, s) => n + s.items.length, 0);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="text-[11px] tracking-[0.24em] text-white/40 font-display">THE COLLECTION · LOKIN GEAR</div>
        <div className="h-px flex-1 bg-white/8" />
        <span className="text-[10px] text-white/35">{total} ITEMS</span>
      </div>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" style={{ width: 16, height: 16 }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the catalog…"
          className="w-full rounded-2xl border border-white/10 bg-black/40 pl-9 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/50"
        />
      </div>
      {words.length > 0 && (
        <div className="text-[11px] text-white/40 mb-3">
          {shown} of {total} items
        </div>
      )}
      {visible.length === 0 ? (
        <div className="rounded-2xl border border-white/10 lokin-panel p-6 text-center text-sm text-white/50">
          No gear matches &ldquo;{query}&rdquo;. Try another word.
        </div>
      ) : (
        <div className="space-y-5">
          {visible.map((s) => (
            <div key={s.title}>
              <div className="flex items-center gap-2 mb-2">
                <div className="text-sm font-bold text-white">{s.title}</div>
                <div className="h-px flex-1 bg-white/8" />
                <span className="text-[10px] text-white/35">{s.items.length}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {s.items.map((it) => (
                  <div
                    key={it.name + it.sub}
                    className="rounded-2xl border border-white/10 lokin-panel p-2.5 active:scale-[0.98] active:border-primary/40 transition-all"
                  >
                    <div className="rounded-xl bg-black/40 border border-white/5 overflow-hidden">
                      <ApparelMockup variant={it.variant} />
                    </div>
                    <div className="px-1 pt-2">
                      <div className="text-sm font-semibold text-white truncate leading-tight">{it.name}</div>
                      <div className="text-[11px] text-white/45">{it.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
