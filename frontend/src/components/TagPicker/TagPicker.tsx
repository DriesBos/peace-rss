'use client';

import styles from './TagPicker.module.sass';
import { Button } from '@/components/Button/Button';

type TagOption = {
  id: number;
  title: string;
};

type TagPickerProps = {
  label?: string;
  tags: TagOption[];
  selectedIds: number[];
  onToggle: (tagId: number, on: boolean) => void;
  disabled?: boolean;
  emptyHint?: string;
};

/** A row of tags that toggle on and off, like the header bar. */
export function TagPicker({
  label,
  tags,
  selectedIds,
  onToggle,
  disabled = false,
  emptyHint,
}: TagPickerProps) {
  return (
    <div className={styles.field} role="group" aria-label={label}>
      {label ? <span className={styles.label}>{label}</span> : null}
      {tags.length === 0 ? (
        emptyHint ? (
          <span className={styles.empty}>{emptyHint}</span>
        ) : null
      ) : (
        <div className={styles.list}>
          {tags.map((tag) => {
            const isOn = selectedIds.includes(tag.id);
            return (
              <Button
                key={tag.id}
                type="button"
                variant="nav"
                active={isOn}
                aria-pressed={isOn}
                className={styles.tag}
                onClick={() => onToggle(tag.id, !isOn)}
                disabled={disabled}
              >
                <span>{tag.title}</span>
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
}
