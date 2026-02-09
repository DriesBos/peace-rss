import React from 'react';
import styles from './Button.module.sass';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'category' | 'nav' | 'icon';
  icon?: 'plus' | 'menu' | 'search' | 'close' | 'star' | 'categories';
  children: React.ReactNode;
  active?: boolean;
  className?: string;
  count?: number;
  collapse?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  children,
  className = '',
  active = false,
  count,
  icon,
  collapse,
  ...props
}) => {
  const shouldShowCount = typeof count === 'number' && count > 0;

  return (
    <button
      className={`${styles.button} ${styles[variant]} ${className}`}
      data-active={active}
      data-icon={icon}
      data-collapse={collapse}
      {...props}
    >
      {children}
      {shouldShowCount && <span className={styles.count}>{count}</span>}
    </button>
  );
};
