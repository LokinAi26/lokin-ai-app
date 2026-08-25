# LOKIN Sensor Fusion v2.1 — Physical Field Calibration

Synthetic regression is automated by `npm run verify:navigation`. The scenarios below are the required physical-device gate before the native fusion engine is marked production-validated.

## Required devices

- One current iPhone on the latest production iOS supported by the submission.
- One representative Android device on a currently supported Android release.
- Record exact model, OS build, LOKIN build number, and whether Low Power/Battery Saver was active.

## Scenarios

### 1. Tunnel / parking garage

1. Begin active LOKIN navigation with a stable absolute fix (reported accuracy <= 15 m).
2. Enter a real tunnel/covered garage where GNSS degrades.
3. Verify `deadReckoned=true`, `authoritative=false`, `anchorSeq` remains the last absolute anchor, and the map continues advancing without a false network reroute.
4. Verify prediction stops after the 20 s calibrated horizon if no new absolute fix arrives.
5. On GNSS recovery, verify the absolute anchor becomes authoritative and convergence does not teleport to an implausible road.

Capture: outage duration, maximum uncertainty, minimum confidence, maximum displayed route error, false reroute count, recovery jump distance.

### 2. Highway parallel-road / frontage-road

Drive a route with a nearby parallel road or divided highway. Verify the online HMM keeps the vehicle on the directionally correct segment using heading and continuity. Capture wrong-road snaps and HMM match confidence.

### 3. Urban canyon

Drive between tall buildings where horizontal accuracy degrades. Verify the adaptive threshold widens, requires repeated absolute evidence before rerouting, and does not oscillate between parallel streets. Capture p50/p95 location accuracy, wrong-road snaps, reroute count, and match confidence.

### 4. Battery profile

Run 60 minutes of active navigation. Record battery level at start/end, Low Power/Battery Saver state, screen-on duration, temperature/thermal warnings, and GPS/IMU profile. Repeat once with Low Power/Battery Saver enabled. The first validated device run establishes the baseline; later builds must not regress battery drop per hour by more than 15% relative to that baseline without an explicit performance justification.

### 5. Offline recovery

Start navigation online, disable data connectivity while keeping location enabled, continue driving, then restore connectivity. Confirm authoritative and dead-reckoned samples remain in SQLite with monotonic sequence numbers and anchor lineage. Queue acknowledgement may delete only through the backend `acceptedThrough` sequence after a successful upload.

### 6. Background / screen lock

Start active navigation in the foreground, background LOKIN, lock the screen, drive a short safe route, then reopen. Verify the OS-authorized background location path continued, the local queue has no sequence collision, and the foreground UI resumes from the latest valid state.

## Reporting contract

Submit a completed run to authenticated Base44 function `navigation-calibration-report`:

```json
{
  "scenario": "tunnel_garage",
  "platform": "ios",
  "result": "pass",
  "build_id": "2.131675.4",
  "metrics": {
    "device_model": "<actual device>",
    "os_version": "<actual OS>",
    "outage_duration_s": 0,
    "max_uncertainty_m": 0,
    "min_confidence": 0,
    "false_reroutes": 0,
    "recovery_jump_m": 0
  }
}
```

Allowed scenario names: `tunnel_garage`, `highway_parallel_road`, `urban_canyon`, `battery_profile`, `offline_recovery`, `background_screen_lock`.

Do not fabricate a pass. A scenario remains `incomplete` until it has been exercised on the physical device named in the metrics.
