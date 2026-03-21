'use client';

import styles from './LabelWithCount.module.sass';

type LabelWithCountProps = {
  count: number | string;
  children: React.ReactNode;
  as?: 'div' | 'span';
  className?: string;
};

export function LabelWithCount({
  count,
  children,
  as: Component = 'div',
  className = '',
}: LabelWithCountProps) {
  return (
    <Component className={`${styles.labelWithCount} ${className}`.trim()}>
      {children}
      {(typeof count === 'string' ||
        (typeof count === 'number' && count > 0)) && (
        <span className={styles.count}>{count}</span>
      )}
    </Component>
  );
}
