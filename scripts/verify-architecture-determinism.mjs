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
 *   F5: Runtime-manifest determinism (WP7) — the build-time manifest
 *       generator produces byte-identical output across runs (modulo the
 *       informational generatedAt), a stable manifest hash, and the
 *       committed manifest matches the current architecture tree.
 *   F6: Observational dual-write (WP8) — session anchoring (live session
 *       vs ${shiftId}:legacy fallback), monotonic sequencing, atomic
 *       event+manifest pairing, and materialization of SHIFT_ENDED /
 *       GOAL_SET, against an in-memory OperationalStore fake.
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
  // ---- F5: build-time runtime manifest determinism (WP7) ----
  const manifestA = join(tmp, "manifest-a.ts");
  const manifestB = join(tmp, "manifest-b.ts");
  execFileSync("node", ["scripts/generate-runtime-manifest.mjs", "--out", manifestA, "--allow-dirty"], { cwd: root, stdio: "pipe" });
  execFileSync("node", ["scripts/generate-runtime-manifest.mjs", "--out", manifestB, "--allow-dirty"], { cwd: root, stdio: "pipe" });
  const normManifest = (s) =>
    s
      .replace(/"generatedAt": "[^"]*"/, '"generatedAt": "<normalized>"')
      // commitSha is build provenance (the commit generated AGAINST, always
      // an ancestor of the carrying commit) — the package-content hashes
      // below it are the freshness signal.
      .replace(/"commitSha": "[^"]*"/, '"commitSha": "<normalized>"');
  const textA = normManifest(readFileSync(manifestA, "utf8"));
  const textB = normManifest(readFileSync(manifestB, "utf8"));
  check("F5 manifest byte-identical across runs (modulo generatedAt)", textA === textB);
  const hashOf = (t) => (t.match(/"manifestHash": "([0-9a-f]{64})"/) || [])[1];
  check("F5 manifest hash stable across runs", Boolean(hashOf(textA)) && hashOf(textA) === hashOf(textB), hashOf(textA));
  // The committed manifest must match the current tree (version content).
  const committed = normManifest(readFileSync(join(root, "src", "architecture", "generated", "runtimeManifest.ts"), "utf8"));
  check("F5 committed manifest matches current architecture tree", committed === textA);
  // ---- F6: observational dual-write (WP8) ----
  // Session anchoring, sequence continuity, and atomic event+manifest
  // pairing, exercised against an in-memory OperationalStore fake. The
  // real Dexie store is never instantiated (Dexie imports but does not
  // touch IndexedDB at module load).
  const seamOut = join(tmp, "seams");
  // NOTE: the seams tree pulls in dexieStore -> dexie, whose types only
  // resolve under the project's bundler-style module resolution (nodenext
  // mis-resolves them). Compile with the project-matching settings; the
  // emitted .js specifiers are still Node-ESM-importable.
  execFileSync(
    "npx",
    ["tsc", "src/architecture/seams/dualWrite.ts", "--outDir", seamOut,
      "--module", "esnext", "--target", "es2022", "--moduleResolution", "bundler",
      "--esModuleInterop", "--skipLibCheck"],
    { cwd: root, stdio: "pipe" }
  );
  const seams = await import(pathToFileURL(join(seamOut, "seams", "dualWrite.js")).href);
  const seamUtils = await import(pathToFileURL(join(seamOut, "seams", "lockInSeam.js")).href);

  function makeFakeStore() {
    const events = [];
    let manifest = null;
    const txns = [];
    return {
      events,
      txns,
      getManifest: () => manifest,
      async appendEventAndUpdateManifest(event, m) {
        txns.push({ eventId: event.eventId, manifest: m }); // one call = one transaction
        events.push(event);
        manifest = m;
      },
      async getShiftEvents() { return [...events]; },
      async getRecoveryManifest() { return manifest; },
      async getPendingSyncEvents() { return []; },
      async markEventsSynced() {},
    };
  }
  function seedEvent(overrides) {
    const now = new Date().toISOString();
    return {
      eventId: `seed-${Math.random().toString(36).slice(2)}`,
      shiftId: overrides.shiftId,
      driverId: "driver-1",
      sessionId: "sess-abc",
      sequenceNumber: 0,
      type: "SESSION_STARTED",
      occurredAt: now,
      recordedAt: now,
      origin: "DEVICE",
      source: "wp8-fixture",
      payload: {},
      ...overrides,
    };
  }

  const driverId = "driver-1";
  const shiftId = seamUtils.shiftIdFor(driverId);

  const fakeA = makeFakeStore();
  const obsA = await seams.appendObservationalEvent(driverId, "SHIFT_ENDED", {}, fakeA);
  check("F6 empty log anchors to ${shiftId}:legacy session", obsA.sessionId === `${shiftId}:legacy`, obsA.sessionId);
  check("F6 first event sequence is 0", obsA.sequenceNumber === 0);
  check("F6 event+manifest paired in one transaction", fakeA.txns.length === 1 && fakeA.txns[0].eventId === obsA.eventId);
  const manA = fakeA.getManifest();
  check("F6 manifest created for the shift", manA && manA.shiftId === shiftId && manA.sessionId === obsA.sessionId);
  check("F6 manifest tracks the pending event", manA.pendingSyncEventIds.length === 1 && manA.pendingSyncEventIds[0] === obsA.eventId);

  const obsB = await seams.appendObservationalEvent(driverId, "GOAL_SET", { targetEarnings: 150 }, fakeA);
  check("F6 second event joins the same session", obsB.sessionId === obsA.sessionId);
  check("F6 sequence continues monotonically", obsB.sequenceNumber === 1);
  const manB = fakeA.getManifest();
  check("F6 manifest updated in place (same shift)", manB.lastMaterializedSequence === 1 && manB.pendingSyncEventIds.length === 2);

  const fakeC = makeFakeStore();
  const seed = seedEvent({ shiftId });
  await fakeC.appendEventAndUpdateManifest(seed, {
    shiftId, sessionId: "sess-abc", lastMaterializedEventId: seed.eventId,
    lastMaterializedSequence: 0, pendingSyncEventIds: [seed.eventId],
    activeJobIds: [], updatedAt: seed.recordedAt,
  });
  const obsC = await seams.appendObservationalEvent(driverId, "SHIFT_ENDED", {}, fakeC);
  check("F6 joins the live session when one exists", obsC.sessionId === "sess-abc" && obsC.sequenceNumber === 1, obsC.sessionId);

  const ctxC = client.materialize(fakeC.events);
  check("F6 SHIFT_ENDED materializes to ENDING", ctxC.shift.status === "ENDING", ctxC.shift.status);
  const fakeD = makeFakeStore();
  await seams.appendObservationalEvent(driverId, "GOAL_SET", { targetEarnings: 150 }, fakeD);
  const ctxD = client.materialize(fakeD.events);
  check("F6 GOAL_SET materializes targetEarnings", ctxD.goal.targetEarnings && ctxD.goal.targetEarnings.value === 150);

  // X4 regression: replicate Dexie's [shiftId+sequenceNumber] index ordering
  // (sequence-major across sessions). After a second Lock In, the index
  // tail belongs to the STALE first session; the manifest sessionId pointer
  // is the live session. The event must join sess-new, not sess-old.
  const fakeE = makeFakeStore();
  for (let i = 0; i < 50; i++) {
    const ev = seedEvent({ shiftId, sessionId: "sess-old", sequenceNumber: i, type: "EARNINGS_UPDATED" });
    await fakeE.appendEventAndUpdateManifest(ev, {
      shiftId, sessionId: "sess-old", lastMaterializedEventId: ev.eventId,
      lastMaterializedSequence: i, pendingSyncEventIds: [ev.eventId],
      activeJobIds: [], updatedAt: ev.recordedAt,
    });
  }
  const newSess = seedEvent({ shiftId, sessionId: "sess-new", sequenceNumber: 0, type: "SESSION_STARTED" });
  await fakeE.appendEventAndUpdateManifest(newSess, {
    shiftId, sessionId: "sess-new", lastMaterializedEventId: newSess.eventId,
    lastMaterializedSequence: 0, pendingSyncEventIds: [newSess.eventId],
    activeJobIds: [], updatedAt: newSess.recordedAt,
  });
  const indexOrdered = [...fakeE.events].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  fakeE.getShiftEvents = async () => indexOrdered; // Dexie index order, not insertion order
  const obsE = await seams.appendObservationalEvent(driverId, "SHIFT_ENDED", {}, fakeE);
  check("F6 X4: joins the live session from the manifest pointer, not the index tail", obsE.sessionId === "sess-new", obsE.sessionId);
  check("F6 X4: sequence continues the live session's max", obsE.sequenceNumber === 1, String(obsE.sequenceNumber));
  check("F6 X4: manifest sessionId does not regress", fakeE.getManifest().sessionId === "sess-new", fakeE.getManifest().sessionId);

  // X6 regression: two concurrent observers must not compute the same next
  // sequenceNumber. The single-writer chain serializes the appends.
  const fakeF = makeFakeStore();
  const [obsF1, obsF2] = await Promise.all([
    seams.appendObservationalEvent(driverId, "GOAL_SET", { targetEarnings: 100 }, fakeF),
    seams.appendObservationalEvent(driverId, "GOAL_SET", { targetEarnings: 200 }, fakeF),
  ]);
  const seqs = [obsF1.sequenceNumber, obsF2.sequenceNumber].sort((a, b) => a - b);
  check("F6 X6: concurrent appends get distinct sequences", seqs[0] === 0 && seqs[1] === 1, seqs.join(","));

  console.log("\nF4 — older-snapshot injection");
  {
    // F4 (M1 WP9): a backend snapshot older than the local recovery
    // manifest is LOGGED and NOT APPLIED — local active-shift state
    // must be preserved byte-for-byte.
    const lockInSeam = await import(pathToFileURL(join(seamOut, "seams", "lockInSeam.js")).href);
    const guard = await import(pathToFileURL(join(seamOut, "seams", "snapshotGuard.js")).href);
    const { considerBackendSnapshot } = guard;
    const { observeRelaunch } = lockInSeam;

    const SHIFT = "shift-1";
    const LOCAL_SEQ = 10;
    const seedManifest = () => ({
      shiftId: SHIFT,
      lastMaterializedSequence: LOCAL_SEQ,
      pendingSyncEventIds: ["e-10"],
      updatedAt: "2026-10-01T10:00:00.000Z",
    });
    const fake = makeFakeStore();
    await fake.appendEventAndUpdateManifest(
      seedEvent({ shiftId: SHIFT, eventId: "e-1", type: "SESSION_STARTED", sequenceNumber: 8, payload: { manifestHash: "h" } }),
      seedManifest()
    );
    await fake.appendEventAndUpdateManifest(
      seedEvent({ shiftId: SHIFT, eventId: "e-2", type: "GOAL_SET", sequenceNumber: 9, payload: { targetEarnings: 200 } }),
      seedManifest()
    );
    await fake.appendEventAndUpdateManifest(
      seedEvent({ shiftId: SHIFT, eventId: "e-3", type: "SHIFT_ENDED", sequenceNumber: 10, payload: {} }),
      seedManifest()
    );

    const snapshotOf = (shiftId, lastSequence) => ({
      shiftId,
      lastSequence,
      lastEventId: `snap-${lastSequence}`,
      updatedAt: "2026-10-01T09:00:00.000Z",
    });
    const before = JSON.stringify({ events: fake.events, manifest: fake.getManifest() });

    // Capture the "logged" evidence: F4 requires the stale snapshot to be
    // LOGGED, not just ignored.
    const logs = [];
    const origInfo = console.info;
    console.info = (...args) => { logs.push(args); };

    let dOlder, dNewer, dMismatch, dNoManifest;
    try {
      dOlder = await considerBackendSnapshot(snapshotOf(SHIFT, 4), fake);
      dNewer = await considerBackendSnapshot(snapshotOf(SHIFT, 15), fake);
      dMismatch = await considerBackendSnapshot(snapshotOf("other-shift", 99), fake);
      dNoManifest = await considerBackendSnapshot(snapshotOf(SHIFT, 4), makeFakeStore());
    } finally {
      console.info = origInfo;
    }

    check("F4 older snapshot is not applied", dOlder.applied === false);
    check("F4 older snapshot reason is OLDER_THAN_LOCAL", dOlder.reason === "OLDER_THAN_LOCAL");
    check(
      "F4 local events and manifest preserved byte-for-byte",
      JSON.stringify({ events: fake.events, manifest: fake.getManifest() }) === before
    );
    check(
      "F4 newer snapshot still not applied (M1 has no pull path)",
      dNewer.applied === false && dNewer.reason === "NO_PULL_PATH_M1"
    );
    check(
      "F4 mismatched shift not applied",
      dMismatch.applied === false && dMismatch.reason === "SHIFT_MISMATCH"
    );
    check(
      "F4 no local manifest not applied",
      dNoManifest.applied === false && dNoManifest.reason === "NO_LOCAL_MANIFEST"
    );
    check(
      "F4 stale snapshot was logged",
      logs.some(
        (a) => String(a[0]).includes("[m1-recovery]") && a[1]?.decision?.reason === "OLDER_THAN_LOCAL"
      )
    );

    // Integration: observeRelaunch guards the snapshot before recovery reads
    // and records the decision in the report (device Scenario C path).
    const relaunchFake = makeFakeStore();
    await relaunchFake.appendEventAndUpdateManifest(
      seedEvent({ shiftId: SHIFT, eventId: "e-1", type: "SESSION_STARTED", sequenceNumber: 8, payload: { manifestHash: "h" } }),
      seedManifest()
    );
    await relaunchFake.appendEventAndUpdateManifest(
      seedEvent({ shiftId: SHIFT, eventId: "e-2", type: "GOAL_SET", sequenceNumber: 9, payload: { targetEarnings: 200 } }),
      seedManifest()
    );
    const relaunchLogs = [];
    console.info = (...args) => { relaunchLogs.push(args); };
    let report;
    try {
      report = await observeRelaunch("driver-9", "off", snapshotOf(SHIFT, 4), relaunchFake);
    } finally {
      console.info = origInfo;
    }
    check(
      "F4 relaunch records the snapshot decision",
      report.snapshotDecision?.reason === "OLDER_THAN_LOCAL" && report.snapshotDecision.applied === false
    );
    check(
      "F4 relaunch notes name the decision",
      report.notes.some((n) => n.includes("OLDER_THAN_LOCAL"))
    );
    check(
      "F4 relaunch still recovers the local goal state",
      report.goalTarget === 200
    );
  }
} catch (err) {
  console.error(`ERROR  ${err.message}`);
  failures += 1;
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(failures === 0 ? "\nAll M1 fixture checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
