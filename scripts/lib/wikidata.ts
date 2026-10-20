import { politeFetch } from './http.ts';

const ENDPOINT = 'https://query.wikidata.org/sparql';
const SEPARATOR = '|';

export interface WikidataEntry {
  id: string;
  label: string;
  title: string;
  /** English alternative names ("also known as"). */
  aliases: string[];
}

export interface WikidataSource {
  /** SPARQL triple patterns that bind `?item`. */
  where: string;
  /** Keep only items with at least this many Wikipedia/Wikimedia sitelinks (a fame floor for huge classes). */
  minSitelinks?: number;
}

export function buildQuery(source: WikidataSource): string {
  return `
SELECT ?item ?label ?title
  (GROUP_CONCAT(DISTINCT ?alias; separator="${SEPARATOR}") AS ?aliases)
WHERE {
  ${source.where}
  ?item rdfs:label ?label . FILTER(lang(?label) = "en")
  ?article schema:about ?item ;
           schema:isPartOf <https://en.wikipedia.org/> ;
           schema:name ?title .
  ?item wikibase:sitelinks ?links . FILTER(?links >= ${source.minSitelinks ?? 0})
  OPTIONAL { ?item skos:altLabel ?alias . FILTER(lang(?alias) = "en") }
}
GROUP BY ?item ?label ?title`;
}

interface Binding {
  [name: string]: { value: string };
}

export async function fetchEntries(source: WikidataSource): Promise<WikidataEntry[]> {
  const response = await politeFetch(ENDPOINT, {
    method: 'POST',
    headers: { Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ query: buildQuery(source) }),
  });
  if (!response.ok) throw new Error(`Wikidata returned ${response.status}: ${(await response.text()).slice(0, 300)}`);
  const data = (await response.json()) as { results: { bindings: Binding[] } };
  const split = (value: string | undefined) => (value ? value.split(SEPARATOR).filter(Boolean) : []);
  return data.results.bindings.map((b) => ({
    id: b.item.value.split('/').pop()!,
    label: b.label.value,
    title: b.title.value,
    aliases: split(b.aliases?.value),
  }));
}
