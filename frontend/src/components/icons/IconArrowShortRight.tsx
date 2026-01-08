import React from 'react';

interface IconArrowShortRightProps {
  width?: number;
  height?: number;
  className?: string;
}

export const IconArrowShortRight: React.FC<IconArrowShortRightProps> = ({
  width = 16,
  height = 16,
  className,
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      fill="none"
      viewBox="0 0 16 16"
      width={width}
      height={height}
      className={className}
    >
      <g clip-path="url(#a)">
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M0 8.311h13.554L7.409 14.45l.904.903 6.785-6.777h.001L16 7.678h-.001L16 7.675l-.904-.904h-.002L8.314 0l-.902.9 6.142 6.134H0z"
          clipRule="evenodd"
        />
      </g>
    </svg>
  );
};
