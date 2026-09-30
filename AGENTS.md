# AGENTS.md

## LOKIN AI

Provider-neutral driver operating system: navigation, route optimization, work-session intelligence, earnings visibility, AI assistance, driver safety.

Engineering priorities, in order: correctness, driver safety, data integrity, security, reliability, performance, UX consistency, maintainability. Do not trade correctness or safety for visual polish.

## Core invariants

- Never fabricate driver earnings, offers, route stops, mileage, provider data, work sessions, customer information, or location data. Modeled or estimated data must be explicitly labeled.
- No duplicate active work sessions (`active_session_count <= 1`). Session state must survive refresh, navigation, backgrounding, force-close, and reopen. Canonical states: `inactive` / `active` / `paused`. Break state is distinct from paused work state unless explicitly modeled otherwise.
- Route Optimizer operates only on real confirmed stops. Never invent route stops.
- Ask LOKIN is the unified voice/text AI identity. Do not create competing assistant identities.
- LOKIN SCORE (0-100) and DATA CONFIDENCE (High/Medium/Low) are separate concepts.
- When the driver is active, prefer voice, spoken feedback, one-tap controls, and short messages. No workflows requiring extended reading or typing while driving.

## Brand colors (locked)

- `#8FE44E` — LOKIN Green, the app invariant. All UI chrome, accents, and brand marks.
- `#A2EB1B` — route line ONLY. Never substitute for canonical UI green.
- `#39FF14` — brand boards and marketing only. Never in app UI.

Visual system: deep black, metallic/chrome surfaces, restrained glow, thin luminous borders, premium typography. Cyan for navigation/AI informational states. Red for destructive actions. Bottom navigation: Delivery, Route, LOKIN AI, Earnings, More. Respect iOS safe areas, bottom-navigation obstruction, keyboard avoidance, minimum touch targets, text truncation, dynamic screen sizes.

## Production states

Every network/data-driven screen must handle: loading, success, empty, error, offline, permission denied, retry. Never leave an indefinite loading state — timeouts must resolve into an actionable state. Never use fake production values to avoid an empty state.

## Security

Never hard-code secrets in client code. Enforce authorization server-side. Treat location, voice data, authentication tokens, personal data, earnings data, customer information, and provider credentials as sensitive. Destructive actions require intentional handling. Errors must be observable by engineering, fail safely, provide a usable user state, preserve recoverable data, and never leak sensitive information. Do not swallow exceptions without an explicit reason.

## Change discipline

Before changing code: inspect relevant files, trace the execution path, inspect existing tests, identify the owning subsystem (Delivery / Work Session, Ask LOKIN, Route Optimizer, GPS / 4D GPS, Hotspots, Earnings, Earnings Intelligence, LOKIN Seal, Provider integrations, Subscription / Entitlements, Onboarding, LOKIN Vision / XR, Commerce, Safety & Control, Sensor Fusion, Learning Intelligence, Native packaging, Backend, Authentication, Persistence, Observability). Prefer modifying an existing abstraction over introducing a parallel implementation. Implement the smallest safe change.

Before editing, define the change boundary: files expected to change, files that must not. If implementation unexpectedly requires major changes outside it, stop and explain why before expanding scope.

Keep commits and diffs scoped. Do not mix feature work, unrelated cleanup, dependency upgrades, or formatting sweeps into the same change. When parallel agents operate, use isolated worktrees or otherwise separate mutable working state; agents editing overlapping files must coordinate rather than independently overwrite.

Never claim a command, test, build, deployment, or verification succeeded unless you actually executed or observed it.

## Testing

Tests should verify behavior, not implementation trivia. For regressions, first create or identify a reproducer when practical. Critical areas require explicit regression coverage: authentication, entitlements, session persistence, routing, navigation state, earnings calculations, provider normalization, permissions, account isolation. Never weaken a valid test simply to make CI pass.

## Where durable guidance lives

- This file: durable project laws only.
- `.codex/skills/`: repeatable operational procedures as reusable instruction bundles (manifest + resources). Do not expand this file with single-feature or single-session instructions.
- `docs/`: durable architecture documentation.
- Task-specific requirements belong in the task prompt, not here.

## Base44 working notes

This is a Base44 app repository; treat it as user-owned application code and preserve existing project conventions. Start with `README.md` for local setup, environment variables, and publish workflow.

- `.env.local` holds local-only values; never commit secrets.
- Use `base44 dev` as the default local development command (runs backend and frontend together). `npm run dev` is for frontend-only work against the hosted backend.
- Reuse the existing SDK client (`src/api/base44Client.js`) and Vite plugin patterns before adding new integration paths.
- Run the relevant checks from `package.json` before finishing code changes.
