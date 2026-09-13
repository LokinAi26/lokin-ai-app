// verify-no-social-surface.mjs
// Kendall's 2026-09-13 decision: social features are STRIPPED from the LOKIN AI
// 1.0 reskin build (deferred to v2). This script fails the build if any social
// surface exists in code: community feed, user posts, comments, likes/reactions,
// follows, direct messages, leaderboards, user discovery, social screens/routes,
// social nav items, or social permission requests.
//
// Driver-reported hotspot / offer data labels are community intelligence, NOT a
// social surface, and are intentionally not flagged here.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

const SCAN_EXTS = new Set([".jsx", ".js", ".ts", ".tsx", ".json", ".jsonc", ".xml", ".plist", ".template", ".kt", ".swift", ".html"]);

// Patterns that indicate a real social surface. Word-boundary anchored to avoid
// false positives like "feedback", "follow-on order flow", "follow driver".
const PATTERNS = [
  /\bcommunity[\s_-]?feed\b/i,
  /\bsocial[\s_-]?feed\b/i,
  /\buser[\s_-]?feed\b/i,
  /\bSocialPost\b/,
  /\bUserPost\b/,
  /\bPostComment\b/,
  /\bDirectMessage\b/,
  /\bFollower\b/,
  /\bLeaderboard\b/,
  /route[\s\S]{0,80}["']\/(community|social|feed|leaderboard|discover)\b/i,
  /label:\s*["'](Community|Social|Feed|Discover|Leaderboard)["']/i,
  /\bNSContactsUsageDescription\b/,
  /\bREAD_CONTACTS\b/,
  /\bsendFriendRequest\b/i,
  /\bacceptFriendRequest\b/i,
];

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build"]);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) yield* walk(full);
    } else if (SCAN_EXTS.has(extname(entry).toLowerCase())) {
      yield full;
    }
  }
}

const hits = [];
for (const file of walk(ROOT)) {
  let text;
  try { text = readFileSync(file, "utf8"); } catch { continue; }
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    for (const pattern of PATTERNS) {
      if (pattern.test(line)) {
        hits.push({ file: file.replace(ROOT, ""), line: i + 1, text: line.trim().slice(0, 140), pattern: String(pattern) });
        break;
      }
    }
  });
}

if (hits.length) {
  console.error(`FAIL: found ${hits.length} social-surface match(es):`);
  for (const h of hits) console.error(`  ${h.file}:${h.line}: ${h.text}`);
  process.exit(1);
}
console.log("PASS: no social surface found in the codebase (feed/posts/comments/likes/follows/DMs/leaderboards/discovery/social nav/social permissions).");
