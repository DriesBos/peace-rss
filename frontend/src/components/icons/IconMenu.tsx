import React from 'react';

interface IconMenuProps {
  width?: number;
  height?: number;
  className?: string;
}

export const IconMenu: React.FC<IconMenuProps> = ({
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
        d="M0 13.5h16v-1H0zM0 8.5h16v-1H0zM0 3.5h16v-1H0z"
      />
    </svg>
  );
};
