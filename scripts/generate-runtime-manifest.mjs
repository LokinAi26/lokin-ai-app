#!/usr/bin/env node
/**
 * M1 WP7 — deterministic build-time ArchitectureRuntimeManifest generator.
 *
 * Frozen source: SPEC-001 Method §§30–31, §7, Part 7 I59–I72 (I1).
 *
 * Produces src/architecture/generated/runtimeManifest.ts exporting
 * RUNTIME_MANIFEST (the frozen ArchitectureRuntimeManifest) and
 * RUNTIME_MANIFEST_HASH. The seam's getRuntimeManifestHash() returns the
 * baked-in hash — every SESSION_STARTED event carries the architecture
 * identity of the build that produced it.
 *
 * Determinism contract: identical source tree + identical HEAD commit ->
 * byte-identical generated file. The manifest hash covers ONLY the version
 * content (commitSha + the four version records); generatedAt is
 * informational metadata and is EXCLUDED from the hash, so two builds from
 * the same tree hash identically regardless of when they ran.
 *
 * Version-record conventions (M1):
 *   policyVersions:    { spec: "SPEC-001" } — M1 has no policy engine;
 *                      the frozen baseline identifier is the policy anchor.
 *   schemaVersions:    event-envelope -> EVENT_SCHEMA_VERSION (semantic);
 *                      each architecture package -> sha256 of its source
 *                      files (sorted), so ANY source change changes the
 *                      recorded version.
 *   evaluatorVersions: {} — frozen M1 boundary: no evaluator authority.
 *   registryVersions:  {} — M1 has no registry.
 *
 * CLI:
 *   node scripts/generate-runtime-manifest.mjs [--out <path>] [--check] [--allow-dirty]
 *   --out:         destination .ts file (default src/architecture/generated/runtimeManifest.ts)
 *   --check:       exit 1 if the existing file differs from what would be generated
 *   --allow-dirty: proceed on a dirty git tree (commitSha is suffixed "-dirty")
 *
 * Without --allow-dirty the script REFUSES to generate on a dirty tree:
 * a manifest must identify a reproducible build.
 */

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const archRoot = join(root, "src", "architecture");
const DEFAULT_OUT = join(archRoot, "generated", "runtimeManifest.ts");

const PACKAGES = ["contracts", "materializer", "store", "sync", "seams"];

function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex");
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, sortKeysDeep(value[k])])
    );
  }
  return value;
}

/** Canonical JSON: sorted keys, no insignificant whitespace. */
function canonicalJson(value) {
  return JSON.stringify(sortKeysDeep(value));
}

function packageHash(pkg) {
  const dir = join(archRoot, pkg);
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .sort();
  const lines = files.map((f) => `${f}:${sha256Hex(readFileSync(join(dir, f)))}`);
  return sha256Hex(lines.join("\n"));
}

function gitHead() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, stdio: "pipe" })
      .toString()
      .trim();
  } catch {
    return "unknown";
  }
}

function gitDirty() {
  try {
    const out = execFileSync("git", ["status", "--porcelain"], { cwd: root, stdio: "pipe" })
      .toString()
      .trim();
    return out.length > 0;
  } catch {
    return true;
  }
}

function parseArgs(argv) {
  const args = { out: DEFAULT_OUT, check: false, allowDirty: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") args.out = join(root, argv[++i]);
    else if (argv[i] === "--check") args.check = true;
    else if (argv[i] === "--allow-dirty") args.allowDirty = true;
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return args;
}

function buildManifest(allowDirty) {
  const head = gitHead();
  const dirty = gitDirty();
  if (dirty && !allowDirty) {
    throw new Error(
      "refusing to generate a runtime manifest on a dirty git tree (pass --allow-dirty to override; the manifest must identify a reproducible build)"
    );
  }

  const schemaVersions = { "event-envelope": "1" };
  for (const pkg of PACKAGES) {
    schemaVersions[`src/architecture/${pkg}`] = `sha256:${packageHash(pkg)}`;
  }

  const versionContent = sortKeysDeep({
    commitSha: dirty ? `${head}-dirty` : head,
    policyVersions: { spec: "SPEC-001" },
    schemaVersions,
    evaluatorVersions: {},
    registryVersions: {},
  });

  const manifestHash = sha256Hex(canonicalJson(versionContent));

  return {
    manifest: {
      ...versionContent,
      generatedAt: new Date().toISOString(),
      manifestHash,
    },
    manifestHash,
  };
}

function renderTs(manifest) {
  const body = JSON.stringify(sortKeysDeep(manifest), null, 2);
  return `/**
 * GENERATED by scripts/generate-runtime-manifest.mjs — do not hand-edit.
 *
 * Build-time ArchitectureRuntimeManifest (frozen SPEC-001 §§30–31, §7,
 * I59–I72). RUNTIME_MANIFEST_HASH identifies the architecture source tree
 * that produced this build; it is stamped into every SESSION_STARTED event
 * by the Lock In seam. Regenerate with \`npm run generate:runtime-manifest\`
 * after any change under src/architecture/.
 */

import type { ArchitectureRuntimeManifest } from "../contracts/index.js";

export const RUNTIME_MANIFEST: ArchitectureRuntimeManifest = ${body};

export const RUNTIME_MANIFEST_HASH: string = RUNTIME_MANIFEST.manifestHash;
`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const { manifest } = buildManifest(args.allowDirty);
  const rendered = renderTs(manifest);

  if (args.check) {
    const existing = existsSync(args.out) ? readFileSync(args.out, "utf8") : null;
    // generatedAt is informational and excluded from the manifest hash;
    // normalize it so --check verifies version content, not the clock.
    const normalize = (s) => s.replace(/"generatedAt": "[^"]*"/, '"generatedAt": "<normalized>"');
    if (existing === null || normalize(existing) !== normalize(rendered)) {
      console.error(
        `runtime manifest CHECK FAILED: ${relative(root, args.out)} differs from generated output.\n` +
          `Run \`npm run generate:runtime-manifest\` and commit the result.`
      );
      process.exit(1);
    }
    console.log("runtime manifest check: up to date.");
    return;
  }

  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, rendered);
  console.log(`runtime manifest written: ${relative(root, args.out)}`);
  console.log(`manifest hash: ${manifest.manifestHash}`);
}

main();
