import styles from './IconWrapper.module.sass';

interface IconWrapperProps {
  variant?: 'default' | 'wide' | 'inverted' | 'small';
  children: React.ReactNode;
  className?: string;
  mirrored?: boolean;
  as?: 'div' | 'span';
}

export const IconWrapper: React.FC<IconWrapperProps> = ({
  variant = 'default',
  children,
  className = '',
  mirrored,
  as: Component = 'div',
}) => {
  return (
    <Component
      className={`${styles.iconWrapper} ${className}`}
      data-variant={variant}
      data-mirrored={mirrored}
    >
      {children}
    </Component>
  );
};
