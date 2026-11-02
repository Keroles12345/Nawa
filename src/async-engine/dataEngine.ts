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

export async function fetchPublicData(): Promise<ProcessedDataResult[]> {
  const promises = [
    fetch('https://jsonplaceholder.typicode.com/users/1').then(async (response) => {
      if (!response.ok) {
        throw new Error(`users endpoint failed with ${response.status}`);
      }
      return { source: 'users' as const, payload: (await response.json()) as PublicUser };
    }),
    fetch('https://jsonplaceholder.typicode.com/posts/1').then(async (response) => {
      if (!response.ok) {
        throw new Error(`posts endpoint failed with ${response.status}`);
      }
      return { source: 'posts' as const, payload: (await response.json()) as PublicPost };
    }),
    fetch('https://jsonplaceholder.typicode.com/todos/1').then(async (response) => {
      if (!response.ok) {
        throw new Error(`todos endpoint failed with ${response.status}`);
      }
      return { source: 'todos' as const, payload: (await response.json()) as PublicTodo };
    }),
  ];

  const settled = await Promise.allSettled(promises);

  return settled.map((result, index) => {
    if (result.status === 'fulfilled') {
      return {
        source: result.value.source,
        payload: result.value.payload,
        status: 'fulfilled',
      };
    }

    const sources: Array<'users' | 'posts' | 'todos'> = ['users', 'posts', 'todos'];
    logger.error(`Async data fetch failed for ${sources[index]}: ${result.reason}`);
    return {
      source: sources[index],
      payload: null,
      status: 'rejected',
      error: String(result.reason),
    };
  });
}
