import styles from './IconWrapper.module.sass';

interface IconWrapperProps {
  variant?: 'default' | 'wide' | 'inverted';
  children: React.ReactNode;
  className?: string;
  mirrored?: boolean;
}

export const IconWrapper: React.FC<IconWrapperProps> = ({
  variant = 'default',
  children,
  className = '',
  mirrored,
}) => {
  return (
    <div
      className={`${styles.iconWrapper} ${className}`}
      data-variant={variant}
      data-mirrored={mirrored}
    >
      {children}
    </div>
  );
};
