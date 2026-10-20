import { politeFetch } from './http.ts';

const BASE = 'https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user';

const stamp = (d: Date) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}0100`;

/** The last `months` full calendar months, as API start/end stamps. */
export function window(months: number, now = new Date()): { start: string; end: string } {
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (months - 1), 1));
  return { start: stamp(start), end: stamp(end) };
}

/** Human page views of one English Wikipedia article over the window. 0 if the API has no data. */
export async function totalViews(
  title: string,
  range: { start: string; end: string },
  signal?: AbortSignal,
): Promise<number> {
  const article = encodeURIComponent(title.replace(/ /g, '_'));
  const response = await politeFetch(`${BASE}/${article}/monthly/${range.start}/${range.end}`, {}, signal);
  if (response.status === 404) return 0;
  if (!response.ok) throw new Error(`Pageviews for "${title}" returned ${response.status}`);
  const data = (await response.json()) as { items: { views: number }[] };
  return data.items.reduce((sum, item) => sum + item.views, 0);
}

/** Runs `task` over `inputs` with a small fixed concurrency. */
export async function mapLimit<T, R>(inputs: T[], limit: number, task: (input: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(inputs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, inputs.length) }, async () => {
      while (next < inputs.length) {
        const index = next++;
        results[index] = await task(inputs[index]);
      }
    }),
  );
  return results;
}
