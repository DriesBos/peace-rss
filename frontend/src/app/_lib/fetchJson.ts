export async function fetchJson<T>(
  input: string,
  init?: RequestInit
): Promise<T> {
  let res: Response;

  try {
    res = await fetch(input, {
      cache: 'no-store',
      ...init,
      headers: {
        'cache-control': 'no-store',
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    const message =
      err instanceof Error && err.message
        ? err.message
        : 'Failed to fetch (network error)';
    throw new Error(`Network error: ${message}`);
  }

  if (!res.ok) {
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const data = (await res.json().catch(() => null)) as unknown;
      if (
        data &&
        typeof data === 'object' &&
        'error' in data &&
        typeof (data as { error?: unknown }).error === 'string'
      ) {
        throw new Error((data as { error: string }).error);
      }
    }

    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}
