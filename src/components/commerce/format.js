export function money(v, cur = "USD") {
  const n = Number(v || 0);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: cur }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

export function badge(s = "") {
  const t = String(s || "open").replaceAll("_", " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}