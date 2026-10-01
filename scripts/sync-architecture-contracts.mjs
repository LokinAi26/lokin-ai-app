#!/usr/bin/env node
/**
 * Mirror the canonical contracts package into base44/shared/ so Base44
 * backend functions can import the SAME module the client uses.
 *
 * Single source of truth: src/architecture/contracts/*.ts
 * Generated mirror:      base44/shared/architecture-contracts/*.ts
 *
 * The mirror is byte-identical (plus this README). Never hand-edit the
 * mirror; edit the source and re-run `npm run sync:contracts`.
 * Functions import via: import { ... } from "../../shared/architecture-contracts/index.js";
 */

import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src", "architecture", "contracts");
const dest = join(root, "base44", "shared", "architecture-contracts");

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

for (const f of readdirSync(src)) {
  if (f.endsWith(".ts")) cpSync(join(src, f), join(dest, f));
}

writeFileSync(
  join(dest, "README.md"),
  `# architecture-contracts (GENERATED MIRROR)

Byte-identical mirror of \`src/architecture/contracts/\`, produced by
\`scripts/sync-architecture-contracts.mjs\` (\`npm run sync:contracts\`).

**Never hand-edit files in this directory.** Edit the canonical source and
re-run the sync. Base44 backend functions import the contracts from here:

\`\`\`ts
import { ShiftEventSchema } from "../../shared/architecture-contracts/index.js";
\`\`\`
`
);

console.log(`mirrored ${readdirSync(dest).filter((f) => f.endsWith(".ts")).length} contract files -> base44/shared/architecture-contracts/`);
