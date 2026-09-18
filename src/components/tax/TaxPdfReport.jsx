import { useEffect, useMemo, useState } from "react";
import { FileDown, FileText } from "lucide-react";
import { jsPDF } from "jspdf";
import { base44 } from "@/api/base44Client";

// IRS standard mileage rate — matches the rate used across LOKIN tax tooling.
const MILEAGE_RATE = 0.70;
const MARGIN_X = 40;
const RIGHT_X = 572; // letter width (612pt) minus margin

function money(v) {
  return `$${Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Tax PDF report: builds a clean, printable PDF of business mileage and
// earnings for a custom date range — ready to hand over at tax time.
export default function TaxPdfReport() {
  const [earnings, setEarnings] = useState([]);
  const [mileage, setMileage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [start, setStart] = useState(`${new Date().getFullYear()}-01-01`);
  const [end, setEnd] = useState(todayStr());

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

  const { rangeEarnings, rangeMileage, gross, businessMiles, mileageDeduction, net, days } = useMemo(() => {
    const inRange = (d) => d && d >= start && d <= end;
    const rangeEarnings = earnings.filter((r) => inRange(r.date));
    const rangeMileage = mileage.filter((r) => inRange(r.date) && (r.type || "business") === "business");

    const byDate = {};
    for (const m of rangeMileage) {
      const row = byDate[m.date] || (byDate[m.date] = { miles: 0, deduction: 0, earnings: 0 });
      const miles = Number(m.miles) || 0;
      row.miles += miles;
      row.deduction += Number(m.deduction) > 0 ? Number(m.deduction) : miles * MILEAGE_RATE;
    }
    for (const r of rangeEarnings) {
      const row = byDate[r.date] || (byDate[r.date] = { miles: 0, deduction: 0, earnings: 0 });
      row.earnings += Number(r.amount) || 0;
    }

    const gross = rangeEarnings.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const businessMiles = rangeMileage.reduce((s, r) => s + (Number(r.miles) || 0), 0);
    const mileageDeduction = rangeMileage.reduce(
      (s, r) => s + (Number(r.deduction) > 0 ? Number(r.deduction) : (Number(r.miles) || 0) * MILEAGE_RATE),
      0
    );
    return {
      rangeEarnings,
      rangeMileage,
      gross,
      businessMiles,
      mileageDeduction,
      net: gross - mileageDeduction,
      days: Object.keys(byDate).sort(),
    };
  }, [earnings, mileage, start, end]);

  const validRange = start <= end;
  const hasData = rangeEarnings.length > 0 || rangeMileage.length > 0;

  function summaryBox(doc, x, y, label, value) {
    doc.setDrawColor(210);
    doc.setFillColor(244, 246, 244);
    doc.roundedRect(x, y, 250, 50, 4, 4, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text(label.toUpperCase(), x + 10, y + 15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(20);
    doc.text(value, x + 10, y + 37);
  }

  function tableHeader(doc, y) {
    doc.setFillColor(232, 238, 232);
    doc.rect(MARGIN_X, y - 12, RIGHT_X - MARGIN_X, 18, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(40);
    doc.text("DATE", MARGIN_X + 6, y);
    doc.text("MILES", 240, y, { align: "right" });
    doc.text("MILEAGE DEDUCTION", 370, y, { align: "right" });
    doc.text("EARNINGS", RIGHT_X - 6, y, { align: "right" });
  }

  function generate() {
    setBuilding(true);
    try {
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor(20);
      doc.text("LOKIN AI", MARGIN_X, 52);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(12);
      doc.text("Mileage & Earnings — Tax Season Report", MARGIN_X, 72);
      doc.setFontSize(9);
      doc.setTextColor(110);
      doc.text(`Period: ${start} to ${end}`, MARGIN_X, 88);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, RIGHT_X, 88, { align: "right" });
      doc.setDrawColor(60);
      doc.setLineWidth(1);
      doc.line(MARGIN_X, 98, RIGHT_X, 98);

      let y = 118;
      summaryBox(doc, MARGIN_X, y, "Gross earnings", money(gross));
      summaryBox(doc, 302, y, "Business miles", businessMiles.toLocaleString("en-US", { maximumFractionDigits: 1 }));
      y += 62;
      summaryBox(doc, MARGIN_X, y, "Mileage deduction", money(mileageDeduction));
      summaryBox(doc, 302, y, "Net after mileage deduction", money(net));

      y += 78;
      tableHeader(doc, y);
      y += 20;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const totals = { miles: 0, deduction: 0, earnings: 0 };
      for (const day of days) {
        if (y > 700) {
          doc.addPage();
          y = 56;
          tableHeader(doc, y);
          y += 20;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9);
        }
        const row = byDayRow(day);
        totals.miles += row.miles;
        totals.deduction += row.deduction;
        totals.earnings += row.earnings;
        doc.setTextColor(60);
        doc.text(day, MARGIN_X + 6, y);
        doc.text(row.miles.toFixed(1), 240, y, { align: "right" });
        doc.text(money(row.deduction), 370, y, { align: "right" });
        doc.text(money(row.earnings), RIGHT_X - 6, y, { align: "right" });
        y += 16;
      }

      y += 4;
      doc.setDrawColor(60);
      doc.line(MARGIN_X, y - 10, RIGHT_X, y - 10);
      doc.setFont("helvetica", "bold");
      doc.text("TOTALS", MARGIN_X + 6, y + 4);
      doc.text(totals.miles.toFixed(1), 240, y + 4, { align: "right" });
      doc.text(money(totals.deduction), 370, y + 4, { align: "right" });
      doc.text(money(totals.earnings), RIGHT_X - 6, y + 4, { align: "right" });

      const pages = doc.getNumberOfPages();
      for (let i = 1; i <= pages; i += 1) {
        doc.setPage(i);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(130);
        doc.text(
          `LOKIN AI — estimates only; verify with a tax professional. Mileage valued at $${MILEAGE_RATE.toFixed(2)}/mi IRS standard rate · business miles only.`,
          MARGIN_X,
          752
        );
        doc.text(`${i} / ${pages}`, RIGHT_X, 752, { align: "right" });
      }

      doc.save(`lokin-tax-report-${start}-to-${end}.pdf`);
    } finally {
      setBuilding(false);
    }
  }

  // Row lookup for the PDF builder (kept outside the memo for the generator).
  const byDateRef = useMemo(() => {
    const map = {};
    for (const m of rangeMileage) {
      const row = map[m.date] || (map[m.date] = { miles: 0, deduction: 0, earnings: 0 });
      const miles = Number(m.miles) || 0;
      row.miles += miles;
      row.deduction += Number(m.deduction) > 0 ? Number(m.deduction) : miles * MILEAGE_RATE;
    }
    for (const r of rangeEarnings) {
      const row = map[r.date] || (map[r.date] = { miles: 0, deduction: 0, earnings: 0 });
      row.earnings += Number(r.amount) || 0;
    }
    return map;
  }, [rangeMileage, rangeEarnings]);
  function byDayRow(day) {
    return byDateRef[day] || { miles: 0, deduction: 0, earnings: 0 };
  }

  return (
    <div className="lokin-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        <div className="lokin-kicker lokin-kicker-lime">TAX PDF REPORT</div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">From</span>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">To</span>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full rounded-xl border border-white/15 bg-black/60 px-3 py-2 text-sm text-white"
          />
        </label>
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
              <div className="text-[10px] text-white/40">Deduction</div>
            </div>
          </div>

          {!validRange ? (
            <div className="py-2 text-center text-xs text-white/45">Pick a start date on or before the end date.</div>
          ) : !hasData ? (
            <div className="py-2 text-center text-xs text-white/45">No logged mileage or earnings in this range.</div>
          ) : (
            <button
              type="button"
              onClick={generate}
              disabled={building}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground transition-transform active:scale-95 disabled:opacity-50"
            >
              <FileDown className="h-4 w-4" /> {building ? "Building PDF…" : "Download Tax PDF"}
            </button>
          )}
          <div className="mt-2 text-[10px] text-white/35">
            Clean one-page-per-period summary with a daily mileage &amp; earnings table · mileage at ${MILEAGE_RATE.toFixed(2)}/mi IRS standard rate
          </div>
        </>
      )}
    </div>
  );
}