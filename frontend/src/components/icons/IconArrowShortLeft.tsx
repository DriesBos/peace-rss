import React from 'react';

interface IconArrowShortLeftProps {
  width?: number;
  height?: number;
  className?: string;
}

export const IconArrowShortLeft: React.FC<IconArrowShortLeftProps> = ({
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
      <g clipPath="url(#a)">
        <path
          fill="currentColor"
          fillRule="evenodd"
          d="M15.36 8.631H1.806l6.146 6.138-.905.904L.262 8.896l-.902-.899.002-.001H-.64l.905-.904h.001L7.047.32l.901.9-6.142 6.133H15.36z"
          clipRule="evenodd"
        />
      </g>
    </svg>
  );
};
