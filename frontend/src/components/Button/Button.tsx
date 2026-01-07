import React from 'react';
import styles from './Button.module.sass';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary';
  size?: 'default';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'default',
  children,
  className = '',
  ...props
}) => {
  return (
    <button
      className={`${styles.button} ${styles[variant]} ${styles[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
