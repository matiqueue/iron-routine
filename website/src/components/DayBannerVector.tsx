import { DayArtTag } from '../data/websiteContent';

interface DayBannerVectorProps {
  tag: DayArtTag;
  className?: string;
}

/** Animated pure monochromatic SVG illustrations matching the in-app DayBannerArtwork tags. */
export function DayBannerVector({ tag, className = '' }: DayBannerVectorProps) {
  return (
    <svg
      viewBox="0 0 360 180"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <pattern id={`grid-${tag}`} width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M 24 0 L 0 0 0 24" stroke="#FFFFFF" strokeOpacity="0.06" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="360" height="180" fill={`url(#grid-${tag})`} />

      {tag === 'fbw' && (
        <g key="fbw" className="animate-stroke-draw">
          <line x1="42" y1="90" x2="318" y2="90" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" opacity="0.85" />
          <circle cx="236" cy="90" r="60" stroke="#FFFFFF" strokeWidth="2.5" opacity="0.6" />
          <circle cx="236" cy="90" r="42" stroke="#A1A1AA" strokeWidth="2" strokeDasharray="7 5" />
          <circle cx="236" cy="90" r="22" stroke="#FFFFFF" strokeWidth="3" />
          <circle cx="236" cy="90" r="7" fill="#FFFFFF" />
          <rect x="86" y="56" width="14" height="68" rx="4" stroke="#FFFFFF" strokeWidth="2.5" opacity="0.8" />
          <rect x="108" y="68" width="10" height="44" rx="3" stroke="#A1A1AA" strokeWidth="2" />
          <path d="M 134 38 L 284 142" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.28" />
        </g>
      )}

      {tag === 'pull' && (
        <g key="pull" className="animate-stroke-draw">
          <path d="M 110 24 L 180 156 L 250 24" stroke="#FFFFFF" strokeWidth="3" strokeLinejoin="round" />
          <path d="M 134 28 L 180 124 L 226 28" stroke="#A1A1AA" strokeWidth="2.2" />
          <path d="M 156 32 L 180 90 L 204 32" stroke="#FFFFFF" strokeWidth="1.6" strokeDasharray="5 4" opacity="0.7" />
          <line x1="88" y1="30" x2="272" y2="30" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
          <circle cx="180" cy="90" r="5" fill="#FFFFFF" />
        </g>
      )}

      {tag === 'legs' && (
        <g key="legs" className="animate-stroke-draw">
          <circle cx="220" cy="108" r="64" stroke="#A1A1AA" strokeWidth="2" strokeDasharray="8 6" opacity="0.65" />
          <circle cx="220" cy="108" r="42" stroke="#FFFFFF" strokeWidth="3" opacity="0.85" />
          <path d="M 105 144 L 166 56 L 224 112 L 286 38" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="166" cy="56" r="6" fill="#FFFFFF" />
          <circle cx="224" cy="112" r="6" fill="#FFFFFF" />
        </g>
      )}

      {tag === 'shoulders' && (
        <g key="shoulders" className="animate-stroke-draw">
          <circle cx="180" cy="90" r="62" stroke="#A1A1AA" strokeWidth="2" opacity="0.55" />
          <circle cx="180" cy="90" r="40" stroke="#FFFFFF" strokeWidth="2.5" strokeDasharray="5 5" opacity="0.85" />
          <path d="M 114 134 Q 180 22 246 134" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M 136 144 Q 180 62 224 144" stroke="#A1A1AA" strokeWidth="2" />
          <circle cx="180" cy="74" r="6" fill="#FFFFFF" />
        </g>
      )}

      {tag === 'cardio' && (
        <g key="cardio" className="animate-stroke-draw">
          <line x1="36" y1="42" x2="324" y2="42" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.25" />
          <line x1="36" y1="138" x2="324" y2="138" stroke="#FFFFFF" strokeWidth="1.2" opacity="0.25" />
          <path
            d="M 42 96 L 112 96 L 138 50 L 162 136 L 190 32 L 218 128 L 242 80 L 264 96 L 318 96"
            stroke="#FFFFFF"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="190" cy="32" r="5" fill="#FFFFFF" />
        </g>
      )}

      {tag === 'rest' && (
        <g key="rest" className="animate-stroke-draw">
          <path d="M 32 96 Q 108 58 184 96 T 328 96" stroke="#FFFFFF" strokeWidth="2.8" opacity="0.85" />
          <path d="M 32 122 Q 108 84 184 122 T 328 122" stroke="#A1A1AA" strokeWidth="2" strokeDasharray="6 6" />
          <circle cx="272" cy="48" r="22" stroke="#FFFFFF" strokeWidth="2.5" />
          <circle cx="280" cy="44" r="14" stroke="#A1A1AA" strokeWidth="1.6" opacity="0.55" />
        </g>
      )}
    </svg>
  );
}
