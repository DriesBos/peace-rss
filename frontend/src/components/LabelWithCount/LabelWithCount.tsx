'use client';

import styles from './LabelWithCount.module.sass';

type LabelWithCountProps = {
  label: string;
  count: number;
  className?: string;
};

export function LabelWithCount({
  label,
  count,
  className,
}: LabelWithCountProps) {
  return (
    <div className={[styles.root, className].filter(Boolean).join(' ')}>
      <span>{label}</span>
      <span className={styles.count}>{count}</span>
    </div>
  );
}
