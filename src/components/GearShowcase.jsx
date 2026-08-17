import ApparelMockup from "@/components/ApparelMockup";

// Categorized LOKIN gear showcase — branded mockups browsable in-app.
// Printful carries apparel + totes + socks; specialty food-delivery gear
// (pizza/catering bags, cup carriers, seat cushions, massage covers) is
// shown here as the LOKIN collection and created in Printful where supported.
const SECTIONS = [
  {
    title: "Core Apparel",
    items: [
      { variant: "tee", name: "LOKIN AI Tee", sub: "Signature lockup · Individual product" },
      { variant: "hoodie", name: "LOKIN AI Hoodie", sub: "Signature lockup · Individual product" },
      { variant: "cap", name: "LOKIN AI Cap", sub: "Embroidered-look lock mark" },
      { variant: "sticker", name: "LOKIN AI Sticker", sub: "Signature brand lockup" },
    ],
  },
  {
    title: "Winter Headgear",
    items: [{ variant: "shiesty", name: "LOKIN Balaclava", sub: "Fleece · One size" }],
  },
  {
    title: "Delivery Bags",
    items: [{ variant: "delivery", name: "Insulated Delivery Bag", sub: "Standard · Hot/cold" }],
  },
  {
    title: "Pizza Bags",
    items: [
      { variant: "pizza", name: "Pizza Delivery Bag", sub: '18" · 1-pie' },
      { variant: "pizza", name: "Pizza Delivery Bag", sub: '20" · 2-pie' },
      { variant: "pizza", name: "Pizza Delivery Bag", sub: '24" · 3-pie' },
    ],
  },
  {
    title: "Catering Bags",
    items: [
      { variant: "catering", name: "Catering Bag", sub: "Medium" },
      { variant: "catering", name: "Catering Bag", sub: "Large" },
      { variant: "catering", name: "Catering Bag", sub: "XL" },
    ],
  },
  {
    title: "Tote Bags",
    items: [
      { variant: "tote", name: "LOKIN Tote", sub: "Small" },
      { variant: "tote", name: "LOKIN Tote", sub: "Medium" },
      { variant: "tote", name: "LOKIN Tote", sub: "Large" },
    ],
  },
  {
    title: "Drink Carriers",
    items: [
      { variant: "cupholder", name: "Cup Carrier", sub: "2-cup" },
      { variant: "cupholder", name: "Cup Carrier", sub: "4-cup" },
      { variant: "cupholder", name: "Cup Carrier", sub: "6-cup" },
    ],
  },
  {
    title: "Seat Comfort",
    items: [
      { variant: "seatcushion", name: "Driver Seat Cushion", sub: "Mesh · breathable" },
      { variant: "seatcushion", name: "Lumbar Support Cushion", sub: "Driver back support" },
      { variant: "massagecover", name: "Massage Seat Cover", sub: "Vibration nodes" },
    ],
  },
  {
    title: "Performance Socks",
    items: [
      { variant: "socks", name: "Moisture-Wicking Socks", sub: "Summer · Cool" },
      { variant: "socks", name: "Moisture-Wicking Socks", sub: "Winter · Thermal" },
    ],
  },
  {
    title: "Driver Safety & Alert Gear",
    items: [
      { variant: "delivery", name: "Personal Safety Alarm", sub: "High-volume audible alert · keychain-ready" },
      { variant: "delivery", name: "Emergency Escape Tool", sub: "Seatbelt cutter · window breaker" },
      { variant: "delivery", name: "Reflective Driver Kit", sub: "Visibility gear for roadside stops" },
    ],
  },
];

export default function GearShowcase() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="text-[11px] tracking-[0.24em] text-white/40 font-display">THE COLLECTION · LOKIN GEAR</div>
        <div className="h-px flex-1 bg-white/8" />
      </div>
      <div className="space-y-5">
        {SECTIONS.map((s) => (
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
    </div>
  );
}