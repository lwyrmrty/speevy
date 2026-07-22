const DEFAULT_CONCURRENCY = 5;
const DEFAULT_RETRIES = 4;
const DEFAULT_BASE_DELAY_MS = 250;

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRateLimitError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes('rate limit') || message.includes('429');
}

/**
 * Run async work over items with limited concurrency so we don't stampede
 * upstream APIs (Loops transactional is ~10 req/s).
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency = DEFAULT_CONCURRENCY,
): Promise<PromiseSettledResult<R>[]> {
  if (items.length === 0) {
    return [];
  }

  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;

      try {
        const value = await worker(items[current], current);
        results[current] = { status: 'fulfilled', value };
      } catch (reason) {
        results[current] = { status: 'rejected', reason };
      }
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runWorker()));
  return results;
}

/**
 * Retry Loops sends on transient rate-limit errors with exponential backoff.
 */
export async function withLoopsRetry<T>(
  operation: () => Promise<T>,
  options: {
    retries?: number;
    baseDelayMs?: number;
    label?: string;
  } = {},
): Promise<T> {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      attempt += 1;

      if (!isRateLimitError(error) || attempt > retries) {
        throw error;
      }

      const delayMs = baseDelayMs * 2 ** (attempt - 1);
      console.warn(
        `${options.label ?? 'Loops send'} rate-limited; retry ${attempt}/${retries} in ${delayMs}ms`,
      );
      await sleep(delayMs);
    }
  }
}

export function summarizeSettledResults(
  results: PromiseSettledResult<unknown>[],
  label: string,
) {
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  const sent = results.length - failures.length;

  if (failures.length > 0) {
    const first = failures[0]?.reason;
    const firstMessage = first instanceof Error ? first.message : String(first);
    console.error(
      `${label}: sent ${sent}/${results.length}; ${failures.length} failed. First error: ${firstMessage}`,
    );
  } else if (results.length > 0) {
    console.info(`${label}: sent ${sent}/${results.length}`);
  }

  return { sent, failed: failures.length };
}
