import { useState } from "react";
import { Wallet, Route, Receipt, Sparkles, Gauge } from "lucide-react";
import IncomeSection from "@/components/tax/IncomeSection";
import MileageSection from "@/components/tax/MileageSection";
import DeductionsSection from "@/components/tax/DeductionsSection";
import AdvisorSection from "@/components/tax/AdvisorSection";
import CreditSection from "@/components/tax/CreditSection";
import TaxPdfReport from "@/components/tax/TaxPdfReport";

const TABS = [
  { id: "income", label: "Income", icon: Wallet },
  { id: "mileage", label: "Miles", icon: Route },
  { id: "deductions", label: "Deductions", icon: Receipt },
  { id: "advisor", label: "AI Advisor", icon: Sparkles },
  { id: "credit", label: "Credit AI", icon: Gauge },
];

export default function Tax() {
  const [tab, setTab] = useState("income");

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="lokin-kicker lokin-kicker-lime">TAX</div>
      <div>
        <div className="text-[11px] tracking-[0.28em] text-primary/70 font-display">TAX & MONEY</div>
        <h1 className="text-2xl font-bold font-heading metal-text">Tax Engine</h1>
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
        {TABS.map((t) => {
          const on = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition-all active:scale-95 ${
                on ? "border-primary/50 bg-primary/15 text-primary glow-primary" : "border-white/10 bg-white/[0.03] text-white/55"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "income" && <IncomeSection />}
      {tab === "mileage" && <MileageSection />}
      {tab === "deductions" && <DeductionsSection />}
      {tab === "advisor" && <AdvisorSection />}
      {tab === "credit" && <CreditSection />}

      <TaxPdfReport />

      <div className="text-center text-[10px] tracking-[0.2em] text-white/30 pt-1">
        LOKIN AI · NOT A CPA — ESTIMATES ONLY
      </div>
    </div>
  );
}