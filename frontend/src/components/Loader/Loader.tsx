import styles from './Loader.module.sass';

type LoaderProps = {
  label?: string;
  /** Fill the parent and center there; default centers in a 50svh block. */
  fill?: boolean;
  className?: string;
};

export function Loader({
  label = 'Loading',
  fill = false,
  className = '',
}: LoaderProps) {
  return (
    <div
      className={`${styles.loader} ${className}`.trim()}
      data-fill={fill}
      role="status"
      aria-live="polite"
    >
      <span className={styles.label}>{label}</span>
    </div>
  );
}
