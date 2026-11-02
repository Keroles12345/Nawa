import { logger } from '../utils/logger';

export interface PublicUser {
  id: number;
  name: string;
  email: string;
}

export interface PublicPost {
  userId: number;
  id: number;
  title: string;
  body: string;
}

export interface PublicTodo {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
}

export type PublicCollection = PublicUser | PublicPost | PublicTodo;

export interface ProcessedDataResult {
  source: 'users' | 'posts' | 'todos';
  payload: PublicCollection | null;
  status: 'fulfilled' | 'rejected';
  error?: string;
}

export interface AsyncOperationResult<T> {
  source: string;
  payload: T | null;
  status: 'fulfilled' | 'rejected';
  error?: {
    name: string;
    message: string;
  };
}

export type AsyncOperation<T> = (signal: AbortSignal) => Promise<T>;

export interface AsyncEngineOptions {
  concurrency?: number;
  timeoutMs?: number;
}

function getErrorDetails(reason: unknown): { name: string; message: string } {
  if (reason instanceof Error) {
    return { name: reason.name, message: reason.message };
  }
  return { name: 'Error', message: String(reason) };
}

async function runWithTimeout<T>(operation: AsyncOperation<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      operation(controller.signal),
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => {
          controller.abort();
          reject(new Error(`Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function executeAsyncOperations<T>(
  operations: Record<string, AsyncOperation<T>>,
  options: AsyncEngineOptions = {},
): Promise<AsyncOperationResult<T>[]> {
  const entries = Object.entries(operations);
  const concurrency = options.concurrency ?? 5;
  const timeoutMs = options.timeoutMs ?? 10000;
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError('Concurrency must be a positive integer');
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError('Timeout must be a positive number of milliseconds');
  }

  const settledResults: PromiseSettledResult<T>[] = new Array(entries.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, entries.length) }, async () => {
    while (nextIndex < entries.length) {
      const index = nextIndex;
      nextIndex += 1;
      const [, operation] = entries[index];
      [settledResults[index]] = await Promise.allSettled([runWithTimeout(operation, timeoutMs)]);
    }
  });
  await Promise.allSettled(workers);

  return settledResults.map((result, index) => {
    if (result.status === 'fulfilled') {
      return { source: entries[index][0], payload: result.value, status: 'fulfilled' };
    }
    return {
      source: entries[index][0],
      payload: null,
      status: 'rejected',
      error: getErrorDetails(result.reason),
    };
  });
}

export async function fetchPublicData(): Promise<ProcessedDataResult[]> {
  const operations: Record<string, AsyncOperation<PublicCollection>> = {
    users: async (signal) => {
      const response = await fetch('https://jsonplaceholder.typicode.com/users/1', { signal });
      if (!response.ok) {
        throw new Error(`users endpoint failed with ${response.status}`);
      }
      return await response.json() as PublicUser;
    },
    posts: async (signal) => {
      const response = await fetch('https://jsonplaceholder.typicode.com/posts/1', { signal });
      if (!response.ok) {
        throw new Error(`posts endpoint failed with ${response.status}`);
      }
      return await response.json() as PublicPost;
    },
    todos: async (signal) => {
      const response = await fetch('https://jsonplaceholder.typicode.com/todos/1', { signal });
      if (!response.ok) {
        throw new Error(`todos endpoint failed with ${response.status}`);
      }
      return await response.json() as PublicTodo;
    },
  };

  const results = await executeAsyncOperations(operations, { concurrency: 3, timeoutMs: 10000 });
  const sources: ProcessedDataResult['source'][] = ['users', 'posts', 'todos'];
  return results.map((result, index) => {
    if (result.status === 'rejected') {
      logger.error(`Async data fetch failed for ${result.source}: ${result.error?.message}`);
    }
    return {
      source: sources[index],
      payload: result.payload,
      status: result.status,
      error: result.error?.message,
    };
  });
}
