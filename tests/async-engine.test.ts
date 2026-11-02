import { fetchPublicData } from '../src/async-engine/dataEngine';

describe('Async data engine', () => {
  it('should resolve successful data and surface failed requests independently', async () => {
    const originalFetch = global.fetch;

    global.fetch = jest.fn((input: string | URL) => {
      const url = String(input);

      if (url.includes('/users/1')) {
        return Promise.resolve(new Response(JSON.stringify({ id: 1, name: 'Ada' }), { status: 200 }));
      }

      if (url.includes('/posts/1')) {
        return Promise.reject(new Error('Network error'));
      }

      return Promise.resolve(new Response(JSON.stringify({ id: 1, title: 'todo', completed: false }), { status: 200 }));
    }) as typeof fetch;

    try {
      const results = await fetchPublicData();

      expect(results).toHaveLength(3);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(2);
      expect(results.some((result) => result.status === 'rejected')).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
