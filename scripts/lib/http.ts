import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const USER_AGENT = 'SummitContentScript/0.1 (https://github.com/kborisov1/Summit; offline content tool)';
const CACHE_DIR = path.join(import.meta.dirname, '..', '.cache');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Fetches with a descriptive User-Agent and retries on rate limits and server errors. */
export async function politeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, {
      ...init,
      headers: { 'User-Agent': USER_AGENT, ...init.headers },
      signal: AbortSignal.timeout(120_000),
    });
    const retryable = response.status === 429 || response.status >= 500;
    if (!retryable || attempt >= 6) return response;
    const retryAfter = Number(response.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * 2 ** attempt);
  }
}

/** Disk cache so repeated runs do not hit the APIs again. */
export async function cached<T>(key: string, useCache: boolean, load: () => Promise<T>): Promise<T> {
  const file = path.join(CACHE_DIR, `${createHash('sha1').update(key).digest('hex')}.json`);
  if (useCache) {
    try {
      return JSON.parse(await readFile(file, 'utf8')) as T;
    } catch {
      // not cached yet
    }
  }
  const value = await load();
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(file, JSON.stringify(value));
  return value;
}
