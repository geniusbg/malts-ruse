'use client';

import { useEffect, useState } from 'react';
import { useLockScroll } from '@/lib/use-lock-scroll';

interface LoadingScreenProps {
  locale?: string;
  inline?: boolean;
  message?: string;
  logoSize?: 'small' | 'medium' | 'large';
  /** 0-100: beer fill; omit = simulated progress. */
  progress?: number;
  /** Optional admin-managed loading media. */
  assetUrl?: string;
  assetType?: 'image' | 'video';
  /** If true, do not show built-in beer mug when no assetUrl. */
  hideDefaultMedia?: boolean;
}

export default function LoadingScreen({ 
  locale = 'bg', 
  inline = false,
  message,
  logoSize = 'large',
  progress,
  assetUrl,
  assetType,
  hideDefaultMedia = false,
}: LoadingScreenProps) {
  useLockScroll(!inline);
  const [loaderSrc, setLoaderSrc] = useState('/beer-mug-loader.gif');

  const [simulatedProgress, setSimulatedProgress] = useState(7);

  useEffect(() => {
    if (progress != null) {
      return;
    }

    const timer = window.setInterval(() => {
      setSimulatedProgress(prev => {
        if (prev >= 94) {
          return prev;
        }
        const nextStep = prev < 60 ? 5 : prev < 80 ? 3 : 1;
        return Math.min(94, prev + nextStep);
      });
    }, 220);

    return () => window.clearInterval(timer);
  }, [progress]);

  const resolvedProgress =
    progress == null
      ? simulatedProgress
      : Math.min(100, Math.max(0, Number(progress)));

  const textClasses = {
    small: 'text-xl',
    medium: 'text-xl md:text-2xl',
    large: 'text-2xl md:text-3xl',
  };
  const gifSizeClasses = {
    small: 'h-28 w-28 md:h-36 md:w-36',
    medium: 'h-44 w-44 md:h-56 md:w-56',
    large: 'h-64 w-64 md:h-80 md:w-80',
  };

  const defaultMessage =
    locale === 'bg'
      ? '\u0417\u0430\u0440\u0435\u0436\u0434\u0430\u043d\u0435...'
      : locale === 'en'
        ? 'Loading...'
        : 'Se \u00eencarc\u0103...';
  const displayMessage = message || defaultMessage;

  const media = (() => {
    const url = (assetUrl || '').trim();
    if (!url) {
      if (hideDefaultMedia) {
        return <div className={`${gifSizeClasses[logoSize]}`} aria-hidden />;
      }
      return (
        <img
          src={loaderSrc}
          alt="Loading"
          className={`${gifSizeClasses[logoSize]} object-contain block`}
          onError={() => setLoaderSrc('/beer-mug-loader.png')}
        />
      );
    }

    if (assetType === 'video' || /\.(mp4|webm)$/i.test(url)) {
      return (
        <video
          className={`${gifSizeClasses[logoSize]} object-contain block`}
          src={url}
          muted
          playsInline
          autoPlay
          loop
        />
      );
    }

    return <img src={url} alt="Loading" className={`${gifSizeClasses[logoSize]} object-contain block`} />;
  })();

  const framedMedia = (
    <div className="relative inline-block">
      {/* subtle glow so the border doesn't look "cut off" */}
      <div
        className="absolute -inset-2 rounded-[1.75rem] bg-[radial-gradient(circle_at_top,rgba(196,30,58,0.18),rgba(234,179,8,0.12),rgba(22,101,52,0.10),transparent_70%)] blur-md opacity-80"
        aria-hidden
      />
      {/* thin blended border hugging the media edge */}
      <div className="relative rounded-[1.75rem] bg-[linear-gradient(135deg,rgba(196,30,58,0.55),rgba(234,179,8,0.28),rgba(22,101,52,0.22),rgba(255,255,255,0.08))] p-[1.5px] shadow-[0_18px_50px_rgba(26,24,16,0.18)]">
        <div className="rounded-[calc(1.75rem-1.5px)] overflow-hidden bg-[rgba(245,240,230,0.14)] backdrop-blur-sm">
          {media}
        </div>
      </div>
    </div>
  );

  const inner = (
    <div className="text-center px-4">
      <div className="mx-auto mb-8 flex flex-col items-center justify-center gap-2">
        {framedMedia}
        <span className="text-sm malts-muted tabular-nums">{Math.round(resolvedProgress)}%</span>
        <div className="h-2 w-40 overflow-hidden rounded-full bg-black/10">
          <div
            className="h-full rounded-full bg-[#d8c400] transition-[width] duration-300 ease-out"
            style={{ width: `${Math.round(resolvedProgress)}%` }}
          />
        </div>
      </div>
      <p className={`${textClasses[logoSize]} font-medium tracking-wide`}>
        {displayMessage}
      </p>
    </div>
  );

  if (inline) {
    return (
      <div className="text-center">
        <div className="flex flex-col items-center justify-center gap-2">
          {framedMedia}
          <span className="text-sm malts-muted tabular-nums">{Math.round(resolvedProgress)}%</span>
          <div className="h-2 w-40 overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full rounded-full bg-[#d8c400] transition-[width] duration-300 ease-out"
              style={{ width: `${Math.round(resolvedProgress)}%` }}
            />
          </div>
        </div>
        <p className={`mt-4 ${textClasses[logoSize]} font-medium`}>{displayMessage}</p>
      </div>
    );
  }

  return (
    <div 
      className="fixed z-50 flex items-center justify-center malts-surface"
      style={{
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        position: 'fixed',
        overflow: 'hidden',
        margin: 0,
        padding: 0,
      }}
    >
      {inner}
    </div>
  );
}


