#!/usr/bin/env node
/**
 * M1 evidence — WP9 fixtures F1/F2 (frozen SPEC-001 M1 required evidence):
 *
 *   F1: Deterministic fixture — the same event sequence materialized
 *       client-side (src/architecture/) and functions-side
 *       (base44/shared/architecture/, the generated mirror) MUST produce
 *       byte-identical JSON. Exercises canonical ordering, correction
 *       chains, and a concurrent cross-session correction tiebreak.
 *   F2: Upcast fixture — older-schema (v0) events upcast deterministically:
 *       same raw input -> same ShiftEvent, twice in a row, through the
 *       same upcastEvent the OperationalStore uses on read.
 *   F3: Idempotent-ingest fixture — the shared decideIngest() partition
 *       (accepted / already-present / rejected) behaves byte-identically
 *       client-side and mirror-side; a retried batch accepts nothing new.
 *
 * Compiles both trees with tsc into a temp dir and imports the compiled
 * output — no test framework, no new dependencies. Follows the repo's
 * scripts/verify-*.mjs convention. Exit non-zero on any mismatch.
 *
 * Mirror staging note: base44/shared/architecture carries Deno-style `.ts`
 * import specifiers (see scripts/sync-architecture.mjs). The fixture stages
 * a temp copy with those specifiers rewritten back to the client `.js`
 * convention — the exact inverse transform — so tsc can compile the mirror
 * for Node. Semantics are untouched.
 */

import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Repo-local temp dir (not os.tmpdir): compiled output must resolve `zod`
// from the repo's node_modules.
const tmp = mkdtempSync(join(root, ".fixture-tmp-"));

let failures = 0;
function check(name, cond, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!cond) failures += 1;
}

/** Recursively list .ts files under a directory. */
function walkTs(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walkTs(full));
    else if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

/** Canonical JSON: sorted keys, so key order can never fake a pass. */
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

try {
  // Stage the generated mirror with Node-compatible specifiers (see header).
  const mirrorStage = join(tmp, "mirror-src");
  cpSync(join(root, "base44", "shared", "architecture"), mirrorStage, { recursive: true });
  for (const f of walkTs(mirrorStage)) {
    writeFileSync(
      f,
      readFileSync(f, "utf8").replace(
        /((?:import|export)[^"']*from\s*["'])(\.\.?\/[^"']*)\.ts(["'])/g,
        "$1$2.js$3"
      )
    );
  }

  // Compile the client tree and the staged mirror independently.
  const clientOut = join(tmp, "client");
  const mirrorOut = join(tmp, "mirror");
  execFileSync(
    "npx",
    ["tsc", "src/architecture/materializer/materializer.ts", "src/architecture/store/upcast.ts",
      "--outDir", clientOut,
      "--module", "nodenext", "--target", "es2022", "--moduleResolution", "nodenext",
      "--skipLibCheck"],
    { cwd: root, stdio: "pipe" }
  );
  execFileSync(
    "npx",
    ["tsc", join(mirrorStage, "materializer", "materializer.ts"), "--outDir", mirrorOut,
      "--module", "nodenext", "--target", "es2022", "--moduleResolution", "nodenext",
      "--skipLibCheck"],
    { cwd: root, stdio: "pipe" }
  );

  const client = await import(pathToFileURL(join(clientOut, "materializer", "materializer.js")).href);
  const mirror = await import(pathToFileURL(join(mirrorOut, "materializer", "materializer.js")).href);
  const storeClient = await import(pathToFileURL(join(clientOut, "store", "upcast.js")).href);

  // ---- F1: byte-equivalence client vs mirror ----
  const fixture = JSON.parse(readFileSync(join(root, "scripts", "fixtures", "m1-determinism-fixture.json"), "utf8"));
  const clientCtx = canonical(client.materialize(fixture));
  const mirrorCtx = canonical(mirror.materialize(fixture));
  check("F1 byte-identical LiveContext (client vs mirror)", clientCtx === mirrorCtx);

  const clientEv = canonical(client.materializeWithEvidence(fixture));
  const mirrorEv = canonical(mirror.materializeWithEvidence(fixture));
  check("F1 byte-identical evidence incl. conflicts", clientEv === mirrorEv);

  // Sanity: the fixture actually exercises the interesting paths.
  const parsed = JSON.parse(clientCtx);
  check("F1 fixture: cross-session tiebreak resolved to 63.0", parsed.goal.currentEarnings.value === 63.0, `got ${parsed.goal.currentEarnings.value}`);
  const evParsed = JSON.parse(clientEv);
  check("F1 fixture: exactly one correction conflict recorded", evParsed.conflicts.length === 1, `got ${evParsed.conflicts.length}`);
  check("F1 fixture: goal target intact", parsed.goal.targetEarnings.value === 200);

  // Order-independence: shuffled input -> identical bytes.
  const shuffled = canonical(client.materialize([...fixture].reverse()));
  check("F1 order-independent", shuffled === clientCtx);

  // ---- F2: deterministic upcast ----
  const v0 = JSON.parse(readFileSync(join(root, "scripts", "fixtures", "m1-upcast-fixture.json"), "utf8"));
  const up1 = v0.map((raw) => storeClient.upcastEvent(raw));
  const up2 = v0.map((raw) => storeClient.upcastEvent(raw));
  check("F2 upcast deterministic", canonical(up1) === canonical(up2));
  check("F2 v0 version -> sequenceNumber", up1[1].sequenceNumber === 1 && up1[2].sequenceNumber === 2);
  check("F2 v0 sessionId defaults to ${shiftId}:legacy", up1[0].sessionId === "fixture-shift-0:legacy", `got ${up1[0].sessionId}`);
  const upCtx = canonical(client.materialize(up1));
  const upParsed = JSON.parse(upCtx);
  check("F2 upcast events materialize", upParsed.goal.targetEarnings.value === 180 && upParsed.goal.currentEarnings.value === 41.75);

  // ---- F3: idempotent ingest (client vs mirror) ----
  const syncClientOut = join(tmp, "sync-client");
  const syncMirrorOut = join(tmp, "sync-mirror");
  execFileSync(
    "npx",
    ["tsc", "src/architecture/sync/ingest.ts", "--outDir", syncClientOut,
      "--module", "nodenext", "--target", "es2022", "--moduleResolution", "nodenext",
      "--skipLibCheck"],
    { cwd: root, stdio: "pipe" }
  );
  execFileSync(
    "npx",
    ["tsc", join(mirrorStage, "sync", "ingest.ts"), "--outDir", syncMirrorOut,
      "--module", "nodenext", "--target", "es2022", "--moduleResolution", "nodenext",
      "--skipLibCheck"],
    { cwd: root, stdio: "pipe" }
  );
  const syncClient = await import(pathToFileURL(join(syncClientOut, "sync", "ingest.js")).href);
  const syncMirror = await import(pathToFileURL(join(syncMirrorOut, "sync", "ingest.js")).href);
  const syncBatch = JSON.parse(readFileSync(join(root, "scripts", "fixtures", "m1-sync-fixture.json"), "utf8"));

  // First attempt against an empty server.
  const firstClient = syncClient.decideIngest(syncBatch, new Set());
  const firstMirror = syncMirror.decideIngest(syncBatch, new Set());
  check("F3 byte-identical ingest decision (client vs mirror)", canonical(firstClient) === canonical(firstMirror));
  check("F3 first attempt accepts the 3 valid events", firstClient.accepted.length === 3, `got ${firstClient.accepted.length}`);
  check("F3 first attempt rejects the 2 invalid events", firstClient.rejected.length === 2, `got ${firstClient.rejected.length}`);
  check(
    "F3 rejected eventIds preserved (bad uuid + unknown)",
    firstClient.rejected.some((r) => r.eventId === "not-a-uuid") &&
      firstClient.rejected.some((r) => r.eventId === "unknown"),
    JSON.stringify(firstClient.rejected.map((r) => r.eventId))
  );
  check("F3 rejections carry reasons", firstClient.rejected.every((r) => r.reason.length > 0));

  // Retry: the exact same batch after the server stored the accepted IDs.
  const serverIds = new Set(firstClient.accepted.map((e) => e.eventId));
  const retryClient = syncClient.decideIngest(syncBatch, serverIds);
  const retryMirror = syncMirror.decideIngest(syncBatch, serverIds);
  check("F3 retry accepts nothing new (no duplicates)", retryClient.accepted.length === 0, `got ${retryClient.accepted.length}`);
  check("F3 retry reports valid events as already-present", retryClient.alreadyPresentEventIds.length === 3, `got ${retryClient.alreadyPresentEventIds.length}`);
  check("F3 retry still surfaces invalid events as rejected", retryClient.rejected.length === 2, `got ${retryClient.rejected.length}`);
  check("F3 retry decision byte-identical (client vs mirror)", canonical(retryClient) === canonical(retryMirror));

  // Within-batch duplicate: second occurrence must not be re-accepted.
  const dupBatch = { ...syncBatch, events: [...syncBatch.events.slice(0, 2), syncBatch.events[0]] };
  const dup = syncClient.decideIngest(dupBatch, new Set());
  check(
    "F3 within-batch duplicate is already-present, not re-accepted",
    dup.accepted.length === 2 && dup.alreadyPresentEventIds.length === 1,
    `accepted=${dup.accepted.length} alreadyPresent=${dup.alreadyPresentEventIds.length}`
  );
} catch (err) {
  console.error(`ERROR  ${err.message}`);
  failures += 1;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(failures === 0 ? "\nAll M1 fixture checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
