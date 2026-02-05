'use client';

import styles from './LabelWithCount.module.sass';

type LabelWithCountProps = {
  count: number | string;
  children: React.ReactNode;
};

export function LabelWithCount({ count, children }: LabelWithCountProps) {
  return (
    <div className={styles.labelWithCount}>
      {children}
      {(typeof count === 'string' ||
        (typeof count === 'number' && count > 0)) && (
        <span className={styles.count}>{count}</span>
      )}
    </div>
  );
}
