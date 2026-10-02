export function normalizeZipCode(value: unknown): string {
  const digits = String(value || "").replace(/\D/g, "").slice(0, 5);
  return digits.length === 5 ? digits : "";
}

export function isVirginiaZipCode(value: unknown): boolean {
  const zip = normalizeZipCode(value);
  if (!zip) return false;
  const numeric = Number(zip);
  if (!Number.isFinite(numeric)) return false;
  return (numeric >= 20100 && numeric <= 20199) || (numeric >= 22000 && numeric <= 24699);
}
