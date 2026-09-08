// Bounds the response wait; underlying SDK operations may continue after timeout.
export async function withDeadline(operation, milliseconds, stage) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(operation),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const error = new Error(`Route optimization timed out during ${stage}. Please try again.`);
          error.code = "LOKIN_ROUTE_TIMEOUT";
          error.status = 504;
          reject(error);
        }, milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
