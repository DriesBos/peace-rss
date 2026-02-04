'use client';

import styles from './LabeledSelect.module.sass';

type SelectOption = {
  value: string;
  label: string;
};

type LabeledSelectProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder: string;
  optionalHint?: string;
  label?: string;
  disabled?: boolean;
};

export function LabeledSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  optionalHint,
  label,
  disabled = false,
}: LabeledSelectProps) {
  const isEmpty = value.length === 0;

  return (
    <div className={styles.field}>
      {label ? (
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
      ) : null}

      <div className={styles.control}>
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          className={styles.select}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {optionalHint && isEmpty ? (
          <span className={styles.hint}>{optionalHint}</span>
        ) : null}
      </div>
    </div>
  );
}
