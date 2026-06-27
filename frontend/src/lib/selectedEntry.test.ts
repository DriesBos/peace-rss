import assert from 'node:assert/strict';

import { resolveSelectedEntry } from './selectedEntry.ts';

type EntryLike = { id: number; title: string };

const previous = { id: 2, title: 'kept open' };
const nextEntries: EntryLike[] = [{ id: 1, title: 'still listed' }];

assert.equal(resolveSelectedEntry(nextEntries, 2, previous), previous);
assert.equal(resolveSelectedEntry(nextEntries, null, previous), null);
assert.equal(resolveSelectedEntry(nextEntries, 3, previous), null);
assert.deepEqual(
  resolveSelectedEntry(nextEntries, 1, previous),
  nextEntries[0],
);
