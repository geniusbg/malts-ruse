/** Resolve event image URLs with backward compatibility for legacy `imageUrl` only. */

/**
 * Thumbnail for lists/cards: always `imageCardUrl` when set.
 * Legacy `imageUrl` is used only if it is not exactly the same URL as `imageDetailUrl`
 * (otherwise that row only has a hero image — show no thumb until a card image is set).
 */
export function eventCardImageUrl(event: {
  imageCardUrl?: string | null;
  imageUrl?: string | null;
  imageDetailUrl?: string | null;
}): string | null {
  const card = event.imageCardUrl?.trim();
  if (card) return card;

  const legacy = event.imageUrl?.trim() || null;
  if (!legacy) return null;

  const detail = event.imageDetailUrl?.trim() || null;
  if (detail && legacy === detail) return null;

  return legacy;
}

export function eventDetailImageUrl(event: {
  imageDetailUrl?: string | null;
  imageUrl?: string | null;
  imageCardUrl?: string | null;
}): string | null {
  const u =
    event.imageDetailUrl?.trim() ||
    event.imageUrl?.trim() ||
    event.imageCardUrl?.trim();
  return u || null;
}
