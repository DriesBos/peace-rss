# Reader SSR Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the returning-user startup waterfall: skip `/api/bootstrap` for already-provisioned users and hydrate TanStack Query from server-fetched data so the reader shows feeds/categories/entries the instant the client hydrates — with no client-side refetch round-trip. Also shrink `page.tsx` by moving modal form state into the modals.

**What this delivers (and what it does not):** `ReaderApp` stays a Client Component because it reads `useSearchParams`, so it renders inside a `<Suspense>` boundary and is **not** server-painted into the initial HTML. The win is the hydrated cache (no client fetch waterfall) plus skipping bootstrap — not server-rendered content. If true server-painted HTML is required, see the **SSR-paint note** in Task 3 Step 3.

**Architecture:** Keep TanStack Query because it is already installed and wired through `QueryProvider`. Add one server-only reader data module that fetches initial Miniflux data and seeds Query with `dehydrate()`. Extract a shared Clerk-token helper and a shared preferences-normalizer (rather than re-inlining either) so the SSR path and the client path cannot drift. Split the current client page into `ReaderApp.tsx`, then move modal form state into the modals.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Clerk, TanStack Query 5, Miniflux API, Sass modules, Docker Compose production build.

---

## Current State

- `frontend/src/app/page.tsx` is a 1,366-line Client Component.
- `frontend/src/hooks/useReaderData.ts` already uses TanStack Query for feeds, categories, and infinite entries.
- `frontend/src/app/page.tsx` already uses TanStack Query for preferences, all count, starred count, and starred entries.
- Returning users still start with `isProvisioned=false`, POST `/api/bootstrap`, then enable the Query reads.
- `AddModal` and `EditModal` still receive 18 props each.

### Constraints discovered (do not skip — these are where the plan can silently break)

- **Client reads go through `/api/*` route handlers, not Miniflux directly.** `/api/entries` enriches every entry with `preview` and `thumbnail_url` via `withEntryListMeta` (`frontend/src/lib/entryListMeta.ts`); `EntryList` renders exactly those fields. Server seeds **must** apply the same transform, or the first paint shows entries with no previews/thumbnails until a refetch replaces them — a visible flash that defeats the goal.
- **The Clerk token lookup (`auth() → clerkClient → privateMetadata.minifluxToken`) is inlined in ~15 route handlers** with no shared helper. `normalizeReaderPreferences` + `DEFAULT_READER_PREFERENCES` are duplicated in `page.tsx`. This plan extracts both rather than adding more copies.
- **The entries query key uses an *unclamped* `pageSize`** (the preference value), while `/api/entries` clamps the actual fetch to 500. The seed key must use the unclamped value (to match the client key); the seed *fetch* must clamp to 500 (to match the route's returned row count).
- Local verification baseline: `npm run lint` passes.

## Execution Mode

- Use one lead agent to own the branch, make edits, run checks, and resolve conflicts.
- Do not split implementation across multiple coding agents. The main files overlap too much: `page.tsx`, `ReaderApp.tsx`, modal props, and Query hydration all touch shared state.
- **Land in two stages.** SSR + bootstrap-skip (Tasks 1–4) is one logical change; the modal refactors (Tasks 5–6) are independent. Ship and verify the SSR stage first, then do the modals as a follow-up commit/PR. Bundling a subtle hydration change with two large prop-refactors makes one diff that is hard to review and hard to roll back.
- Use subagents for review checkpoints only. They should inspect the diff and report findings; they should not edit files unless the lead agent explicitly takes over that fix.
- **Manual browser checks (Tasks 4 and 7) need a live Clerk-authenticated, provisioned user plus a running Docker/Miniflux stack with feeds.** If the implementing agent cannot authenticate, those steps cannot be executed — run the non-interactive checks in Task 4 instead, and report the manual checks as **skipped**, not passed.

Review checkpoints:
- After Task 2: confirm seeded entries carry `preview`/`thumbnail_url` (match `/api/entries`), the page-size clamp is applied, and the Clerk-token + preferences helpers are shared, not re-inlined.
- After Task 3: review Server Component, Suspense, Clerk auth, and TanStack Query hydration boundaries; confirm exactly one bootstrap effect remains.
- After Task 5: review `AddModal` state ownership, the discovered-feed round-trip, reset-on-URL-edit, and `preventDefault`.
- After Task 6: review `EditModal` state ownership, stale target/reset, delete-path rewire to `target.item.id`, and `preventDefault`.
- After Task 7: final diff review focused on regressions and missed manual smoke checks.

## File Map

- Create `frontend/src/lib/minifluxAuth.ts`: shared server-only `getMinifluxToken()` extracted from the route-handler copies. Reused by `readerServer.ts`.
- Create `frontend/src/lib/readerPrefs.ts`: shared `DEFAULT_READER_PREFERENCES` + `normalizeReaderPreferences` extracted from `page.tsx`. Imported by both `readerServer.ts` and `ReaderApp.tsx`.
- Create `frontend/src/lib/readerServer.ts`: server-only initial Miniflux reads, with entry-list enrichment to match `/api/entries` and graceful error fallback.
- Modify `frontend/src/app/page.tsx`: make it a Server Component that hydrates TanStack Query and renders the client island inside Suspense.
- Create `frontend/src/app/ReaderApp.tsx`: move the current client page code here; import the shared preferences normalizer instead of keeping a local copy.
- Modify `frontend/src/hooks/useReaderData.ts`: keep existing Query flow; only add small support needed for hydrated infinite data if build exposes a typing gap.
- Modify `frontend/src/components/AddModal/AddModal.tsx`: own add form state locally and submit payloads upward.
- Modify `frontend/src/components/EditModal/EditModal.tsx`: own edit form state locally and submit payloads upward.
- Modify route handlers only if repeated auth helper extraction stays small; do not block SSR on full API cleanup. (Migrating the ~15 inlined token lookups to `getMinifluxToken()` is optional follow-up; this plan only requires `readerServer.ts` to use it.)

---

### Task 1: Sync And Baseline

**Files:**
- Read: `frontend/src/app/page.tsx`
- Read: `frontend/src/hooks/useReaderData.ts`
- Read: `frontend/src/lib/readerQueryKeys.ts`
- Read: `frontend/src/components/QueryProvider/QueryProvider.tsx`
- Read: `frontend/src/app/api/entries/route.ts` and `frontend/src/lib/entryListMeta.ts`

- [ ] **Step 1: Verify checkout state**

Run:
```bash
git status --short --branch
git ls-remote origin refs/heads/main
git rev-parse HEAD
```

Expected: clean worktree; `HEAD` equals remote `refs/heads/main`.

- [ ] **Step 2: Verify current app compiles before edits**

Run:
```bash
cd frontend
npm run lint
```

Expected: `eslint` exits 0.

- [ ] **Step 3: Confirm current Query adoption and the entry-enrichment transform**

Run:
```bash
rg -n "QueryClientProvider|useQuery|useInfiniteQuery|readerQueryKeys" frontend/src
rg -n "withEntryListMeta" frontend/src
```

Expected: `QueryProvider`, `useReaderData`, and `page.tsx` already use TanStack Query; `withEntryListMeta` is applied inside `/api/entries` and consumed by `EntryList`. Note its import path and call shape — the server seed will reuse it.

---

### Task 2: Add Shared Helpers And Server Reader Data

**Files:**
- Create: `frontend/src/lib/minifluxAuth.ts`
- Create: `frontend/src/lib/readerPrefs.ts`
- Create: `frontend/src/lib/readerServer.ts`
- Read: `frontend/src/lib/miniflux.ts`
- Read: `frontend/src/lib/entryListMeta.ts`
- Read: `frontend/src/app/_lib/types.ts`
- Read: `frontend/src/lib/readerQueryKeys.ts`
- Read: `frontend/src/app/api/me/route.ts` (the canonical token-lookup to extract)

- [ ] **Step 1: Extract the shared Clerk-token helper**

Create `frontend/src/lib/minifluxAuth.ts` (lift the lookup verbatim from `api/me/route.ts`):

```ts
import 'server-only';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { cache } from 'react';

export type MinifluxIdentity = {
  userId: string;
  token: string;
  minifluxUsername: string | null;
};

// Single source of truth for "who is this request and what is their Miniflux token".
// Wrapped in cache() so multiple server callers in one request dedupe the Clerk reads.
export const getMinifluxToken = cache(
  async (): Promise<MinifluxIdentity | null> => {
    const { userId } = await auth();
    if (!userId) return null;

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const metadata = user.privateMetadata as
      | { minifluxToken?: string; minifluxUsername?: string }
      | undefined;

    if (!metadata?.minifluxToken) return null;

    return {
      userId,
      token: metadata.minifluxToken,
      minifluxUsername: metadata.minifluxUsername ?? null,
    };
  },
);
```

- [ ] **Step 2: Extract the shared preferences normalizer**

Create `frontend/src/lib/readerPrefs.ts` (identical logic to the current `page.tsx` copy so the fixpoint is guaranteed):

```ts
import type { ReaderPreferences } from '@/app/_lib/types';
import { DEFAULT_ENTRIES_PAGE_SIZE } from '@/lib/entriesQuery';

export const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  id: 0,
  entries_per_page: DEFAULT_ENTRIES_PAGE_SIZE,
  keyboard_shortcuts: true,
  show_reading_time: true,
  entry_swipe: true,
};

export function normalizeReaderPreferences(
  data: ReaderPreferences | undefined,
): ReaderPreferences {
  return {
    ...DEFAULT_READER_PREFERENCES,
    ...(data ?? {}),
    entries_per_page:
      data && data.entries_per_page > 0
        ? data.entries_per_page
        : DEFAULT_ENTRIES_PAGE_SIZE,
  };
}
```

- [ ] **Step 3: Create the server reader-data module**

Create `frontend/src/lib/readerServer.ts`:

```ts
import 'server-only';

import { cache } from 'react';
import type {
  Category,
  EntriesResponse,
  Feed,
  ReaderPreferences,
} from '@/app/_lib/types';
import { withEntryListMeta } from '@/lib/entryListMeta';
import { getMinifluxToken } from '@/lib/minifluxAuth';
import { mfFetchUser } from '@/lib/miniflux';
import { normalizeReaderPreferences } from '@/lib/readerPrefs';

export type InitialReaderData = {
  provisioned: boolean;
  preferences: ReaderPreferences | null;
  feeds: Feed[];
  categories: Category[];
  entries: EntriesResponse | null;
  allCount: EntriesResponse | null;
  starredCount: EntriesResponse | null;
};

const EMPTY: InitialReaderData = {
  provisioned: false,
  preferences: null,
  feeds: [],
  categories: [],
  entries: null,
  allCount: null,
  starredCount: null,
};

function entriesPath(limit: number): string {
  const qs = new URLSearchParams({
    // ponytail: mirror /api/entries MAX_ENTRIES_LIMIT=500 so the seeded first
    // page can never hold more rows than a client refetch returns. If that
    // ceiling changes in api/entries/route.ts, change it here too.
    limit: String(Math.min(limit, 500)),
    offset: '0',
    order: 'published_at',
    direction: 'desc',
    status: 'unread',
    globally_visible: 'true',
  });
  return `/v1/entries?${qs.toString()}`;
}

export const getInitialReaderData = cache(
  async (): Promise<InitialReaderData> => {
    // If we cannot even resolve identity (e.g. Clerk hiccup), treat as
    // unprovisioned and let the client bootstrap path take over — never 500.
    const identity = await getMinifluxToken().catch(() => null);
    if (!identity) return EMPTY;

    try {
      const preferences = normalizeReaderPreferences(
        await mfFetchUser<ReaderPreferences>(identity.token, '/v1/me'),
      );

      const [feeds, categories, rawEntries, allCount, starredCount] =
        await Promise.all([
          mfFetchUser<Feed[]>(identity.token, '/v1/feeds'),
          mfFetchUser<Category[]>(identity.token, '/v1/categories?counts=true'),
          // NOTE: key pageSize stays unclamped (preferences.entries_per_page);
          // only the fetch limit is clamped inside entriesPath.
          mfFetchUser<EntriesResponse>(
            identity.token,
            entriesPath(preferences.entries_per_page),
          ),
          mfFetchUser<EntriesResponse>(
            identity.token,
            '/v1/entries?status=all&globally_visible=true&offset=0&limit=1',
          ),
          mfFetchUser<EntriesResponse>(
            identity.token,
            '/v1/entries?starred=true&offset=0&limit=1',
          ),
        ]);

      // Match the /api/entries response shape exactly: the route enriches every
      // entry with preview + thumbnail_url, and EntryList renders those fields.
      // Without this, the hydrated first paint shows no previews/thumbnails.
      const entries: EntriesResponse = {
        ...rawEntries,
        entries: rawEntries.entries.map((entry) => withEntryListMeta(entry)),
      };

      return {
        provisioned: true,
        preferences,
        feeds,
        categories,
        entries,
        allCount, // only .total is read for counts; entries arrays unused -> leave raw
        starredCount,
      };
    } catch {
      // Token exists (user IS provisioned) but Miniflux failed transiently.
      // Skip bootstrap, seed nothing, and let the client queries refetch/error
      // gracefully instead of crashing the server render.
      return { ...EMPTY, provisioned: true };
    }
  },
);
```

- [ ] **Step 4: Replace the duplicated normalizer usage that will land in `ReaderApp`**

The `page.tsx` body still defines its own `DEFAULT_READER_PREFERENCES` and `normalizeReaderPreferences`. When that body moves to `ReaderApp.tsx` in Task 3, delete the local copies and import from `@/lib/readerPrefs` instead. (Doing it now in `page.tsx` is fine too — either way there must be exactly one definition.)

- [ ] **Step 5: Run lint**

Run:
```bash
cd frontend
npm run lint
```

Expected: lint passes. If Miniflux response typing is too narrow, adjust only the imported shared types. Confirm `withEntryListMeta` is callable with a single entry argument (it is used as a per-entry transform).

---

### Task 3: Split Server Page And Client Reader App

**Files:**
- Modify: `frontend/src/app/page.tsx`
- Create: `frontend/src/app/ReaderApp.tsx`

- [ ] **Step 1: Move existing client page into `ReaderApp.tsx`**

Copy the current contents of `frontend/src/app/page.tsx` into `frontend/src/app/ReaderApp.tsx`.

In `ReaderApp.tsx`, keep `'use client';` and change the component signature:

```tsx
export function ReaderApp({
  initialProvisioned,
}: {
  initialProvisioned: boolean;
}) {
  const [isProvisioned, setIsProvisioned] = useState(initialProvisioned);
  // keep the rest of the current component body
}
```

Remove this old line inside the moved component:

```tsx
const [isProvisioned, setIsProvisioned] = useState(false);
```

Also delete the moved component's local `DEFAULT_READER_PREFERENCES` / `normalizeReaderPreferences` and import them from `@/lib/readerPrefs` (per Task 2 Step 4). Keep passing `pageSize={readerPreferences.entries_per_page}` into `useReaderData` — the entries-key match depends on this being the **hydrated** normalized value, not a literal default.

- [ ] **Step 2: Keep bootstrap only for unprovisioned users, and remove the old mount effect**

In `ReaderApp.tsx`, replace the bootstrap mount effect. The current code has a separate auto-run effect (`useEffect(() => { void bootstrap(); }, [])`, near the bottom of the component, far from the `bootstrap()` definition). **Delete that effect** and add this one (placed next to `bootstrap()`):

```tsx
useEffect(() => {
  if (isProvisioned) return;
  void bootstrap();
  // Bootstrap should run only until the server/client provisioned flag is true.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isProvisioned]);
```

Confirm afterward that **exactly one** bootstrap effect remains (grep `void bootstrap()` in `ReaderApp.tsx`). Keep the `provisionError` retry block and the "Setting up your account…" interstitial — they still render for the genuinely-unprovisioned (`initialProvisioned=false`) path.

- [ ] **Step 3: Replace `page.tsx` with server hydration**

Replace `frontend/src/app/page.tsx` with:

```tsx
import { Suspense } from 'react';
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import type { EntriesResponse } from '@/app/_lib/types';
import { ReaderApp } from '@/app/ReaderApp';
import { DEFAULT_ENTRIES_PAGE_SIZE } from '@/lib/entriesQuery';
import { getInitialReaderData } from '@/lib/readerServer';
import { readerQueryKeys, type EntriesQueryParams } from '@/lib/readerQueryKeys';

function defaultEntriesParams(pageSize: number): EntriesQueryParams {
  return {
    pageSize,
    searchMode: false,
    searchQuery: '',
    isStarredView: false,
    selectedCategoryId: null,
    statusFilter: 'unread',
  };
}

export default async function Home() {
  const initialData = await getInitialReaderData();
  const queryClient = new QueryClient();

  if (initialData.preferences) {
    queryClient.setQueryData(
      readerQueryKeys.preferences,
      initialData.preferences,
    );
  }

  queryClient.setQueryData(readerQueryKeys.feeds, initialData.feeds);
  queryClient.setQueryData(readerQueryKeys.categories, initialData.categories);

  if (initialData.allCount) {
    queryClient.setQueryData(readerQueryKeys.allCount, initialData.allCount);
  }

  if (initialData.starredCount) {
    queryClient.setQueryData(
      readerQueryKeys.starredCount,
      initialData.starredCount,
    );
  }

  if (initialData.entries) {
    // pageSize for the KEY must be the unclamped preference value so it matches
    // the client's entriesParams.pageSize (useReaderData passes it straight in).
    const pageSize =
      initialData.preferences?.entries_per_page ?? DEFAULT_ENTRIES_PAGE_SIZE;
    queryClient.setQueryData<InfiniteData<EntriesResponse>>(
      readerQueryKeys.entries(defaultEntriesParams(pageSize)),
      {
        pages: [initialData.entries],
        pageParams: [0],
      },
    );
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {/* Skeleton, not null: ReaderApp renders client-side under this boundary,
          so null would show a blank reader region until hydration. Swap this
          placeholder for the app's real loading skeleton. */}
      <Suspense fallback={<div aria-busy="true" aria-label="Loading reader" />}>
        <ReaderApp initialProvisioned={initialData.provisioned} />
      </Suspense>
    </HydrationBoundary>
  );
}
```

**SSR-paint note (read before assuming this server-renders content):** because `ReaderApp` reads `useSearchParams`, Next renders the **fallback** into the initial HTML and hydrates the reader on the client. So this does not produce server-painted entries — it produces an instant hydrated cache (no client refetch waterfall) plus a skeleton-until-JS region. That is the right trade-off for an auth-gated reader. If you genuinely need server-painted HTML, do the extra work: pull the single `useSearchParams` usage (the `?openAdd` query-param effect) into a tiny leaf wrapped in its own `<Suspense>`, remove `useSearchParams` from `ReaderApp` itself, and then `ReaderApp` will SSR into HTML. Decide explicitly; do not ship `fallback={null}`.

- [ ] **Step 4: Run lint and build**

Run:
```bash
cd frontend
npm run lint
npm run build
```

Expected: both pass. If Next reports `useSearchParams()` CSR bailout, keep the Suspense boundary (it is required). Note: lint/build passing does **not** prove hydration lands or that entries carry previews — verify that behaviorally in Task 4.

---

### Task 4: Verify Returning User Startup

**Files:**
- Modify only if needed: `frontend/src/app/ReaderApp.tsx`
- Modify only if needed: `frontend/src/lib/readerServer.ts`

- [ ] **Step 1: Rebuild frontend container**

Run:
```bash
docker compose up -d --build frontend
```

Expected: frontend rebuilds and starts.

- [ ] **Step 2: Check logs**

Run:
```bash
docker compose logs --tail=100 frontend
```

Expected: no Next build/runtime error.

- [ ] **Step 3: Non-interactive hydration check (runs without a logged-in session)**

This is the check that actually proves the seed lands; do it even if you cannot authenticate. In DevTools for a provisioned signed-in user:
- Network tab on initial load: **no** `/api/entries`, `/api/feeds`, `/api/categories`, or `/api/me` request fires before any user interaction (the seeded cache is fresh for 30s via `QueryProvider` staleTime). `/api/bootstrap` is **not** called.
- React Query Devtools (or inspect the cache): the entries query is in state `success` from cache on first paint, not `pending`/`fetching`.
- The first painted entry rows show previews and thumbnails immediately (proves `withEntryListMeta` was applied to the seed — if previews pop in later, Task 2 Step 3's transform is missing or wrong).
- Test specifically with a user whose `entries_per_page` is **not** 100, to catch a pageSize key mismatch.

If you cannot authenticate, report Steps 4–7 manual checks as **skipped** and rely on this plus the review subagent.

- [ ] **Step 4: Manual browser check (requires live auth)**

Open:
```text
http://localhost/
```

Expected for an already provisioned signed-in user:
- app shows reader data without the "Setting up your account..." interstitial;
- `/api/bootstrap` is not called on page load;
- feeds/categories/entries are present (with previews/thumbnails) as soon as the client hydrates, with no refetch round-trip.

Expected for an unprovisioned signed-in user:
- app shows setup state;
- `/api/bootstrap` runs once;
- reader data loads after provisioning.

- [ ] **Step 5: Dispatch SSR review subagent**

Ask a read-only review subagent:

```text
Review the current diff for Next.js Server Component, Clerk, Suspense, and TanStack Query hydration issues. Specifically verify: (1) seeded entries carry preview/thumbnail_url matching /api/entries; (2) the entries seed key pageSize equals the client's first-render entriesParams.pageSize; (3) getInitialReaderData cannot 500 the page on a Miniflux/Clerk failure; (4) exactly one bootstrap effect exists. Do not edit files. Report only bugs, regressions, or missing checks with file/line references.
```

Expected: no blocking findings, or lead agent fixes findings before Task 5.

---

### Task 5: Move Add Modal State Into `AddModal`

**Files:**
- Modify: `frontend/src/components/AddModal/AddModal.tsx`
- Modify: `frontend/src/app/ReaderApp.tsx`

- [ ] **Step 1: Change AddModal props**

In `AddModal.tsx`, replace `AddModalProps` with:

```ts
export type AddFeedPayload = {
  feedUrl: string;
  categoryId: number;
  selectedFeedUrl: string;
};

export type AddModalProps = {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  defaultFeedCategoryId: number | null;
  onAddCategory: (title: string) => Promise<boolean>;
  onAddFeed: (payload: AddFeedPayload) => Promise<
    | { ok: true }
    | {
        ok: false;
        error: string;
        discoveredFeeds?: DiscoveredFeed[];
        selectedDiscoveredFeedUrl?: string;
      }
  >;
  isLoading: boolean;
};
```

- [ ] **Step 2: Add local form state**

Inside `AddModal`, add:

```tsx
const [newCategoryTitle, setNewCategoryTitle] = useState('');
const [addCategoryLoading, setAddCategoryLoading] = useState(false);
const [addCategoryError, setAddCategoryError] = useState<string | null>(null);
const [newFeedUrl, setNewFeedUrl] = useState('');
const [newFeedCategoryId, setNewFeedCategoryId] = useState<number | null>(
  defaultFeedCategoryId,
);
const [discoveredFeeds, setDiscoveredFeeds] = useState<DiscoveredFeed[]>([]);
const [selectedDiscoveredFeedUrl, setSelectedDiscoveredFeedUrl] = useState('');
const [addFeedLoading, setAddFeedLoading] = useState(false);
const [addFeedError, setAddFeedError] = useState<string | null>(null);

useEffect(() => {
  if (!isOpen) return;
  setNewCategoryTitle('');
  setAddCategoryError(null);
  setNewFeedUrl('');
  setNewFeedCategoryId(defaultFeedCategoryId);
  setDiscoveredFeeds([]);
  setSelectedDiscoveredFeedUrl('');
  setAddFeedError(null);
}, [defaultFeedCategoryId, isOpen]);
```

- [ ] **Step 3: Wire the URL-change reset (preserve a current behavior)**

The current parent passes `handleSetNewFeedUrl`, which clears `discoveredFeeds`, `selectedDiscoveredFeedUrl`, and `addFeedError` whenever the URL changes — so editing the URL after a discovery abandons the stale result. Reproduce it locally and use it as the URL input's `onChange` (do **not** wire the bare `setNewFeedUrl`):

```tsx
function handleSetNewFeedUrl(value: string) {
  setNewFeedUrl(value);
  setDiscoveredFeeds([]);
  setSelectedDiscoveredFeedUrl('');
  setAddFeedError(null);
}
```

- [ ] **Step 4: Submit upward, and consume the discovered-feed round-trip**

The discovery flow is two-step: submit → server returns discovered feeds → user picks one → resubmit. The modal's submit handler must consume `onAddFeed`'s result (this is the part that previously lived in the parent and must not be lost):

```tsx
async function handleAddFeedSubmit(event: React.FormEvent) {
  event.preventDefault(); // payload handlers no longer receive the FormEvent
  setAddFeedLoading(true);
  setAddFeedError(null);
  try {
    const result = await onAddFeed({
      feedUrl: newFeedUrl.trim(),
      categoryId: newFeedCategoryId ?? 0,
      selectedFeedUrl: selectedDiscoveredFeedUrl.trim(),
    });
    if (result.ok) {
      // existing success toast + onClose()
      onClose();
      return;
    }
    setAddFeedError(result.error);
    if (result.discoveredFeeds) {
      setDiscoveredFeeds(result.discoveredFeeds);
      setSelectedDiscoveredFeedUrl(
        result.selectedDiscoveredFeedUrl ??
          result.discoveredFeeds[0]?.url ??
          '',
      );
    }
  } finally {
    setAddFeedLoading(false);
  }
}
```

Category submit calls `onAddCategory(trimmedTitle)` similarly, with `event.preventDefault()` first. Keep the existing toasts inside the modal.

- [ ] **Step 5: Remove parent add form state**

In `ReaderApp.tsx`, remove these parent states and helpers:

```tsx
newFeedUrl
newFeedCategoryId
addFeedLoading
addFeedError
discoveredFeeds
selectedDiscoveredFeedUrl
newCategoryTitle
addCategoryLoading
addCategoryError
resetAddModalForm
handleSetNewFeedUrl
```

Replace parent `addFeed(e)` with a payload version that returns a result (no `FormEvent`, no `preventDefault` here — the modal owns that now):

```tsx
async function addFeed(payload: AddFeedPayload) {
  // same fetchJson body as before, using payload fields
  // on the discovery branch: return { ok: false, error: notice, discoveredFeeds, selectedDiscoveredFeedUrl }
  // on validation failure: return { ok: false, error } (do NOT throw)
  // on success: return { ok: true }
}
```

Replace parent `addCategory(e)` with:

```tsx
async function addCategory(title: string): Promise<boolean> {
  // same fetchJson body as before, using title
}
```

- [ ] **Step 6: (Optional) Re-validate category selection while open**

The current parent re-checks `newFeedCategoryId` against the live, non-protected category set while the modal is open (so a category deleted/renamed mid-session falls back to default). The Step 2 effect only resets on open. Either accept this simplification explicitly, or add a second effect inside `AddModal` keyed on `categories` that re-validates `newFeedCategoryId` against non-protected ids.

- [ ] **Step 7: Update JSX call site**

In `ReaderApp.tsx`, replace the `AddModal` call with:

```tsx
<AddModal
  isOpen={activeModal === 'add'}
  onClose={closeAddModal}
  categories={categories}
  defaultFeedCategoryId={defaultAddFeedCategoryId}
  onAddCategory={addCategory}
  onAddFeed={addFeed}
  isLoading={isLoading}
/>
```

- [ ] **Step 8: Run lint**

Run:
```bash
cd frontend
npm run lint
```

Expected: lint passes.

- [ ] **Step 9: Dispatch AddModal review subagent**

Ask a read-only review subagent:

```text
Review the AddModal refactor. Check that all add form state moved into AddModal, the discovered-feed round-trip works (onAddFeed {ok:false, discoveredFeeds} re-renders the picker), editing the URL clears stale discovery, the form onSubmit calls preventDefault, protected-category filtering still works, and parent ReaderApp no longer owns add form fields. Do not edit files.
```

Expected: no blocking findings, or lead agent fixes findings before Task 6.

---

### Task 6: Move Edit Modal State Into `EditModal`

**Files:**
- Modify: `frontend/src/components/EditModal/EditModal.tsx`
- Modify: `frontend/src/app/ReaderApp.tsx`

- [ ] **Step 1: Change edit target shape**

In `ReaderApp.tsx`, replace edit modal state with one target:

```tsx
type EditTarget =
  | { type: 'feed'; item: Feed }
  | { type: 'category'; item: Category }
  | null;

const [editTarget, setEditTarget] = useState<EditTarget>(null);
```

- [ ] **Step 2: Update open/close**

Use:

```tsx
const openEditModal = useCallback((type: 'feed' | 'category', item: Feed | Category) => {
  if (type === 'category' && isProtectedCategoryTitle(item.title)) {
    toast.error('This category is managed automatically.');
    return;
  }

  setEditTarget(
    type === 'feed'
      ? { type, item: item as Feed }
      : { type, item: item as Category },
  );
  setActiveModal('edit');
}, []);

const closeEditModal = useCallback(() => {
  setEditTarget(null);
  setActiveModal('menu');
}, []);
```

- [ ] **Step 3: Change EditModal props**

In `EditModal.tsx`, replace props with:

```ts
export type EditTarget =
  | { type: 'feed'; item: Feed }
  | { type: 'category'; item: Category }
  | null;

export type UpdateFeedPayload = {
  id: number;
  title: string;
  feedUrl: string;
  categoryId: number | null;
};

export type UpdateCategoryPayload = {
  id: number;
  title: string;
};

export type EditModalProps = {
  isOpen: boolean;
  target: EditTarget;
  categories: Category[];
  onClose: () => void;
  onDeleteCategory: (categoryId: number) => Promise<boolean>;
  onDeleteFeed: (feedId: number) => Promise<boolean>;
  onUpdateCategory: (payload: UpdateCategoryPayload) => Promise<boolean>;
  onUpdateFeed: (payload: UpdateFeedPayload) => Promise<boolean>;
};
```

- [ ] **Step 4: Add local edit state**

Inside `EditModal`, derive fields when opened:

```tsx
const [editTitle, setEditTitle] = useState('');
const [editFeedUrl, setEditFeedUrl] = useState('');
const [editCategoryId, setEditCategoryId] = useState<number | null>(null);
const [editLoading, setEditLoading] = useState(false);
const [editError, setEditError] = useState<string | null>(null);

useEffect(() => {
  if (!isOpen || !target) return;
  setEditTitle(target.item.title);
  setEditError(null);

  if (target.type === 'feed') {
    setEditFeedUrl(target.item.feed_url || '');
    setEditCategoryId(target.item.category?.id || null);
  } else {
    setEditFeedUrl('');
    setEditCategoryId(null);
  }
}, [isOpen, target]);
```

- [ ] **Step 5: Submit upward with payloads (and `preventDefault`)**

Each form's `onSubmit` must call `event.preventDefault()` before building the payload (the parent handlers no longer receive the `FormEvent`).

Update category submit:

```tsx
const didSucceed = await onUpdateCategory({
  id: target.item.id,
  title: editTitle.trim(),
});
```

Update feed submit:

```tsx
const didSucceed = await onUpdateFeed({
  id: target.item.id,
  title: editTitle.trim(),
  feedUrl: editFeedUrl.trim(),
  categoryId: editCategoryId,
});
```

- [ ] **Step 6: Rewire the delete handlers**

The current delete handlers guard on `editItemId`; that state is gone. Rewire them to read from `target` (the delete path is easy to miss — it is not an update payload):

```tsx
function handleDeleteFeed() {
  if (!target) return;
  void onDeleteFeed(target.item.id);
}
function handleDeleteCategory() {
  if (!target) return;
  void onDeleteCategory(target.item.id);
}
```

**Protected-category note:** this refactor removes the `isEditingProtectedCategory` state, its read-only "managed automatically" render branch, and the `updateCategory` protected guard. That is safe **only because** `openEditModal` (Step 2) blocks protected categories before the modal ever opens. Confirm no other caller opens the edit modal for a protected category.

- [ ] **Step 7: Remove parent edit form state**

In `ReaderApp.tsx`, remove:

```tsx
editType
editItemId
editTitle
editFeedUrl
editCategoryId
isEditingProtectedCategory
editLoading
editError
resetEditModalForm
```

Change `updateCategory` and `updateFeed` to accept the payload objects from `EditModal`.

- [ ] **Step 8: Update JSX call site**

Use:

```tsx
<EditModal
  isOpen={activeModal === 'edit'}
  target={editTarget}
  categories={categories}
  onClose={closeEditModal}
  onDeleteCategory={deleteCategory}
  onDeleteFeed={deleteFeed}
  onUpdateCategory={updateCategory}
  onUpdateFeed={updateFeed}
/>
```

- [ ] **Step 9: Run lint**

Run:
```bash
cd frontend
npm run lint
```

Expected: lint passes.

- [ ] **Step 10: Dispatch EditModal review subagent**

Ask a read-only review subagent:

```text
Review the EditModal refactor. Check target reset, local form initialization, the delete-path rewire to target.item.id, that protected categories are still blocked upstream in openEditModal, update/delete payloads, form onSubmit preventDefault, and parent ReaderApp state cleanup. Do not edit files.
```

Expected: no blocking findings, or lead agent fixes findings before Task 7.

---

### Task 7: Final Build And Docker Verification

**Files:**
- Read: `docs/DEVELOPMENT.md`
- No new files unless a verification note is requested.

- [ ] **Step 1: Run frontend checks**

Run:
```bash
cd frontend
npm run lint
npm run build
```

Expected: both pass.

- [ ] **Step 2: Rebuild app container**

Run:
```bash
docker compose up -d --build frontend
```

Expected: Docker rebuilds the production Next.js app.

- [ ] **Step 3: Manual smoke test (requires live auth — otherwise report as skipped)**

Open:
```text
http://localhost/
```

Check:
- returning signed-in user does not call `/api/bootstrap` on initial load and triggers no `/api/*` reader refetch before interaction;
- entries are visible on first hydration, **with previews and thumbnails** (no pop-in);
- switching Unread/All/Starred/categories works;
- search still works;
- load more still works;
- add category/feed still works, including discovered-feed selection;
- edit/delete category/feed still works (and submitting a modal form does not reload the page);
- star, mark read/unread, mark page read, and fetch source still work.

- [ ] **Step 4: Capture final diff**

Run:
```bash
git status --short
git diff --stat
```

Expected: only planned files changed (including the two new shared helpers).

- [ ] **Step 5: Dispatch final review subagent**

Ask a read-only review subagent:

```text
Review the full diff for regressions in reader startup, Query hydration (key + shape match, including preview/thumbnail_url), modal forms (discovery round-trip, preventDefault, delete rewire), and mutation invalidation. Confirm no duplicated Clerk-token lookup or preferences normalizer remains beyond the shared helpers. Do not edit files. Findings first, with file/line references.
```

Expected: no blocking findings. Lead agent fixes any blocking finding and reruns `npm run lint`, `npm run build`, and the Docker smoke test.

---

## Model Recommendation

Use a strong reasoning model/effort for the lead implementation agent (this is a cross-boundary Next.js + hydration refactor). It is not architecture-from-zero — TanStack Query already exists — so the highest reasoning tier is likely wasteful; reserve it for the SSR/hydration phase if the first build uncovers tricky hydration or Clerk/RSC behavior. Review subagents can use a cheaper/faster model except for the SSR hydration review, which should match the lead agent's tier.

## Self-Review

- Spec coverage: startup waterfall, returning-user bootstrap skip, god-component split, modal state ownership, and verification are covered.
- Correctness fixes folded in from review: seeded entries enriched with `preview`/`thumbnail_url`; `getInitialReaderData` cannot 500 the page; honest Suspense/SSR-paint framing + skeleton fallback; explicit single-bootstrap-effect deletion; shared `getMinifluxToken` + `normalizeReaderPreferences` instead of new copies; entries page-size clamp; AddModal discovery round-trip + URL-reset + `preventDefault`; EditModal delete rewire + `preventDefault` + protected-category note.
- Placeholder scan: no deferred placeholders; payloads and file paths are named.
- Type consistency: `MinifluxIdentity`, `InitialReaderData`, `AddFeedPayload`, `EditTarget`, `UpdateFeedPayload`, and `UpdateCategoryPayload` are introduced before use.
- Known fragility: the entries-key match depends on `defaultEntriesParams` staying byte-equal to `useReaderData`'s first-render `entriesParams`, and on the seed reusing the route's `withEntryListMeta` and 500 clamp. A change to either side silently misses the cache — Task 4 Step 3 is the guard.
