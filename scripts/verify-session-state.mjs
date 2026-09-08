import fs from "node:fs";
import {
  resolveSessionRestoreRedirect,
  sessionStatusLabel,
} from "../src/lib/sessionState.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const pathname of ["/", "/route", "/lokin", "/earnings", "/more", "/settings", "/break-time"]) {
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
    hasExplicitGpsDestination: false,
  }) === "/",
  "off restore without a destination must leave locked GPS",
);

assert(
  resolveSessionRestoreRedirect({
    workStatus: "off",
    pathname: "/ai-gps",
    lockedGps: true,
    freeRoam: false,
    hasExplicitGpsDestination: true,
  }) === null,
  "FIND + GO must preserve direct navigation while work status is off",
);

const layoutSource = fs.readFileSync(new URL("../src/components/DriverLayout.jsx", import.meta.url), "utf8");
for (const forbidden of ["navigation-engine", "optimizeRoute", "legacy-deck"]) {
  assert(!layoutSource.includes(forbidden), `${forbidden} must not participate in session restore`);
}
assert(!/workStatus\s*===\s*["']paused["'][\s\S]{0,180}navigate\(["']\/break-time/.test(layoutSource), "global paused-to-Break-Time redirect returned");

const homeSource = fs.readFileSync(new URL("../src/pages/Home.jsx", import.meta.url), "utf8");
const voiceSource = fs.readFileSync(new URL("../src/components/GlobalVoiceAssistant.jsx", import.meta.url), "utf8");
const workSheetSource = fs.readFileSync(new URL("../src/components/WorkModeSheet.jsx", import.meta.url), "utf8");

assert(voiceSource.includes('work_status: "paused", break_active: true'), "explicit Pause must activate Break Time");
assert(voiceSource.includes('work_status: "working", break_active: false'), "voice Resume must clear break_active");
assert(voiceSource.includes('work_status: "off", break_active: false'), "voice Tap Out must clear break_active");
assert(homeSource.includes('work_status: "working", break_active: false'), "Home Resume must clear break_active");
assert(homeSource.includes('work_status: "off", break_active: false'), "Home Tap Out must clear break_active");
assert(workSheetSource.includes('break_active: false'), "Start Work must clear stale break_active");

const coldRestoreCases = [
  { workStatus: "paused", pathname: "/route", lockedGps: false, freeRoam: false, expected: null },
  { workStatus: "working", pathname: "/", lockedGps: false, freeRoam: false, expected: "/ai-gps?focus=locked&nav=1&view=real" },
  { workStatus: "off", pathname: "/ai-gps", lockedGps: true, freeRoam: false, hasExplicitGpsDestination: false, expected: "/" },
  { workStatus: "off", pathname: "/ai-gps", lockedGps: true, freeRoam: false, hasExplicitGpsDestination: true, expected: null },
];
for (const test of coldRestoreCases) {
  const { expected, ...input } = test;
  assert(resolveSessionRestoreRedirect(input) === expected, `force-close/reopen failed for ${input.workStatus}`);
}

console.log(JSON.stringify({
  ok: true,
  labels: { working: "ACTIVE", paused: "PAUSED", off: "GET STARTED" },
  pausedRoutesPreserved: true,
  restoreIndependentOf: ["navigation-engine", "optimizeRoute", "legacy-deck"],
}, null, 2));
