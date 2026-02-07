const MANAGED_WORD_RULE_RE = /^EntryTitle=\(\?i\)\\b([a-z0-9_-]+)\\b$/;
const FILTER_WORD_RE = /^[a-z0-9_-]+$/;
const REMOVE_CLICKBAIT_RULE = 'remove_clickbait';

function splitRuleLines(value?: string): string[] {
  if (!value) return [];
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitRewriteRules(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function parseManagedFilterWordsFromBlocklistRules(
  blocklistRules?: string
): string[] {
  const words: string[] = [];
  for (const line of splitRuleLines(blocklistRules)) {
    const match = line.match(MANAGED_WORD_RULE_RE);
    if (!match) continue;
    words.push(match[1]);
  }
  return words;
}

export function parseFilterWordsInput(input: string): {
  words: string[];
  invalid: string[];
} {
  const rawItems = input
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

  const words: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();

  for (const rawItem of rawItems) {
    const normalized = rawItem.toLowerCase();
    if (!FILTER_WORD_RE.test(normalized)) {
      invalid.push(rawItem);
      continue;
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    words.push(normalized);
  }

  return { words, invalid };
}

export function mergeManagedFilterWordsIntoBlocklistRules(
  existingRules: string | undefined,
  words: string[]
): string {
  const unmanagedLines = splitRuleLines(existingRules).filter(
    (line) => !MANAGED_WORD_RULE_RE.test(line)
  );
  const managedLines = words.map((word) => `EntryTitle=(?i)\\b${word}\\b`);
  return [...unmanagedLines, ...managedLines].join('\n');
}

export function hasRemoveClickbaitRule(rewriteRules?: string): boolean {
  return splitRewriteRules(rewriteRules).some(
    (rule) => rule.toLowerCase() === REMOVE_CLICKBAIT_RULE
  );
}

export function setRemoveClickbaitRule(
  existingRules: string | undefined,
  enabled: boolean
): string {
  const deduped = new Set<string>();
  const rewritten = splitRewriteRules(existingRules).filter((rule) => {
    const normalized = rule.toLowerCase();
    if (normalized === REMOVE_CLICKBAIT_RULE) return false;
    if (deduped.has(normalized)) return false;
    deduped.add(normalized);
    return true;
  });

  if (enabled) {
    rewritten.push(REMOVE_CLICKBAIT_RULE);
  }

  return rewritten.join(',');
}
