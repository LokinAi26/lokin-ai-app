import fs from "node:fs";
import {
  resolveSessionRestoreRedirect,
  sessionStatusLabel,
} from "../src/lib/sessionState.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const pathname of ["/", "/route", "/earnings", "/more", "/settings", "/break-time"]) {
  assert(
    resolveSessionRestoreRedirect({
      workStatus: "paused",
      pathname,
      lockedGps: pathname === "/ai-gps",
      freeRoam: false,
    }) === null,
    `paused state must not redirect ${pathname}`,
  );
}

assert(sessionStatusLabel("working") === "ACTIVE", "working label must be ACTIVE");
assert(sessionStatusLabel("paused") === "PAUSED", "paused label must be PAUSED");
assert(sessionStatusLabel("off") === "GET STARTED", "off label must be GET STARTED");

assert(
  resolveSessionRestoreRedirect({
    workStatus: "working",
    pathname: "/",
    lockedGps: false,
    freeRoam: false,
  }) === "/ai-gps?focus=locked&nav=1&view=real",
  "working locked-mode restore must open GPS",
);

assert(
  resolveSessionRestoreRedirect({
    workStatus: "off",
    pathname: "/ai-gps",
    lockedGps: true,
    freeRoam: false,
  }) === "/",
  "off restore must leave locked GPS",
);

const layoutSource = fs.readFileSync(new URL("../src/components/DriverLayout.jsx", import.meta.url), "utf8");
for (const forbidden of ["navigation-engine", "optimizeRoute", "legacy-deck"]) {
  assert(!layoutSource.includes(forbidden), `${forbidden} must not participate in session restore`);
}
assert(!/workStatus\s*===\s*["']paused["'][\s\S]{0,180}navigate\(["']\/break-time/.test(layoutSource), "global paused-to-Break-Time redirect returned");

console.log(JSON.stringify({
  ok: true,
  labels: { working: "ACTIVE", paused: "PAUSED", off: "GET STARTED" },
  pausedRoutesPreserved: true,
  restoreIndependentOf: ["navigation-engine", "optimizeRoute", "legacy-deck"],
}, null, 2));
