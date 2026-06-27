# Reader SSR Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the reader paint from server-fetched initial data, skip bootstrap for already provisioned users, and shrink `page.tsx` by moving client-only work into focused islands.

**Architecture:** Keep TanStack Query because it is already installed and wired through `QueryProvider`. Add one server-only reader data module that reads Clerk private metadata once per request, fetches initial Miniflux data directly, and seeds Query with `dehydrate()`. Split the current client page into `ReaderApp.tsx`, then move modal form state into the modals.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Clerk, TanStack Query 5, Miniflux API, Sass modules, Docker Compose production build.

---

## Current State

- `frontend/src/app/page.tsx` is a 1,366-line Client Component.
- `frontend/src/hooks/useReaderData.ts` already uses TanStack Query for feeds, categories, and infinite entries.
- `frontend/src/app/page.tsx` already uses TanStack Query for preferences, all count, starred count, and starred entries.
- Returning users still start with `isProvisioned=false`, POST `/api/bootstrap`, then enable the Query reads.
- `AddModal` and `EditModal` still receive 18 props each.
- Local verification baseline: `npm run lint` passes.

## Execution Mode

- Use one lead agent to own the branch, make edits, run checks, and resolve conflicts.
- Do not split implementation across multiple coding agents. The main files overlap too much: `page.tsx`, `ReaderApp.tsx`, modal props, and Query hydration all touch shared state.
- Use subagents for review checkpoints only. They should inspect the diff and report findings; they should not edit files unless the lead agent explicitly takes over that fix.
- Preferred flow in the Codex app: lead agent executes a phase, dispatches a review subagent, applies any fixes, then continues.

Review checkpoints:
- After Task 3: review Server Component, Suspense, Clerk auth, and TanStack Query hydration boundaries.
- After Task 5: review `AddModal` state ownership and discovered-feed behavior.
- After Task 6: review `EditModal` state ownership and stale target/reset behavior.
- After Task 7: final diff review focused on regressions and missed manual smoke checks.

## File Map

- Create `frontend/src/lib/readerServer.ts`: server-only Clerk token lookup and initial Miniflux reads.
- Modify `frontend/src/app/page.tsx`: make it a Server Component that hydrates TanStack Query and renders the client island inside Suspense.
- Create `frontend/src/app/ReaderApp.tsx`: move the current client page code here.
- Modify `frontend/src/hooks/useReaderData.ts`: keep existing Query flow; only add small support needed for hydrated infinite data if build exposes a typing gap.
- Modify `frontend/src/components/AddModal/AddModal.tsx`: own add form state locally and submit payloads upward.
- Modify `frontend/src/components/EditModal/EditModal.tsx`: own edit form state locally and submit payloads upward.
- Modify route handlers only if repeated auth helper extraction stays small; do not block SSR on full API cleanup.

---

### Task 1: Sync And Baseline

**Files:**
- Read: `frontend/src/app/page.tsx`
- Read: `frontend/src/hooks/useReaderData.ts`
- Read: `frontend/src/lib/readerQueryKeys.ts`
- Read: `frontend/src/components/QueryProvider/QueryProvider.tsx`

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

- [ ] **Step 3: Confirm current Query adoption**

Run:
```bash
rg -n "QueryClientProvider|useQuery|useInfiniteQuery|readerQueryKeys" frontend/src
```

Expected: `QueryProvider`, `useReaderData`, and `page.tsx` already use TanStack Query.

---

### Task 2: Add Server Reader Data

**Files:**
- Create: `frontend/src/lib/readerServer.ts`
- Read: `frontend/src/lib/miniflux.ts`
- Read: `frontend/src/app/_lib/types.ts`
- Read: `frontend/src/lib/readerQueryKeys.ts`

- [ ] **Step 1: Create server-only helper**

Create `frontend/src/lib/readerServer.ts`:

```ts
import 'server-only';

import { auth, clerkClient } from '@clerk/nextjs/server';
import { cache } from 'react';
import type {
  Category,
  EntriesResponse,
  Feed,
  ReaderPreferences,
} from '@/app/_lib/types';
import { DEFAULT_ENTRIES_PAGE_SIZE } from '@/lib/entriesQuery';
import { mfFetchUser } from '@/lib/miniflux';

export type ReaderIdentity = {
  userId: string;
  token: string;
  minifluxUsername: string | null;
};

export type InitialReaderData = {
  provisioned: boolean;
  preferences: ReaderPreferences | null;
  feeds: Feed[];
  categories: Category[];
  entries: EntriesResponse | null;
  allCount: EntriesResponse | null;
  starredCount: EntriesResponse | null;
};

const DEFAULT_READER_PREFERENCES: ReaderPreferences = {
  id: 0,
  entries_per_page: DEFAULT_ENTRIES_PAGE_SIZE,
  keyboard_shortcuts: true,
  show_reading_time: true,
  entry_swipe: true,
};

export const getReaderIdentity = cache(async (): Promise<ReaderIdentity | null> => {
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
});

function normalizeReaderPreferences(
  preferences: ReaderPreferences,
): ReaderPreferences {
  return {
    ...DEFAULT_READER_PREFERENCES,
    ...preferences,
    entries_per_page:
      preferences.entries_per_page > 0
        ? preferences.entries_per_page
        : DEFAULT_ENTRIES_PAGE_SIZE,
  };
}

function entriesPath(limit: number): string {
  const qs = new URLSearchParams({
    limit: String(limit),
    offset: '0',
    order: 'published_at',
    direction: 'desc',
    status: 'unread',
    globally_visible: 'true',
  });
  return `/v1/entries?${qs.toString()}`;
}

export async function getInitialReaderData(): Promise<InitialReaderData> {
  const identity = await getReaderIdentity();
  if (!identity) {
    return {
      provisioned: false,
      preferences: null,
      feeds: [],
      categories: [],
      entries: null,
      allCount: null,
      starredCount: null,
    };
  }

  const preferences = normalizeReaderPreferences(
    await mfFetchUser<ReaderPreferences>(identity.token, '/v1/me'),
  );

  const [feeds, categories, entries, allCount, starredCount] =
    await Promise.all([
      mfFetchUser<Feed[]>(identity.token, '/v1/feeds'),
      mfFetchUser<Category[]>(identity.token, '/v1/categories?counts=true'),
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

  return {
    provisioned: true,
    preferences,
    feeds,
    categories,
    entries,
    allCount,
    starredCount,
  };
}
```

- [ ] **Step 2: Run lint**

Run:
```bash
cd frontend
npm run lint
```

Expected: lint passes. If Miniflux response typing is too narrow, adjust only the imported shared types.

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

- [ ] **Step 2: Keep bootstrap only for unprovisioned users**

In `ReaderApp.tsx`, replace the bootstrap effect with:

```tsx
useEffect(() => {
  if (isProvisioned) return;
  void bootstrap();
  // Bootstrap should run only until the server/client provisioned flag is true.
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isProvisioned]);
```

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
      <Suspense fallback={null}>
        <ReaderApp initialProvisioned={initialData.provisioned} />
      </Suspense>
    </HydrationBoundary>
  );
}
```

- [ ] **Step 4: Run lint and build**

Run:
```bash
cd frontend
npm run lint
npm run build
```

Expected: both pass. If Next reports `useSearchParams()` CSR bailout, keep the Suspense boundary and move only the hook-using part into a smaller child component if needed.

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

- [ ] **Step 3: Manual browser check**

Open:
```text
http://localhost/
```

Expected for an already provisioned signed-in user:
- app shows reader data without the "Setting up your account..." interstitial;
- `/api/bootstrap` is not called on page load;
- feeds/categories/entries are visible before client refetch finishes.

Expected for an unprovisioned signed-in user:
- app shows setup state;
- `/api/bootstrap` runs once;
- reader data loads after provisioning.

- [ ] **Step 4: Dispatch SSR review subagent**

Ask a read-only review subagent:

```text
Review the current diff for Next.js Server Component, Clerk, Suspense, and TanStack Query hydration issues. Do not edit files. Report only bugs, regressions, or missing checks with file/line references.
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

- [ ] **Step 3: Submit upward with payloads**

Change modal submit handlers to call `onAddCategory(trimmedTitle)` and `onAddFeed({ feedUrl, categoryId, selectedFeedUrl })`. Keep the existing toasts inside the modal.

- [ ] **Step 4: Remove parent add form state**

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

Replace parent `addFeed(e)` with:

```tsx
async function addFeed(payload: AddFeedPayload) {
  // same fetchJson body as before, using payload fields
  // return { ok: true } on success
  // return { ok: false, error, discoveredFeeds, selectedDiscoveredFeedUrl } for discovery choice
}
```

Replace parent `addCategory(e)` with:

```tsx
async function addCategory(title: string): Promise<boolean> {
  // same fetchJson body as before, using title
}
```

- [ ] **Step 5: Update JSX call site**

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

- [ ] **Step 6: Run lint**

Run:
```bash
cd frontend
npm run lint
```

Expected: lint passes.

- [ ] **Step 7: Dispatch AddModal review subagent**

Ask a read-only review subagent:

```text
Review the AddModal refactor. Check that all add form state moved into AddModal, discovered feed selection still works, protected category filtering still works, and parent ReaderApp no longer owns add form fields. Do not edit files.
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

- [ ] **Step 5: Submit upward with payloads**

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

- [ ] **Step 6: Remove parent edit form state**

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

- [ ] **Step 7: Update JSX call site**

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

- [ ] **Step 8: Run lint**

Run:
```bash
cd frontend
npm run lint
```

Expected: lint passes.

- [ ] **Step 9: Dispatch EditModal review subagent**

Ask a read-only review subagent:

```text
Review the EditModal refactor. Check target reset, local form initialization, protected category behavior, update/delete payloads, and parent ReaderApp state cleanup. Do not edit files.
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

- [ ] **Step 3: Manual smoke test**

Open:
```text
http://localhost/
```

Check:
- returning signed-in user does not call `/api/bootstrap` on initial load;
- entries are visible on first paint;
- switching Unread/All/Starred/categories works;
- search still works;
- load more still works;
- add category/feed still works, including discovered-feed selection;
- edit/delete category/feed still works;
- star, mark read/unread, mark page read, and fetch source still work.

- [ ] **Step 4: Capture final diff**

Run:
```bash
git status --short
git diff --stat
```

Expected: only planned files changed.

- [ ] **Step 5: Dispatch final review subagent**

Ask a read-only review subagent:

```text
Review the full diff for regressions in reader startup, Query hydration, modal forms, and mutation invalidation. Do not edit files. Findings first, with file/line references.
```

Expected: no blocking findings. Lead agent fixes any blocking finding and reruns `npm run lint`, `npm run build`, and the Docker smoke test.

---

## Model Recommendation

Use `gpt-5.5` with `model_reasoning_effort="high"` for the lead implementation agent.

Why:
- This is a cross-boundary Next.js refactor, so it needs strong reasoning.
- It is not architecture-from-zero; TanStack Query already exists, so `xhigh` is likely wasteful.
- Use `xhigh` only if the first build uncovers tricky hydration or Clerk/RSC behavior.
- Review subagents can use a cheaper/faster model unless they are reviewing the SSR hydration phase. For the SSR review, use the same `gpt-5.5` high setting.

Suggested command shape:

```bash
codex -m gpt-5.5 -c 'model_reasoning_effort="high"'
```

## Self-Review

- Spec coverage: startup waterfall, returning-user bootstrap skip, god-component split, modal state ownership, and verification are covered.
- Placeholder scan: no deferred placeholders; payloads and file paths are named.
- Type consistency: `AddFeedPayload`, `EditTarget`, `UpdateFeedPayload`, and `UpdateCategoryPayload` are introduced before use.
