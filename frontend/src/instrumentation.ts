export async function register() {
  // Keep the imports inside this check: the file is also compiled for the
  // edge runtime, where the Postgres driver cannot load.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  if (process.env.AUTH_DATABASE_URL) {
    const { migrateAuthDatabase } = await import('@/lib/authMigrate');
    // Postgres may still be starting when the container boots: retry for ~1 minute.
    for (let attempt = 1; ; attempt++) {
      try {
        await migrateAuthDatabase();
        break;
      } catch (err) {
        if (attempt >= 30) {
          console.error('[auth] Migration failed, sign-in will not work:', err);
          break;
        }
        console.warn(`[auth] Database not ready (attempt ${attempt}), retrying in 2s`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  } else {
    console.warn('[auth] AUTH_DATABASE_URL not set, skipping auth migrations');
  }

  const { startReaderSync } = await import('@/lib/reader/sync');
  startReaderSync();
}
