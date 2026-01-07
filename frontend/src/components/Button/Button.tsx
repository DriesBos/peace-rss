import React from 'react';
import styles from './Button.module.sass';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'category';
  size?: 'default';
  children: React.ReactNode;
  active?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'default',
  children,
  className = '',
  active = false,
  ...props
}) => {
  return (
    <button
      className={`${styles.button} ${styles[variant]} ${styles[size]} ${className}`}
      data-active={active}
      {...props}
    >
      {children}
    </button>
  );
};
