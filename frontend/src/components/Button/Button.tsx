import React from 'react';
import styles from './Button.module.sass';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'category' | 'nav' | 'icon';
  children: React.ReactNode;
  active?: boolean;
  className?: string;
  count?: number;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  children,
  className = '',
  active = false,
  count,
  ...props
}) => {
  return (
    <button
      className={`${styles.button} ${styles[variant]} ${className}`}
      data-active={active}
      {...props}
    >
      {children}
      {count && count > 0 && <span className={styles.count}>{count}</span>}
    </button>
  );
};
