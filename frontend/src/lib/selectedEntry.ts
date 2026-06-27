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
