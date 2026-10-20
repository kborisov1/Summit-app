/**
 * Serializes a prompt set in the repository's hand-written style: two-space
 * indent, with each answer and each short list on a single line.
 */
function inline(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(inline).join(', ')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${inline(v)}`);
    return `{ ${entries.join(', ')} }`;
  }
  return JSON.stringify(value);
}

function block(obj: Record<string, unknown>, indent: string, multiline: Record<string, (v: never) => string>): string {
  const inner = indent + '  ';
  const lines = Object.entries(obj).map(([k, v]) => {
    const custom = multiline[k];
    return `${inner}${JSON.stringify(k)}: ${custom ? custom(v as never) : inline(v)}`;
  });
  return `{\n${lines.join(',\n')}\n${indent}}`;
}

export function formatSet(set: Record<string, unknown>): string {
  const answers = (list: unknown[]) =>
    `[\n${list.map((a) => `        ${inline(a)}`).join(',\n')}\n      ]`;
  const prompts = (list: Record<string, unknown>[]) =>
    `[\n${list.map((p) => `    ${block(p, '    ', { answers })}`).join(',\n')}\n  ]`;
  return block(set, '', { prompts }) + '\n';
}
