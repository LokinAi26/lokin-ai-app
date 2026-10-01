/**
 * M1 device-protocol test hook (Scenario C).
 *
 * Exposes the snapshot guard and the relaunch report on
 * `globalThis.__LOKIN_M1__` so the older-snapshot injection step of the
 * TestFlight acceptance protocol can be driven from Safari Web Inspector.
 *
 * Observational only: considerBackendSnapshot never mutates the store
 * (it only reads the recovery manifest) and observeRelaunch only reads.
 * No legacy state is reachable through this hook.
 *
 * Installed automatically when the seams barrel loads (the barrel is
 * imported by DriverLayout, workStatusStore, and GlobalVoiceAssistant,
 * so the hook is present in every app session).
 */

import { considerBackendSnapshot } from "./snapshotGuard.js";
import { observeRelaunch } from "./lockInSeam.js";
import { getOperationalStore } from "../store/index.js";

export function installM1DebugHook(): void {
  (globalThis as Record<string, unknown>).__LOKIN_M1__ = {
    considerBackendSnapshot,
    observeRelaunch,
    getOperationalStore,
  };
}

installM1DebugHook();
