export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (!process.env.AUTH_DATABASE_URL) {
    console.warn('[auth] AUTH_DATABASE_URL not set, skipping auth migrations');
    return;
  }

  const { migrateAuthDatabase } = await import('@/lib/authMigrate');
  try {
    await migrateAuthDatabase();
  } catch (err) {
    console.error('[auth] Migration failed:', err);
    throw err;
  }
}
