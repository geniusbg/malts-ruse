'use client';

import Image from 'next/image';
import { useBrandAppearance } from '@/lib/use-brand-appearance';
import { readBrandBootstrap } from '@/lib/brand-bootstrap';
import { resolveHeroLogoUrl } from '@/lib/brand-defaults';
import { useSiteDisplayName } from '@/lib/use-site-display-name';

type Props = {
  alt?: string;
  width: number;
  height: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
};

export default function BrandedHeroLogo({
  alt,
  width,
  height,
  className,
  sizes,
  priority,
}: Props) {
  const siteName = useSiteDisplayName();
  const app = useBrandAppearance();
  const src = resolveHeroLogoUrl(app?.heroLogoUrl, readBrandBootstrap()?.heroLogoUrl);

  if (!src) return null;

  return (
    <Image src={src} alt={alt ?? siteName} width={width} height={height} className={className} sizes={sizes} priority={priority} />
  );
}
