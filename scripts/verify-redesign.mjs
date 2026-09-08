import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceRoot = path.join(root, "src");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const sourceFiles = walk(sourceRoot).filter((file) => /\.(css|js|jsx|ts|tsx)$/.test(file));
const forbidden = [
  { label: "legacy lime hex", pattern: /#AAFF00/gi },
  { label: "legacy lime HSL", pattern: /80\s+100%\s+50%/g },
  { label: "legacy lime RGB", pattern: /rgba?\(\s*(?:170|180)\s*,\s*255\s*,\s*0/gi },
];

const violations = [];
for (const file of sourceFiles) {
  const text = fs.readFileSync(file, "utf8");
  for (const rule of forbidden) {
    const count = (text.match(rule.pattern) || []).length;
    if (count) violations.push({ file: path.relative(root, file), rule: rule.label, count });
  }
}
assert(violations.length === 0, `Forbidden redesign values remain: ${JSON.stringify(violations)}`);

const css = read("src/index.css");
assert(css.includes("--primary: 81 84% 51%"), "Global primary token is not the approved #A2EB1B equivalent.");
assert(css.includes("#A2EB1B"), "Approved LOKIN lime #A2EB1B is missing from the global design authority.");

const routeMap = read("src/components/LiveVectorMap.jsx");
assert(routeMap.includes('LOKIN_NEON_ROUTE = "#A2EB1B"'), "Live route renderer is not using approved LOKIN lime.");

const brand = read("src/pages/Brand.jsx");
assert(brand.includes('hex: "#A2EB1B"'), "Brand page does not publish the approved LOKIN lime.");

const app = read("src/App.jsx");
const onboarding = read("src/pages/DriverOnboarding.jsx");
assert(!/cannabis|Green Delivery|InsuranceApplication|DriverCertification/i.test(onboarding), "Regulated-delivery requirements leaked into App Store 1.0 onboarding.");
assert(app.includes('<Route path="/onboarding" element={<DriverOnboarding />} />'), "General driver onboarding route is not active.");
for (const phrase of ["Account ready", "Set your daily goal", "Enable driving permissions", "Lock in", "OPTIONAL"]) {
  assert(onboarding.includes(phrase), `Onboarding is missing required step: ${phrase}`);
}

const releaseFlags = read("src/lib/releaseFlags.js");
assert(/regulatedCannabis:\s*false/.test(releaseFlags), "LOKIN Green must remain disabled for App Store 1.0.");

const layout = read("src/components/DriverLayout.jsx");
assert(layout.includes("DriverPreference.work_status is the sole session-restore authority"), "Session restore authority contract is missing.");
assert(!/navigate\(\s*["']\/break-time["']/.test(layout), "DriverLayout must never globally redirect paused sessions to Break Time.");

const coreScreens = [
  "src/pages/Home.jsx",
  "src/pages/RoutePlanner.jsx",
  "src/pages/AiGps.jsx",
  "src/pages/Earnings.jsx",
  "src/pages/More.jsx",
  "src/pages/DriverOnboarding.jsx",
  "src/components/DriverLayout.jsx",
  "src/components/AuthLayout.jsx",
];
for (const file of coreScreens) {
  const text = read(file);
  assert(/(?:text-primary|bg-primary|lokin-panel|metal-text|font-display|radial-fade|glass)/.test(text), `${file} is not connected to the shared LOKIN visual system.`);
}

console.log(JSON.stringify({
  ok: true,
  officialLime: "#A2EB1B",
  hslToken: "81 84% 51%",
  coreScreens: coreScreens.length,
  appStoreSafeOnboarding: true,
  sessionRestorePreserved: true,
}, null, 2));
