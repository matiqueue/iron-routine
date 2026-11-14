interface PlateMarkProps {
  size?: number;
  className?: string;
}

/** Minimalist chamfered titanium hex collar split by a molten amber talon slash. */
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
        fill="currentColor"
        d="M8.6 41.4 L8.6 21.5 L11.2 17.0 L29.4 6.5 L34.6 6.5 L46.9 13.6 L37.8 20.2 L33.4 17.7 L30.6 17.7 L20.3 23.6 L18.9 26.1 L18.9 34.0 Z M55.4 22.6 L55.4 42.5 L52.8 47.0 L34.6 57.5 L29.4 57.5 L17.1 50.4 L26.2 43.8 L30.6 46.3 L33.4 46.3 L43.7 40.4 L45.1 37.9 L45.1 30.0 Z"
      />
      <path
        fill="#F59E0B"
        d="M9.7 49.7 C29.0 40.0 40.1 29.6 54.3 14.3 C35.0 24.0 23.9 34.4 9.7 49.7 Z"
      />
    </svg>
  );
}
