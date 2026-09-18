import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet } from "lucide-react";
import SelectSheet from "@/components/ui/SelectSheet";
import { base44 } from "@/api/base44Client";

// IRS standard mileage rate — matches the rate used when shift mileage is
// committed to the mileage log.
const MILEAGE_RATE = 0.70;

function csvCell(v) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Tax export: pulls the driver's logged earnings and business mileage for a
// chosen year into clean CSV files for tax records.
export default function TaxExport() {
  const [earnings, setEarnings] = useState([]);
  const [mileage, setMileage] = useState([]);
  const [loading, setLoading] = useState(true);
  const years = useMemo(() => {
    const set = new Set([
      ...earnings.map((e) => (e.date || "").slice(0, 4)),
      ...mileage.map((m) => (m.date || "").slice(0, 4)),
    ]);
    set.delete("");
    const list = [...set].filter((y) => /^\d{4}$/.test(y)).sort((a, b) => b.localeCompare(a));
    const current = String(new Date().getFullYear());
    return list.includes(current) ? list : [current, ...list];
  }, [earnings, mileage]);
  const [year, setYear] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    Promise.all([
      base44.entities.Earning.filter({}, "date"),
      base44.entities.MileageLog.filter({}, "date"),
    ])
      .then(([e, m]) => {
        setEarnings(e || []);
        setMileage(m || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const yearEarnings = useMemo(() => earnings.filter((e) => (e.date || "").startsWith(year)), [earnings, year]);
  const yearMileage = useMemo(() => mileage.filter((m) => (m.date || "").startsWith(year) && (m.type || "business") === "business"), [mileage, year]);

  const gross = yearEarnings.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const businessMiles = yearMileage.reduce((s, r) => s + (Number(r.miles) || 0), 0);
  const mileageDeduction = yearMileage.reduce((s, r) => s + (Number(r.deduction) > 0 ? Number(r.deduction) : (Number(r.miles) || 0) * MILEAGE_RATE), 0);
  const net = gross - mileageDeduction;

  function exportEarnings() {
    const rows = [
      ["Date", "Platform", "Zone", "Vehicle", "Trips", "Miles", "Base Pay", "Tips", "Bonuses", "Adjustments", "Total"],
      ...yearEarnings.map((r) => [
        r.date || "",
        r.platform || "mixed",
        r.zone || "",
        r.vehicle || "",
        r.trips ?? 0,
        r.miles ?? 0,
        r.base_pay ?? "",
        r.tips ?? 0,
        r.bonuses ?? 0,
        r.adjustments ?? 0,
        Number(r.amount) || 0,
      ]),
    ];
    downloadCsv(`lokin-earnings-${year}.csv`, rows);
  }

  function exportMileage() {
    const rows = [
      ["Date", "Type", "Purpose", "Miles", "Deduction"],
      ...yearMileage.map((r) => [
        r.date || "",
        r.type || "business",
        r.purpose || "",
        Number(r.miles) || 0,
        (Number(r.deduction) > 0 ? Number(r.deduction) : (Number(r.miles) || 0) * MILEAGE_RATE).toFixed(2),
      ]),
    ];
    downloadCsv(`lokin-mileage-${year}.csv`, rows);
  }

  return (
    <div className="lokin-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <FileSpreadsheet className="h-4 w-4 text-primary" />
        <div className="lokin-kicker lokin-kicker-lime">TAX EXPORT</div>
        <SelectSheet
          value={year}
          onChange={setYear}
          options={years.map((y) => ({ value: y, label: String(y) }))}
          label="Tax year"
          className="ml-auto w-28 rounded-full border-white/15 bg-black/60 px-3 py-1 text-xs"
        />
      </div>

      {loading ? (
        <div className="py-3 text-xs text-white/45">Loading your records…</div>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            <div className="lokin-stat-tile">
              <div className="lokin-stat-value text-base font-display">${gross.toFixed(0)}</div>
              <div className="text-[10px] text-white/40">Gross income</div>
            </div>
            <div className="lokin-stat-tile">
              <div className="lokin-stat-value text-base font-display">{businessMiles.toFixed(0)}</div>
              <div className="text-[10px] text-white/40">Business mi</div>
            </div>
            <div className="lokin-stat-tile">
              <div className="lokin-stat-value text-base font-display">${mileageDeduction.toFixed(0)}</div>
              <div className="text-[10px] text-white/40">Mileage deduction</div>
            </div>
          </div>

          {yearEarnings.length === 0 && yearMileage.length === 0 ? (
            <div className="py-2 text-center text-xs text-white/45">No logged records for {year} yet.</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={exportEarnings}
                disabled={yearEarnings.length === 0}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" /> Earnings CSV
              </button>
              <button
                type="button"
                onClick={exportMileage}
                disabled={yearMileage.length === 0}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground active:scale-95 transition-transform disabled:opacity-40"
              >
                <Download className="h-3.5 w-3.5" /> Mileage CSV
              </button>
            </div>
          )}
          <div className="mt-2 text-[10px] text-white/35">
            Mileage valued at the ${MILEAGE_RATE.toFixed(2)}/mi IRS standard rate · business miles only · net after mileage deduction: ${net.toFixed(2)}
          </div>
        </>
      )}
    </div>
  );
}