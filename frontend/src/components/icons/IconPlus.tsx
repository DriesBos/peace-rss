import React from 'react';

interface IconPlusProps {
  width?: number;
  height?: number;
  className?: string;
}

export const IconPlus: React.FC<IconPlusProps> = ({
  width = 16,
  height = 16,
  className,
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 16 16"
      width={width}
      height={height}
      className={className}
    >
      <path
        fill="currentColor"
        d="M8.5 3.5v4h4v1h-4v4h-1v-4h-4v-1h4v-4h1z"
      />
    </svg>
  );
};
