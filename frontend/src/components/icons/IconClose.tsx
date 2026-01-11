import React from 'react';

interface IconCloseProps {
  width?: number;
  height?: number;
  className?: string;
}

export const IconClose: React.FC<IconCloseProps> = ({
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
        d="M12.854 3.854L8.707 8l4.147 4.146-.708.708L8 8.707l-4.146 4.147-.708-.708L7.293 8 3.146 3.854l.708-.708L8 7.293l4.146-4.147z"
      />
    </svg>
  );
};
