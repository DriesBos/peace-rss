import styles from './Loader.module.sass';

export type LoaderVariant = 'sweep' | 'glide' | 'draw';

/** The variant used across the app. Compare all three on /dev/components. */
export const DEFAULT_LOADER_VARIANT: LoaderVariant = 'sweep';

type LoaderProps = {
  label?: string;
  variant?: LoaderVariant;
  /** Fill the parent and center there; default centers in a 50svh block. */
  fill?: boolean;
  className?: string;
};

export function Loader({
  label = 'Loading',
  variant = DEFAULT_LOADER_VARIANT,
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
      <span className={styles.label} data-variant={variant}>
        {label}
        {variant === 'draw' ? (
          <span className={styles.dots} aria-hidden="true">
            <span>.</span>
            <span>.</span>
            <span>.</span>
          </span>
        ) : null}
      </span>
    </div>
  );
}
