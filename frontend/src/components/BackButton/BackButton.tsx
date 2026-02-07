'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';
import { IconArrowLeft } from '@/components/icons/IconArrowLeft';
import { IconWrapper } from '@/components/icons/IconWrapper/IconWrapper';
import styles from './BackButton.module.sass';

export type BackButtonProps = Omit<
  ComponentProps<typeof Link>,
  'href' | 'children'
> & {
  href?: ComponentProps<typeof Link>['href'];
  label?: string;
  ariaLabel?: string;
};

export function BackButton({
  href = '/',
  className,
  label = 'Back',
  ariaLabel = 'Back to home',
  ...props
}: BackButtonProps) {
  const combinedClassName = className
    ? `${styles.backButton} ${className}`
    : styles.backButton;

  return (
    <Link
      {...props}
      href={href}
      className={combinedClassName}
      aria-label={ariaLabel}
    >
      <IconWrapper variant="wide">
        <IconArrowLeft />
      </IconWrapper>
      <span>{label}</span>
    </Link>
  );
}
