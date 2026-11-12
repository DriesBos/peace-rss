/**
 * Dev tools (the menu's Dev tab and the /dev pages) are on in local dev
 * (`next dev`) and in any build made with NEXT_PUBLIC_ENABLE_DEV_TOOLS=true,
 * which is how a preview build turns them on. Production builds leave the
 * flag unset, so the tab is hidden and /dev returns 404.
 *
 * Both values are inlined at build time.
 */
export const DEV_TOOLS_ENABLED =
  process.env.NODE_ENV !== 'production' ||
  process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS === 'true';

export const DEV_PAGES = [
  { href: '/dev/type', label: 'Type system' },
  { href: '/dev/components', label: 'Component system' },
  { href: '/dev/styles', label: 'Style system' },
] as const;
