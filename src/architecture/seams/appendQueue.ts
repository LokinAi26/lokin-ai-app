/**
 * M1 X6 — serialized observational event appends.
 *
 * SPEC-001: "sequenceNumber SHALL increase monotonically within a session"
 * (line 2941). Computing the next sequence outside the append transaction
 * lets two concurrent observers assign the same next sequence. All seam
 * append paths route through this module-level promise chain so
 * observational appends are single-writer: the next append starts only
 * after the previous one settled. A failed task never breaks the chain
 * (the chain itself never rejects); the caller still sees the task's real
 * outcome and may catch it.
 */
let tail: Promise<unknown> = Promise.resolve();

export function enqueueAppend<T>(task: () => Promise<T>): Promise<T> {
  const run = tail.then(task, task);
  tail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}
