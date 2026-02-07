import 'server-only';

type SocialMetricEvent = {
  at: string;
  kind: string;
  details: Record<string, string | number | boolean>;
};

const MAX_EVENTS = 200;
const startedAt = new Date().toISOString();
const counters = new Map<string, number>();
const recentEvents: SocialMetricEvent[] = [];

function metricKey(
  name: string,
  labels?: Record<string, string | number | boolean | undefined>
): string {
  if (!labels) return name;

  const pieces = Object.entries(labels)
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`);

  if (pieces.length === 0) return name;
  return `${name}|${pieces.join(',')}`;
}

function clampMessage(value: string): string {
  if (value.length <= 180) return value;
  return `${value.slice(0, 177)}...`;
}

function addRecentEvent(event: SocialMetricEvent) {
  recentEvents.push(event);
  if (recentEvents.length > MAX_EVENTS) {
    recentEvents.splice(0, recentEvents.length - MAX_EVENTS);
  }
}

export function incrementSocialMetric(
  name: string,
  labels?: Record<string, string | number | boolean | undefined>,
  amount = 1
) {
  const key = metricKey(name, labels);
  counters.set(key, (counters.get(key) ?? 0) + amount);
}

export function recordSocialEvent(
  kind: string,
  details: Record<string, string | number | boolean | undefined>
) {
  const cleaned = Object.fromEntries(
    Object.entries(details)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [
        key,
        typeof value === 'string' ? clampMessage(value) : value,
      ])
  ) as Record<string, string | number | boolean>;

  addRecentEvent({
    at: new Date().toISOString(),
    kind,
    details: cleaned,
  });
}

export function getSocialMetricsSnapshot() {
  const countersObject = Object.fromEntries(
    Array.from(counters.entries()).sort(([a], [b]) => a.localeCompare(b))
  );

  return {
    started_at: startedAt,
    generated_at: new Date().toISOString(),
    counters: countersObject,
    recent_events: [...recentEvents],
  };
}
