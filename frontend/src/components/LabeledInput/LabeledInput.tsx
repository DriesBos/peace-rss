'use client';

import type { HTMLInputTypeAttribute } from 'react';
import styles from './LabeledInput.module.sass';

type LabeledInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: HTMLInputTypeAttribute;
};

export function LabeledInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  type = 'text',
}: LabeledInputProps) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={styles.input}
      />
    </div>
  );
}
