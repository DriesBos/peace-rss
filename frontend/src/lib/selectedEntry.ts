export function resolveSelectedEntry<T extends { id: number }>(
  entries: T[],
  selectedEntryId: number | null,
  previousEntry: T | null,
): T | null {
  if (selectedEntryId === null) return null;
  return (
    entries.find((entry) => entry.id === selectedEntryId) ??
    (previousEntry?.id === selectedEntryId ? previousEntry : null)
  );
}

export function resolveSelectedEntryNav<T extends { id: number }>(
  entries: T[],
  selectedEntryId: number | null,
  previousEntry: T | null,
  previousIndex: number | null,
): { prevId: number | null; nextId: number | null } {
  if (selectedEntryId === null) return { prevId: null, nextId: null };

  const index = entries.findIndex((entry) => entry.id === selectedEntryId);
  if (index >= 0) {
    return {
      prevId: entries[index - 1]?.id ?? null,
      nextId: entries[index + 1]?.id ?? null,
    };
  }

  if (previousEntry?.id !== selectedEntryId || previousIndex === null) {
    return { prevId: null, nextId: null };
  }

  return {
    prevId: entries[previousIndex - 1]?.id ?? null,
    nextId: entries[previousIndex]?.id ?? null,
  };
}
