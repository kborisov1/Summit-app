/**
 * Offline content tool (architecture "Content and Data Model"). Never imported by the game.
 *
 * For each prompt mapped in scripts/wikidata-prompts.json it asks Wikidata for every matching
 * item, adds missing answers and alternative names to the set file, then ranks the answers by
 * English Wikipedia page views and splits them into the five rarity tiers.
 *
 *   node scripts/enrich-wikidata.ts --set content/sets/sample-001.json [--write]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import type { PromptSet, Rarity } from '../src/game/types.ts';
import { formatSet } from './lib/format.ts';
import { cached } from './lib/http.ts';
import { mergePrompt, type WikiItem } from './lib/merge.ts';
import { mapLimit, totalViews, window } from './lib/pageviews.ts';
import { fetchEntries, type WikidataSource } from './lib/wikidata.ts';

interface PromptConfig extends WikidataSource {
  /** Hand-set tiers that win over the automatic split. */
  pins?: Record<string, Rarity>;
  /** Wikipedia titles to drop from the Wikidata result (items the class pulls in by mistake). */
  exclude?: string[];
  /** Wikipedia title -> preferred answer name, for titles that are not how players say it. */
  rename?: Record<string, string>;
}

interface Config {
  languages: string[];
  prompts: Record<string, PromptConfig>;
}

const { values } = parseArgs({
  options: {
    set: { type: 'string' },
    prompt: { type: 'string', multiple: true },
    write: { type: 'boolean', default: false },
    'keep-rarity': { type: 'boolean', default: false },
    months: { type: 'string', default: '12' },
    'max-aliases': { type: 'string', default: '6' },
    'no-cache': { type: 'boolean', default: false },
  },
});

if (!values.set) {
  console.error('Usage: node scripts/enrich-wikidata.ts --set <file> [--prompt <id>] [--write] [--keep-rarity] [--months 12] [--no-cache]');
  process.exit(1);
}

const config = JSON.parse(await readFile(new URL('./wikidata-prompts.json', import.meta.url), 'utf8')) as Config;
const raw = JSON.parse(await readFile(values.set, 'utf8')) as PromptSet;
const range = window(Number(values.months));
const useCache = !values['no-cache'];
console.log(`Page views window: ${range.start.slice(0, 6)} to ${range.end.slice(0, 6)} (English Wikipedia, human readers)\n`);

const prompts = [];
for (const prompt of raw.prompts) {
  const source = config.prompts[prompt.id];
  if (!source || (values.prompt && !values.prompt.includes(prompt.id))) {
    prompts.push(prompt);
    if (!source) console.log(`${prompt.id}: no Wikidata mapping, left as is\n`);
    continue;
  }

  const entries = await cached(`wikidata:${JSON.stringify(source)}:${config.languages}`, useCache, () =>
    fetchEntries(source, config.languages),
  );
  const exclude = new Set(source.exclude ?? []);
  const kept = entries.filter((entry) => !exclude.has(entry.title));
  const views = await mapLimit(kept, 2, (entry) =>
    cached(`views:${entry.title}:${range.start}:${range.end}`, useCache, () => totalViews(entry.title, range)),
  );
  const items: WikiItem[] = kept.map((entry, i) => {
    const name = source.rename?.[entry.title];
    const renamed = name
      ? { ...entry, label: name, title: name, aliases: [entry.label, entry.title, ...entry.aliases] }
      : entry;
    return { ...renamed, views: views[i] };
  });

  const { prompt: merged, report } = mergePrompt(prompt, items, {
    updateRarity: !values['keep-rarity'],
    maxAliases: Number(values['max-aliases']),
    pins: source.pins ?? {},
  });
  prompts.push(merged);

  const tierCounts = [1, 2, 3, 4, 5].map((t) => merged.answers.filter((a) => a.rarity === t).length);
  console.log(`${prompt.id}  (${prompt.answers.length} -> ${merged.answers.length} answers)`);
  console.log(`  Wikidata items: ${report.items}, matched existing: ${report.matched}/${prompt.answers.length}`);
  console.log(`  added ${report.added.length}: ${report.added.slice(0, 12).join(', ')}${report.added.length > 12 ? ', ...' : ''}`);
  console.log(`  aliases added: ${report.aliasesAdded}`);
  console.log(`  rarity changes: ${report.rarityChanges.length}${report.rarityChanges.length ? ' (' + report.rarityChanges.slice(0, 10).map((c) => `${c.canonical} ${c.from}->${c.to}`).join(', ') + ')' : ''}`);
  console.log(`  tier sizes 1..5: ${tierCounts.join(' / ')}${report.tiered ? '' : '  (too few items to tier)'}`);
  if (report.unmatched.length) console.log(`  NOT FOUND in Wikidata, untouched: ${report.unmatched.join(', ')}`);
  if (report.clashes.length) console.log(`  name clashes, skipped: ${report.clashes.join(', ')}`);
  console.log();
}

if (values.write) {
  await writeFile(values.set, formatSet({ ...raw, prompts }));
  console.log(`Wrote ${values.set}`);
} else {
  console.log('Dry run: nothing written. Add --write to update the file.');
}
