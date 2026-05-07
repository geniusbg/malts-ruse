'use client';

import Image from 'next/image';
import { useBrandAppearance } from '@/lib/use-brand-appearance';

const DEFAULT_HERO = '/malts-logo-hero.webp';

type Props = {
  alt?: string;
  width: number;
  height: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

export default function BrandedHeroLogo({
  alt = "Malt's",
  width,
  height,
  className,
  sizes,
  priority,
}: Props) {
  const app = useBrandAppearance();
  const src = app?.heroLogoUrl?.trim() || DEFAULT_HERO;

  return (
    <Image src={src} alt={alt} width={width} height={height} className={className} sizes={sizes} priority={priority} />
  );
}
