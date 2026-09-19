/**
 * Timeouts and retries for provider calls.
 *
 * A provider that hangs is worse than one that fails: the request handler
 * holds a connection, the user watches a spinner, and nothing ever resolves.
 * Everything that crosses the network gets a deadline.
 */

export class TimeoutError extends Error {
  constructor(label: string, ms: number) {
    super(`${label} timed out after ${ms}ms`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label, ms)), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Retry with exponential backoff.
 *
 * Only for calls that are safe to repeat — reads. A submit is never retried
 * here: a request that reached the provider before the connection dropped
 * would be queued twice, and the second one is a render nobody asked for and
 * a bill nobody agreed to.
 */
export async function retry<T>(
  work: () => Promise<T>,
  options: { attempts?: number; baseMs?: number; label?: string } = {},
): Promise<T> {
  const { attempts = 3, baseMs = 250, label = "call" } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) break;
      // 250ms, 500ms, 1s… with jitter, so a provider hiccup does not turn into
      // every pending job retrying in lockstep.
      const delay = baseMs * 2 ** attempt * (0.5 + Math.random());
      await new Promise((done) => setTimeout(done, delay));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${label} failed`);
}
