// withTimeout — race any promise against a wall-clock timeout so a hung
// fetch can never leave a loading spinner up forever. The underlying promise
// is left to settle on its own; the timeout only unblocks the UI path, which
// then takes its normal error/retry route. Never used to fabricate data —
// a timeout always surfaces as an error the caller already knows how to show.
export function withTimeout(promise, ms, message) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message || `Timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
