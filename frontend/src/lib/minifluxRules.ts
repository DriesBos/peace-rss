const REMOVE_CLICKBAIT_RULE = 'remove_clickbait';

function splitRewriteRules(value?: string): string[] {
  if (!value) return [];
  return value
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter(Boolean);
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
