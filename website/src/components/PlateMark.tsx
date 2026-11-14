interface PlateMarkProps {
  size?: number;
  className?: string;
}

/** Minimalist geometric calibrated weight-plate emblem with amber collar ring. */
export function PlateMark({ size = 28, className = '' }: PlateMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
        d="M32 7 A25 25 0 1 0 31.99 7 Z M13.25 24.5 C12 24.5 11 25.5 11 26.75 V37.25 C11 38.5 12 39.5 13.25 39.5 C14.5 39.5 15.5 38.5 15.5 37.25 V26.75 C15.5 25.5 14.5 24.5 13.25 24.5 Z M50.75 24.5 C49.5 24.5 48.5 25.5 48.5 26.75 V37.25 C48.5 38.5 49.5 39.5 50.75 39.5 C52 39.5 53 38.5 53 37.25 V26.75 C53 25.5 52 24.5 50.75 24.5 Z M32 24.5 A7.5 7.5 0 1 0 31.99 24.5 Z"
      />
      <circle
        cx="32"
        cy="32"
        r="21.5"
        stroke="#000000"
        strokeOpacity="0.3"
        strokeWidth="1.2"
      />
      <circle
        cx="32"
        cy="32"
        r="10.5"
        stroke="#F59E0B"
        strokeWidth="2.6"
      />
    </svg>
  );
}
