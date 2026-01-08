import React from 'react';

interface IconArrowLeftProps {
  width?: number;
  height?: number;
  className?: string;
}

export const IconArrowLeft: React.FC<IconArrowLeftProps> = ({
  width = 32,
  height = 16,
  className,
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 32 16"
      width={width}
      height={height}
      className={className}
    >
      <g clip-path="url(#a)">
        <path
          fill="currentColor"
          d="M8.419.938 2.397 7.33h12.937v-.003H32v1.334H2.397l6.025 6.398-.887.941L.884 8.938H.883L0 8.001v-.002l.886-.941h.002L7.535 0z"
        />
      </g>
    </svg>
  );
};
