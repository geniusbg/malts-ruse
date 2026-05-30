'use client';

import { useId } from 'react';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';

const sizeMap = {
  small: 'h-28 w-28 md:h-36 md:w-36',
  medium: 'h-44 w-44 md:h-56 md:w-56',
  large: 'h-64 w-64 md:h-80 md:w-80',
};

/** progress 0-100: fill level; omit = indeterminate (animated). */
export default function BeerMugLoader({
  size = 'large',
  className = '',
  progress,
}: {
  size?: keyof typeof sizeMap;
  className?: string;
  progress?: number;
}) {
  const id = useId().replace(/:/g, '');
  const clipId = `beerMugInner-${id}`;
  const liquidGradId = `beerMugLiquid-${id}`;
  const foamGradId = `beerMugFoam-${id}`;
  const reducedMotion = usePrefersReducedMotion();

  const p =
    progress == null ? null : Math.min(100, Math.max(0, Number(progress)));

  const minFill = 12;
  const maxFill = 74;
  const fillHeight =
    p == null
      ? 48
      : minFill + ((maxFill - minFill) * p) / 100;
  const fillY = 110 - fillHeight;

  const animate = !reducedMotion && p == null;

  return (
    <div
      className={`relative flex items-center justify-center ${sizeMap[size]} ${className}`}
      aria-hidden
    >
      <svg
        viewBox="0 0 160 150"
        className="h-full w-full"
        focusable="false"
        role="img"
        aria-label={p != null ? `Loading ${Math.round(p)}%` : 'Loading'}
      >
        <defs>
          <linearGradient id={liquidGradId} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#d8c400" />
            <stop offset="55%" stopColor="#f0dc1b" />
            <stop offset="100%" stopColor="#ffef62" />
          </linearGradient>
          <linearGradient id={foamGradId} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#e8e8e8" />
            <stop offset="100%" stopColor="#f7f7f7" />
          </linearGradient>
          <clipPath id={clipId}>
            <rect x="48" y="34" width="64" height="80" rx="18" ry="18" />
          </clipPath>
        </defs>

        <ellipse cx="96" cy="122" rx="38" ry="9" fill="#cbc3d8" opacity="0.55" />

        <g clipPath={`url(#${clipId})`}>
          <rect
            x="48"
            y={fillY}
            width="64"
            height={fillHeight}
            fill={`url(#${liquidGradId})`}
            className={animate ? 'theme-beer-liquid' : ''}
          />
        </g>

        <g className={animate ? 'theme-beer-foam' : ''}>
          <path
            d="M56 39 C52 33, 57 26, 64 27 C66 21, 72 19, 77 22 C81 17, 88 17, 93 22 C101 21, 107 28, 104 34 C109 37, 109 44, 103 47 C95 51, 65 51, 58 47 C53 45, 52 41, 56 39 Z"
            fill={`url(#${foamGradId})`}
            stroke="#2f2730"
            strokeWidth="1.1"
          />
        </g>

        <path
          d="M48 34 L48 98 C48 108 56 116 66 116 H94 C104 116 112 108 112 98 V34"
          fill="none"
          stroke="#2f2730"
          strokeWidth="1.6"
        />
        <path
          d="M48 35 C60 32, 100 32, 112 35"
          fill="none"
          stroke="#2f2730"
          strokeWidth="1.6"
        />
        <path
          d="M52 108 C60 114, 100 114, 108 108"
          fill="none"
          stroke="#2f2730"
          strokeWidth="1.6"
        />

        <path
          d="M46 46 H30 C24 46 20 50 20 56 V88 C20 94 24 98 30 98 H46"
          fill="none"
          stroke="#2f2730"
          strokeWidth="1.6"
        />
        <path
          d="M46 52 H34 C31 52 29 54 29 57 V87 C29 90 31 92 34 92 H46"
          fill="none"
          stroke="#2f2730"
          strokeWidth="1.2"
        />

        <path
          d="M62 101 V62 C62 58 66 58 66 62"
          fill="none"
          stroke="#2f2730"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M77 102 V68 C77 62 85 62 85 68 V102"
          fill="none"
          stroke="#2f2730"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M96 98 V63 C96 58 100 58 100 63"
          fill="none"
          stroke="#2f2730"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
