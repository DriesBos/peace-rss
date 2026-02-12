export function formatReadingTime(minutes?: number | null): string {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return '';
  if (minutes <= 0) return '';

  const rounded = Math.max(1, Math.round(minutes));
  return rounded === 1 ? '1 min read' : `${rounded} min read`;
}
