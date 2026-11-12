export async function register() {
  // Keep the import inside this check: the file is also compiled for the
  // edge runtime, where the Postgres driver cannot load.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startReaderSync } = await import('@/lib/reader/sync');
    startReaderSync();
  }
}
