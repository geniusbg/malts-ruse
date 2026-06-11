'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import ManagedLoadingScreen from '@/components/ManagedLoadingScreen';
import Toast from '@/components/Toast';
import { GOOGLE_FONT_EFFECTS, fontVarsFromAppearance, normalizeFontFamilyStack } from '@/lib/brand-fonts';

type BrandAppearanceSettings = {
  id: string;
  paper: string | null;
  ink: string | null;
  muted: string | null;
  subtle: string | null;
  card: string | null;
  cardHover: string | null;
  inset: string | null;
  hairline: string | null;
  hoverBorder: string | null;

  accent: string | null;
  accentHover: string | null;
  accentContrast: string | null;
  accentContrastHover: string | null;
  heroGlow: string | null;
  heroMoodBg: string | null;
  homepageAccent: string | null;

  menuActiveBg: string | null;
  menuActiveText: string | null;
  menuActiveBorder: string | null;
  menuInactiveBg: string | null;
  menuInactiveText: string | null;
  menuInactiveBorder: string | null;
  menuHoverBg: string | null;
  menuHoverBorder: string | null;

  navActiveBg: string | null;
  navActiveText: string | null;
  navActiveBorder: string | null;
  navHoverText: string | null;
  navMobileActiveBg: string | null;
  footerBg: string | null;
  footerText: string | null;
  footerLinkHover: string | null;
  footerBorder: string | null;
  productCardBg: string | null;
  productCardText: string | null;
  productCardTitleHover: string | null;
  productCardBorder: string | null;
  productCardHoverBorder: string | null;

  btnSecondaryBg: string | null;
  btnSecondaryText: string | null;
  btnSecondaryBorder: string | null;
  btnSecondaryBgHover: string | null;
  btnSecondaryTextHover: string | null;

  success: string | null;
  warning: string | null;
  danger: string | null;
  dangerHover: string | null;
  dangerContrast: string | null;
  dangerContrastHover: string | null;
  info: string | null;

  themeColor: string | null;
  siteTitle: string | null;
  siteShortName: string | null;
  siteDescription: string | null;

  googleFontsCssUrl: string | null;
  fontDisplayFamily: string | null;
  fontButtonsFamily: string | null;
  fontNavFamily: string | null;
  fontBodyFamily: string | null;
  fontDisplayEffect: string | null;
  fontMoodEffect: string | null;
  fontNavEffect: string | null;
  fontMenuEffect: string | null;
  fontProductEffect: string | null;
  fontButtonEffect: string | null;

  navLogoUrl: string | null;
  heroLogoUrl: string | null;
  appIconUrl: string | null;
  faviconUrl: string | null;
};

const DEFAULTS = {
  paper: '#d8cfbf',
  ink: '#1a1810',
  muted: '#4a4437',
  subtle: '#6b6255',
  card: '#ebe4d6',
  cardHover: '#e4dcc8',
  inset: '#dfd4c4',
  hairline: '#c9bda8',
  hoverBorder: '#c65a6b',
  accent: '#b0162f',
  accentHover: '#921226',
  accentContrast: '#f5f0e6',
  accentContrastHover: '#f5f0e6',
  heroGlow: '#b0162f',
  heroMoodBg: '#000000',
  homepageAccent: '#b0162f',
  menuActiveBg: '#b0162f',
  menuActiveText: '#f5f0e6',
  menuActiveBorder: '#b0162f',
  menuInactiveBg: '#ebe4d6',
  menuInactiveText: '#1a1810',
  menuInactiveBorder: '#c9bda8',
  menuHoverBg: '#e4dcc8',
  menuHoverBorder: '#c65a6b',
  navActiveBg: '#f2d9de',
  navActiveText: '#b0162f',
  navActiveBorder: '#b0162f',
  navHoverText: '#b0162f',
  navMobileActiveBg: '#f2d9de',
  footerBg: '#d8cfbf',
  footerText: '#4a4437',
  footerLinkHover: '#b0162f',
  footerBorder: '#c9bda8',
  productCardBg: '#ebe4d6',
  productCardText: '#1a1810',
  productCardTitleHover: '#b0162f',
  productCardBorder: '#c9bda8',
  productCardHoverBorder: '#c65a6b',
  success: '#166534',
  warning: '#92400e',
  danger: '#991b1b',
  dangerHover: '#7f1515',
  dangerContrast: '#ffffff',
  dangerContrastHover: '#ffffff',
  info: '#1d4ed8',
  themeColor: '#e8e0d4',
};

function coalesceColor(v: string | null | undefined, fallback: string) {
  const s = (v ?? '').trim();
  return s || fallback;
}

function colorFieldFallback(key: keyof BrandAppearanceSettings): string {
  const chain: Partial<Record<keyof BrandAppearanceSettings, keyof typeof DEFAULTS>> = {
    btnSecondaryBg: 'card',
    btnSecondaryText: 'ink',
    btnSecondaryBorder: 'hairline',
    btnSecondaryBgHover: 'cardHover',
    btnSecondaryTextHover: 'ink',
    dangerHover: 'danger',
    dangerContrastHover: 'dangerContrast',
  };
  const mapped = chain[key];
  if (mapped) return DEFAULTS[mapped];
  if (key in DEFAULTS) return DEFAULTS[key as keyof typeof DEFAULTS];
  return DEFAULTS.card;
}

type ColorField = { key: keyof BrandAppearanceSettings; label: string; hint: string };

const COLOR_GROUPS: { title: string; description: string; fields: ColorField[] }[] = [
  {
    title: 'Homepage Ð°ÐºÑ†ÐµÐ½Ñ‚Ð¸',
    description: 'Ð›Ð¾Ð³Ð¾Ñ‚Ð¾ Ð¸ mood Ñ‚ÐµÐºÑÑ‚Ð° Ð² hero, ÐºÐ°ÐºÑ‚Ð¾ Ð¸ Ñ‚Ð°Ð³Ð¾Ð²ÐµÑ‚Ðµ Ð² ÑÐµÐºÑ†Ð¸ÑÑ‚Ð° â€žÐŸÑ€ÐµÐ´Ð»Ð¾Ð¶ÐµÐ½Ð¸Ñâ€œ.',
    fields: [
      { key: 'heroGlow', label: 'Hero glow / mood Ñ€Ð°Ð¼ÐºÐ°', hint: 'ÐŸÑƒÐ»ÑÐ°Ñ†Ð¸ÑÑ‚Ð° Ð¾ÐºÐ¾Ð»Ð¾ Ð³Ð¾Ð»ÑÐ¼Ð¾Ñ‚Ð¾ Ð»Ð¾Ð³Ð¾ Ð¸ Ñ€Ð°Ð¼ÐºÐ°Ñ‚Ð° Ð¾ÐºÐ¾Ð»Ð¾ Food â€¢ Drinksâ€¦' },
      { key: 'heroMoodBg', label: 'Ð¤Ð¾Ð½ Ð²ÑŠÑ‚Ñ€Ðµ Ð² mood Ð±Ð°Ð½ÐµÑ€Ð°', hint: 'Ð’ÑŠÑ‚Ñ€ÐµÑˆÐ½Ð¸ÑÑ‚ Ñ„Ð¾Ð½ Ð·Ð°Ð´ Ñ‚ÐµÐºÑÑ‚Ð° Food â€¢ Drinksâ€¦' },
      { key: 'homepageAccent', label: 'ÐŸÑ€ÐµÐ´Ð»Ð¾Ð¶ÐµÐ½Ð¸Ñ Ð¸ ÐÐºÑ†ÐµÐ½Ñ‚Ð¸', hint: 'Ð•Ñ‚Ð¸ÐºÐµÑ‚ â€žÐŸÑ€ÐµÐ´Ð»Ð¾Ð¶ÐµÐ½Ð¸Ñâ€œ, badge-Ð¾Ð²Ðµ Ð¸ accent ÐµÐ»ÐµÐ¼ÐµÐ½Ñ‚Ð¸ Ð² cards' },
    ],
  },
  {
    title: 'Menu Ð±ÑƒÑ‚Ð¾Ð½Ð¸',
    description: 'ÐšÐ°Ñ‚ÐµÐ³Ð¾Ñ€Ð¸Ð¸ Ð¸ Ñ‚Ð°Ð±Ð¾Ð²Ðµ Ð² Ð¿ÑƒÐ±Ð»Ð¸Ñ‡Ð½Ð¾Ñ‚Ð¾ Ð¼ÐµÐ½ÑŽ (/bg/menu).',
    fields: [
      { key: 'menuActiveBg', label: 'ÐÐºÑ‚Ð¸Ð²ÐµÐ½ Ñ„Ð¾Ð½', hint: 'Ð˜Ð·Ð±Ñ€Ð°Ð½Ð° ÐºÐ°Ñ‚ÐµÐ³Ð¾Ñ€Ð¸Ñ / Ð°ÐºÑ‚Ð¸Ð²ÐµÐ½ Ñ‚Ð°Ð±' },
      { key: 'menuActiveText', label: 'ÐÐºÑ‚Ð¸Ð²ÐµÐ½ Ñ‚ÐµÐºÑÑ‚', hint: 'Ð¢ÐµÐºÑÑ‚ Ð²ÑŠÑ€Ñ…Ñƒ Ð°ÐºÑ‚Ð¸Ð²Ð½Ð¸Ñ Ñ„Ð¾Ð½' },
      { key: 'menuActiveBorder', label: 'ÐÐºÑ‚Ð¸Ð²Ð½Ð° Ñ€Ð°Ð¼ÐºÐ°', hint: 'Ð Ð°Ð¼ÐºÐ° Ð½Ð° Ð¸Ð·Ð±Ñ€Ð°Ð½Ð°Ñ‚Ð° ÐºÐ°Ñ‚ÐµÐ³Ð¾Ñ€Ð¸Ñ' },
      { key: 'menuInactiveBg', label: 'ÐÐµÐ°ÐºÑ‚Ð¸Ð²ÐµÐ½ Ñ„Ð¾Ð½', hint: 'ÐšÐ°Ñ‚ÐµÐ³Ð¾Ñ€Ð¸Ð¸, ÐºÐ¾Ð¸Ñ‚Ð¾ Ð½Ðµ ÑÐ° Ð¸Ð·Ð±Ñ€Ð°Ð½Ð¸' },
      { key: 'menuInactiveText', label: 'ÐÐµÐ°ÐºÑ‚Ð¸Ð²ÐµÐ½ Ñ‚ÐµÐºÑÑ‚', hint: 'Ð¢ÐµÐºÑÑ‚ Ð½Ð° Ð½ÐµÐ°ÐºÑ‚Ð¸Ð²Ð½Ð¸Ñ‚Ðµ ÐºÐ°Ñ‚ÐµÐ³Ð¾Ñ€Ð¸Ð¸' },
      { key: 'menuInactiveBorder', label: 'ÐÐµÐ°ÐºÑ‚Ð¸Ð²Ð½Ð° Ñ€Ð°Ð¼ÐºÐ°', hint: 'Ð Ð°Ð¼ÐºÐ° Ð½Ð° Ð½ÐµÐ°ÐºÑ‚Ð¸Ð²Ð½Ð¸Ñ‚Ðµ ÐºÐ°Ñ‚ÐµÐ³Ð¾Ñ€Ð¸Ð¸' },
      { key: 'menuHoverBg', label: 'Ð¤Ð¾Ð½ Ð¿Ñ€Ð¸ hover', hint: 'Ð¤Ð¾Ð½ Ð¿Ñ€Ð¸ Ð¿Ð¾ÑÐ¾Ñ‡Ð²Ð°Ð½Ðµ' },
      { key: 'menuHoverBorder', label: 'Ð Ð°Ð¼ÐºÐ° Ð¿Ñ€Ð¸ hover', hint: 'Ð Ð°Ð¼ÐºÐ° Ð¿Ñ€Ð¸ Ð¿Ð¾ÑÐ¾Ñ‡Ð²Ð°Ð½Ðµ' },
    ],
  },
  {
    title: 'Product cards',
    description: 'Карти с продукти в /menu и /order. Празно поле = използва глобалните цветове.',
    fields: [
      { key: 'productCardBg', label: 'Card фон', hint: 'Фон на продуктовата карта' },
      { key: 'productCardText', label: 'Заглавие / текст', hint: 'Основен цвят на името на продукта' },
      { key: 'productCardTitleHover', label: 'Заглавие при hover', hint: 'Цвят на името при посочване' },
      { key: 'productCardBorder', label: 'Card рамка', hint: 'Нормална рамка на картата' },
      { key: 'productCardHoverBorder', label: 'Рамка при hover', hint: 'Рамка при посочване върху картата' },
    ],
  },
  {
    title: 'ÐžÑÐ½Ð¾Ð²Ð½Ð° Ð½Ð°Ð²Ð¸Ð³Ð°Ñ†Ð¸Ñ',
    description: 'Ð“Ð¾Ñ€Ð½Ð¾Ñ‚Ð¾ Ð¿ÑƒÐ±Ð»Ð¸Ñ‡Ð½Ð¾ Ð¼ÐµÐ½ÑŽ: ÐÐ°Ñ‡Ð°Ð»Ð¾, ÐœÐµÐ½ÑŽ, Ð¡ÑŠÐ±Ð¸Ñ‚Ð¸Ñ, ÐšÐ¾Ð½Ñ‚Ð°ÐºÑ‚Ð¸.',
    fields: [
      { key: 'navActiveBg', label: 'ÐÐºÑ‚Ð¸Ð²ÐµÐ½ Ñ„Ð¾Ð½', hint: 'Mobile active Ñ„Ð¾Ð½; desktop Ð¾ÑÑ‚Ð°Ð²Ð° Ñ Ð¿Ð¾Ð´Ñ‡ÐµÑ€Ñ‚Ð°Ð²Ð°Ð½Ðµ' },
      { key: 'navActiveText', label: 'ÐÐºÑ‚Ð¸Ð²ÐµÐ½ Ñ‚ÐµÐºÑÑ‚', hint: 'Ð¦Ð²ÑÑ‚ Ð½Ð° Ñ‚ÐµÐºÑƒÑ‰Ð°Ñ‚Ð° ÑÑ‚Ñ€Ð°Ð½Ð¸Ñ†Ð°' },
      { key: 'navActiveBorder', label: 'ÐÐºÑ‚Ð¸Ð²Ð½Ð° Ð»Ð¸Ð½Ð¸Ñ/Ñ€Ð°Ð¼ÐºÐ°', hint: 'Desktop underline Ð¸ mobile left border' },
      { key: 'navHoverText', label: 'Ð¢ÐµÐºÑÑ‚ Ð¿Ñ€Ð¸ hover', hint: 'Ð¦Ð²ÑÑ‚ Ð¿Ñ€Ð¸ Ð¿Ð¾ÑÐ¾Ñ‡Ð²Ð°Ð½Ðµ Ð²ÑŠÑ€Ñ…Ñƒ Ð»Ð¸Ð½Ðº' },
      { key: 'navMobileActiveBg', label: 'Mobile Ð°ÐºÑ‚Ð¸Ð²ÐµÐ½ Ñ„Ð¾Ð½', hint: 'Ð¤Ð¾Ð½ Ð½Ð° Ð°ÐºÑ‚Ð¸Ð²Ð½Ð¸Ñ Ð»Ð¸Ð½Ðº Ð² Ð¼Ð¾Ð±Ð¸Ð»Ð½Ð¾Ñ‚Ð¾ Ð¼ÐµÐ½ÑŽ' },
    ],
  },
  {
    title: 'Footer / GSoft',
    description: 'Ð”Ð¾Ð»Ð½Ð¸ÑÑ‚ Ñ€ÐµÐ´ â€žÐ ÐµÐ°Ð»Ð¸Ð·Ð¸Ñ€Ð°Ð½Ð¾ Ð¾Ñ‚ GSoft.bgâ€œ Ð¸ Ð½ÐµÐ³Ð¾Ð²Ð¸ÑÑ‚ hover Ñ†Ð²ÑÑ‚.',
    fields: [
      { key: 'footerBg', label: 'Footer Ñ„Ð¾Ð½', hint: 'Ð¤Ð¾Ð½ Ð½Ð° Ð´Ð¾Ð»Ð½Ð°Ñ‚Ð° Ð»ÐµÐ½Ñ‚Ð°' },
      { key: 'footerText', label: 'Footer Ñ‚ÐµÐºÑÑ‚', hint: 'ÐÐ¾Ñ€Ð¼Ð°Ð»ÐµÐ½ Ñ†Ð²ÑÑ‚ Ð½Ð° Ñ‚ÐµÐºÑÑ‚Ð°' },
      { key: 'footerLinkHover', label: 'Link hover', hint: 'Ð¦Ð²ÑÑ‚ Ð¿Ñ€Ð¸ Ð¿Ð¾ÑÐ¾Ñ‡Ð²Ð°Ð½Ðµ Ð²ÑŠÑ€Ñ…Ñƒ GSoft.bg' },
      { key: 'footerBorder', label: 'Footer Ð»Ð¸Ð½Ð¸Ñ', hint: 'Ð“Ð¾Ñ€Ð½Ð° Ñ€Ð°Ð·Ð´ÐµÐ»Ð¸Ñ‚ÐµÐ»Ð½Ð° Ð»Ð¸Ð½Ð¸Ñ' },
    ],
  },
  {
    title: 'Ð¤Ð¾Ð½ Ð¸ Ð¿Ð¾Ð²ÑŠÑ€Ñ…Ð½Ð¾ÑÑ‚Ð¸',
    description: 'ÐžÐ±Ñ‰ Ñ„Ð¾Ð½ Ð½Ð° ÑÐ°Ð¹Ñ‚Ð°, ÐºÐ°Ñ€Ñ‚Ð¸Ñ‡ÐºÐ¸ Ð¸ Ð¿Ð¾Ð»ÐµÑ‚Ð°.',
    fields: [
      { key: 'paper', label: 'Ð¤Ð¾Ð½ Ð½Ð° ÑÑ‚Ñ€Ð°Ð½Ð¸Ñ†Ð°Ñ‚Ð°', hint: 'Ð¦ÐµÐ»Ð¸ÑÑ‚ ÑÐ°Ð¹Ñ‚ (body), Ð°Ð´Ð¼Ð¸Ð½, staff' },
      { key: 'card', label: 'Ð¤Ð¾Ð½ Ð½Ð° ÐºÐ°Ñ€Ñ‚Ð¸Ñ‡ÐºÐ¸', hint: 'Ð‘Ð»Ð¾ÐºÐ¾Ð²Ðµ, Ð¼ÐµÐ½ÑŽÑ‚Ð°, Ñ„Ð¾Ñ€Ð¼Ð¸ Ð² Ð°Ð´Ð¼Ð¸Ð½' },
      { key: 'cardHover', label: 'ÐšÐ°Ñ€Ñ‚Ð¸Ñ‡ÐºÐ° Ð¿Ñ€Ð¸ hover', hint: 'Ð›ÐµÐºÐ¾ Ð¿Ð¾Ñ‚ÑŠÐ¼Ð½ÑÐ²Ð°Ð½Ðµ Ð¿Ñ€Ð¸ Ð¿Ð¾ÑÐ¾Ñ‡Ð²Ð°Ð½Ðµ' },
      { key: 'inset', label: 'Ð’Ð´Ð»ÑŠÐ±Ð½Ð°Ñ‚Ð¸ Ð¿Ð¾Ð»ÐµÑ‚Ð°', hint: 'Input Ð¿Ð¾Ð»ÐµÑ‚Ð°, Ð²ÑŠÑ‚Ñ€ÐµÑˆÐ½Ð¸ Ð¿Ð°Ð½ÐµÐ»Ð¸' },
      { key: 'hairline', label: 'Ð Ð°Ð¼ÐºÐ¸ / Ñ€Ð°Ð·Ð´ÐµÐ»Ð¸Ñ‚ÐµÐ»Ð¸', hint: 'Ð“Ñ€Ð°Ð½Ð¸Ñ†Ð¸ Ð¼ÐµÐ¶Ð´Ñƒ ÑÐµÐºÑ†Ð¸Ð¸' },
      { key: 'hoverBorder', label: 'Ð Ð°Ð¼ÐºÐ¸ Ð¿Ñ€Ð¸ hover', hint: 'Ð¦Ð²ÑÑ‚ Ð½Ð° Ñ€Ð°Ð¼ÐºÐ°Ñ‚Ð° Ð¿Ñ€Ð¸ Ð¿Ð¾ÑÐ¾Ñ‡Ð²Ð°Ð½Ðµ Ð²ÑŠÑ€Ñ…Ñƒ ÐºÐ°Ñ€Ñ‚Ð¸Ñ‡ÐºÐ¸, Ð²Ñ‚Ð¾Ñ€Ð¸Ñ‡Ð½Ð¸ Ð±ÑƒÑ‚Ð¾Ð½Ð¸ Ð¸ pills' },
    ],
  },
  {
    title: 'Ð¢ÐµÐºÑÑ‚',
    description: 'Ð™ÐµÑ€Ð°Ñ€Ñ…Ð¸Ñ Ð½Ð° Ñ‚ÐµÐºÑÑ‚Ð° Ð² Ð¿ÑƒÐ±Ð»Ð¸Ñ‡Ð½Ð°Ñ‚Ð° Ñ‡Ð°ÑÑ‚ Ð¸ Ð°Ð´Ð¼Ð¸Ð½Ð°.',
    fields: [
      { key: 'ink', label: 'ÐžÑÐ½Ð¾Ð²ÐµÐ½ Ñ‚ÐµÐºÑÑ‚', hint: 'Ð—Ð°Ð³Ð»Ð°Ð²Ð¸Ñ, Ð¿Ð°Ñ€Ð°Ð³Ñ€Ð°Ñ„Ð¸, Ð¼ÐµÐ½ÑŽ' },
      { key: 'muted', label: 'Ð’Ñ‚Ð¾Ñ€Ð¸Ñ‡ÐµÐ½ Ñ‚ÐµÐºÑÑ‚', hint: 'ÐŸÐ¾Ð´Ð·Ð°Ð³Ð»Ð°Ð²Ð¸Ñ, Ð¾Ð¿Ð¸ÑÐ°Ð½Ð¸Ñ' },
      { key: 'subtle', label: 'Ð‘Ð»ÐµÐ´ Ñ‚ÐµÐºÑÑ‚', hint: 'Ð•Ñ‚Ð¸ÐºÐµÑ‚Ð¸, Ð¿Ð¾Ð¼Ð¾Ñ‰ÐµÐ½ Ñ‚ÐµÐºÑÑ‚' },
    ],
  },
  {
    title: 'ÐÐºÑ†ÐµÐ½Ñ‚ Ð¸ Ð±ÑƒÑ‚Ð¾Ð½Ð¸',
    description: 'Ð“Ð»Ð°Ð²Ð½Ð¸ CTA Ð±ÑƒÑ‚Ð¾Ð½Ð¸ (ÐœÐµÐ½ÑŽ, ÐŸÐ¾Ñ€ÑŠÑ‡Ð°Ð¹, Ð—Ð°Ð¿Ð°Ð·Ð¸).',
    fields: [
      { key: 'accent', label: 'Ð¦Ð²ÑÑ‚ Ð½Ð° Ð±ÑƒÑ‚Ð¾Ð½Ð¸Ñ‚Ðµ', hint: 'theme-btn-primary â€” Ð°ÐºÑ†ÐµÐ½Ñ‚ÐµÐ½ Ñ„Ð¾Ð½' },
      { key: 'accentHover', label: 'Ð‘ÑƒÑ‚Ð¾Ð½ Ð¿Ñ€Ð¸ hover', hint: 'Ð¤Ð¾Ð½, ÐºÐ¾Ð³Ð°Ñ‚Ð¾ Ð¼Ð¸ÑˆÐºÐ°Ñ‚Ð° Ðµ Ð²ÑŠÑ€Ñ…Ñƒ Ð±ÑƒÑ‚Ð¾Ð½Ð°' },
      { key: 'accentContrast', label: 'Ð¢ÐµÐºÑÑ‚ Ð½Ð° Ð±ÑƒÑ‚Ð¾Ð½Ð°', hint: 'Ð¦Ð²ÑÑ‚ Ð½Ð° Ð±ÑƒÐºÐ²Ð¸Ñ‚Ðµ â€” Ð½Ð¾Ñ€Ð¼Ð°Ð»Ð½Ð¾ ÑÑŠÑÑ‚Ð¾ÑÐ½Ð¸Ðµ' },
      { key: 'accentContrastHover', label: 'Ð¢ÐµÐºÑÑ‚ Ð½Ð° Ð±ÑƒÑ‚Ð¾Ð½Ð° Ð¿Ñ€Ð¸ hover', hint: 'Ð¦Ð²ÑÑ‚ Ð½Ð° Ð±ÑƒÐºÐ²Ð¸Ñ‚Ðµ Ð¿Ñ€Ð¸ hover' },
    ],
  },
  {
    title: 'Ð’Ñ‚Ð¾Ñ€Ð¸Ñ‡Ð½Ð¸ Ð±ÑƒÑ‚Ð¾Ð½Ð¸',
    description: 'ÐžÑ‚ÐºÐ°Ð· Ð² modals (theme-btn-secondary). ÐŸÑ€Ð°Ð·Ð½Ð¾ Ð¿Ð¾Ð»Ðµ = ÑÑ‚Ð¾Ð¹Ð½Ð¾ÑÑ‚ Ð¾Ñ‚ Ð¤Ð¾Ð½/Ð¢ÐµÐºÑÑ‚ Ð¿Ð¾-Ð³Ð¾Ñ€Ðµ.',
    fields: [
      { key: 'btnSecondaryBg', label: 'Ð¤Ð¾Ð½', hint: 'ÐŸÐ¾ Ð¿Ð¾Ð´Ñ€Ð°Ð·Ð±Ð¸Ñ€Ð°Ð½Ðµ: Ð¤Ð¾Ð½ Ð½Ð° ÐºÐ°Ñ€Ñ‚Ð¸Ñ‡ÐºÐ¸' },
      { key: 'btnSecondaryText', label: 'Ð¢ÐµÐºÑÑ‚', hint: 'ÐŸÐ¾ Ð¿Ð¾Ð´Ñ€Ð°Ð·Ð±Ð¸Ñ€Ð°Ð½Ðµ: ÐžÑÐ½Ð¾Ð²ÐµÐ½ Ñ‚ÐµÐºÑÑ‚' },
      { key: 'btnSecondaryBorder', label: 'Ð Ð°Ð¼ÐºÐ°', hint: 'ÐŸÐ¾ Ð¿Ð¾Ð´Ñ€Ð°Ð·Ð±Ð¸Ñ€Ð°Ð½Ðµ: Ð Ð°Ð¼ÐºÐ¸ / Ñ€Ð°Ð·Ð´ÐµÐ»Ð¸Ñ‚ÐµÐ»Ð¸' },
      { key: 'btnSecondaryBgHover', label: 'Ð¤Ð¾Ð½ Ð¿Ñ€Ð¸ hover', hint: 'ÐŸÐ¾ Ð¿Ð¾Ð´Ñ€Ð°Ð·Ð±Ð¸Ñ€Ð°Ð½Ðµ: ÐšÐ°Ñ€Ñ‚Ð¸Ñ‡ÐºÐ° Ð¿Ñ€Ð¸ hover' },
      { key: 'btnSecondaryTextHover', label: 'Ð¢ÐµÐºÑÑ‚ Ð¿Ñ€Ð¸ hover', hint: 'ÐŸÐ¾ Ð¿Ð¾Ð´Ñ€Ð°Ð·Ð±Ð¸Ñ€Ð°Ð½Ðµ: ÑÑŠÑ‰Ð¸ÑÑ‚ ÐºÐ°Ñ‚Ð¾ Ð¢ÐµÐºÑÑ‚' },
    ],
  },
  {
    title: 'ÐžÐ¿Ð°ÑÐ½Ð¸ Ð±ÑƒÑ‚Ð¾Ð½Ð¸',
    description: 'Ð”Ð°, Ð¸Ð·Ð»ÐµÐ· / Ð˜Ð·Ñ‚Ñ€Ð¸Ð¹ (theme-btn-danger) Ð² modals.',
    fields: [
      { key: 'danger', label: 'Ð¤Ð¾Ð½', hint: 'Ð¡ÑŠÑ‰Ð¾Ñ‚Ð¾ ÐºÐ°Ñ‚Ð¾ â€žÐ“Ñ€ÐµÑˆÐºÐ° / Ð¾Ð¿Ð°ÑÐ½Ð¾ÑÑ‚â€œ Ð·Ð° badges' },
      { key: 'dangerHover', label: 'Ð¤Ð¾Ð½ Ð¿Ñ€Ð¸ hover', hint: 'ÐŸÐ¾-Ñ‚ÑŠÐ¼ÐµÐ½ Ñ„Ð¾Ð½ Ð¿Ñ€Ð¸ hover' },
      { key: 'dangerContrast', label: 'Ð¢ÐµÐºÑÑ‚', hint: 'Ð‘ÑƒÐºÐ²Ð¸ Ð²ÑŠÑ€Ñ…Ñƒ Ñ‡ÐµÑ€Ð²ÐµÐ½Ð¸Ñ Ñ„Ð¾Ð½' },
      { key: 'dangerContrastHover', label: 'Ð¢ÐµÐºÑÑ‚ Ð¿Ñ€Ð¸ hover', hint: 'Ð‘ÑƒÐºÐ²Ð¸ Ð¿Ñ€Ð¸ hover' },
    ],
  },
  {
    title: 'Ð¡ÑŠÐ¾Ð±Ñ‰ÐµÐ½Ð¸Ñ (ÑƒÑÐ¿ÐµÑ… / Ð³Ñ€ÐµÑˆÐºÐ°)',
    description: 'Ð‘Ð°Ð½ÐµÑ€Ð¸ Ð¸ badges. Ð§ÐµÑ€Ð²ÐµÐ½ badge Ð¿Ð¾Ð»Ð·Ð²Ð° â€žÐ¤Ð¾Ð½â€œ Ð¾Ñ‚ ÐžÐ¿Ð°ÑÐ½Ð¸ Ð±ÑƒÑ‚Ð¾Ð½Ð¸.',
    fields: [
      { key: 'success', label: 'Ð£ÑÐ¿ÐµÑ…', hint: 'ÐŸÐ¾Ñ‚Ð²ÑŠÑ€Ð¶Ð´ÐµÐ½Ð¸Ñ, â€žÐ·Ð°Ð¿Ð°Ð·ÐµÐ½Ð¾â€œ' },
      { key: 'warning', label: 'ÐŸÑ€ÐµÐ´ÑƒÐ¿Ñ€ÐµÐ¶Ð´ÐµÐ½Ð¸Ðµ', hint: 'Ð’Ð½Ð¸Ð¼Ð°Ð½Ð¸Ðµ, Ð¸Ð·Ñ‡Ð°ÐºÐ²Ð°Ñ‰Ð¸ Ð´ÐµÐ¹ÑÑ‚Ð²Ð¸Ñ' },
      { key: 'info', label: 'Ð˜Ð½Ñ„Ð¾Ñ€Ð¼Ð°Ñ†Ð¸Ñ', hint: 'ÐÐµÑƒÑ‚Ñ€Ð°Ð»Ð½Ð¸ ÑÑŠÐ¾Ð±Ñ‰ÐµÐ½Ð¸Ñ' },
    ],
  },
  {
    title: 'Ð‘Ñ€Ð°ÑƒÐ·ÑŠÑ€ Ð¸ Ñ‚ÐµÐ»ÐµÑ„Ð¾Ð½',
    description: 'Ð›ÐµÐ½Ñ‚Ð° Ð½Ð°Ð´ Ð°Ð´Ñ€ÐµÑÐ½Ð°Ñ‚Ð° Ð»ÐµÐ½Ñ‚Ð° Ð¸ PWA.',
    fields: [
      { key: 'themeColor', label: 'Ð¦Ð²ÑÑ‚ Ð½Ð° Ð»ÐµÐ½Ñ‚Ð°Ñ‚Ð° (theme-color)', hint: 'Safari/Chrome Ð³Ð¾Ñ€Ð½Ð° Ð»ÐµÐ½Ñ‚Ð°, splash screen' },
    ],
  },
];

const LOGO_FIELDS: { key: keyof BrandAppearanceSettings; label: string; hint: string }[] = [
  { key: 'navLogoUrl', label: 'Ð›Ð¾Ð³Ð¾ Ð² Ð³Ð¾Ñ€Ð½Ð°Ñ‚Ð° Ð»ÐµÐ½Ñ‚Ð°', hint: 'Ð’Ð¸Ð½Ð°Ð³Ð¸ Ð²Ð¸Ð´Ð¸Ð¼Ð¾ Ð¿Ñ€Ð¸ ÑÐºÑ€Ð¾Ð» â€” Ð²ÑÐ¸Ñ‡ÐºÐ¸ Ð¿ÑƒÐ±Ð»Ð¸Ñ‡Ð½Ð¸ ÑÑ‚Ñ€Ð°Ð½Ð¸Ñ†Ð¸' },
  { key: 'heroLogoUrl', label: 'Ð“Ð¾Ð»ÑÐ¼Ð¾ Ð»Ð¾Ð³Ð¾ Ð½Ð° Ð½Ð°Ñ‡Ð°Ð»Ð½Ð°', hint: 'Ð¡Ð°Ð¼Ð¾ homepage hero' },
  { key: 'appIconUrl', label: 'Ð˜ÐºÐ¾Ð½Ð° Ð·Ð° Ð¿Ñ€Ð¸Ð»Ð¾Ð¶ÐµÐ½Ð¸Ðµ (PWA)', hint: 'â€žÐ”Ð¾Ð±Ð°Ð²Ð¸ ÐºÑŠÐ¼ Ð½Ð°Ñ‡Ð°Ð»Ð½Ð¸Ñ ÐµÐºÑ€Ð°Ð½â€œ, push Ð¸Ð·Ð²ÐµÑÑ‚Ð¸Ñ' },
  { key: 'faviconUrl', label: 'Favicon (Ñ‚Ð°Ð±)', hint: 'ÐœÐ°Ð»ÐºÐ°Ñ‚Ð° Ð¸ÐºÐ¾Ð½Ð° Ð² Ñ‚Ð°Ð±Ð° Ð½Ð° Ð±Ñ€Ð°ÑƒÐ·ÑŠÑ€Ð°' },
];

const FONT_FIELDS: { key: keyof BrandAppearanceSettings; label: string; hint: string; placeholder: string }[] = [
  { key: 'fontDisplayFamily', label: 'Ð—Ð°Ð³Ð»Ð°Ð²Ð¸Ñ / Ð±Ð°Ð½ÐµÑ€', hint: 'Mood banner Ð½Ð° Ð½Ð°Ñ‡Ð°Ð»Ð½Ð°, Ð³Ð¾Ð»ÐµÐ¼Ð¸ Ð½Ð°Ð´Ð¿Ð¸ÑÐ¸', placeholder: 'Ruslan Display' },
  { key: 'fontButtonsFamily', label: 'Ð‘ÑƒÑ‚Ð¾Ð½Ð¸', hint: 'Ð’ÑÐ¸Ñ‡ÐºÐ¸ Ð¾ÑÐ½Ð¾Ð²Ð½Ð¸ Ð¸ Ð²Ñ‚Ð¾Ñ€Ð¸Ñ‡Ð½Ð¸ Ð±ÑƒÑ‚Ð¾Ð½Ð¸', placeholder: 'Pangolin' },
  { key: 'fontNavFamily', label: 'ÐÐ°Ð²Ð¸Ð³Ð°Ñ†Ð¸Ñ', hint: 'ÐœÐµÐ½ÑŽ: ÐÐ°Ñ‡Ð°Ð»Ð¾, ÐœÐµÐ½ÑŽ, Ð¡ÑŠÐ±Ð¸Ñ‚Ð¸Ñâ€¦', placeholder: 'Reggae One' },
  { key: 'fontBodyFamily', label: 'ÐžÐ±Ð¸ÐºÐ½Ð¾Ð²ÐµÐ½ Ñ‚ÐµÐºÑÑ‚', hint: 'ÐŸÐ°Ñ€Ð°Ð³Ñ€Ð°Ñ„Ð¸, Ñ„Ð¾Ñ€Ð¼Ð¸ (Ð°ÐºÐ¾ Ðµ Ð¿Ñ€Ð°Ð·Ð½Ð¾ â€” Inter)', placeholder: 'Inter' },
];

function ColorInput({
  label,
  hint,
  value,
  fallback,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  fallback: string;
  onChange: (v: string | null) => void;
}) {
  const resolved = coalesceColor(value, fallback);
  const pickerValue = /^#[0-9a-fA-F]{6}$/.test(resolved) ? resolved : fallback;

  return (
    <div className="space-y-1 rounded-lg border border-[var(--theme-hairline)] bg-[var(--theme-inset)]/30 p-3">
      <label className="theme-label">{label}</label>
      <p className="theme-muted text-xs leading-snug">{hint}</p>
      <div className="flex items-center gap-2 pt-1">
        <input
          type="color"
          value={pickerValue}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded border border-[var(--theme-hairline)] bg-white p-0.5"
          aria-label={`${label} â€” Ñ†Ð²ÐµÑ‚Ð¾Ð² Ð¸Ð·Ð±Ð¾Ñ€`}
        />
        <input
          className="theme-field flex-1 font-mono text-sm"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value.trim() || null)}
          placeholder={fallback}
        />
        <span
          className="h-10 w-10 shrink-0 rounded-md border border-[var(--theme-hairline)]"
          style={{ background: resolved }}
          title={resolved}
          aria-hidden
        />
      </div>
    </div>
  );
}

function BrandingPreview({ settings }: { settings: BrandAppearanceSettings }) {
  const p = useMemo(() => {
    const c = (k: keyof typeof DEFAULTS) => coalesceColor(settings[k] as string | null, DEFAULTS[k]);
    const fonts = fontVarsFromAppearance(settings);
    return {
      paper: c('paper'),
      ink: c('ink'),
      muted: c('muted'),
      card: c('card'),
      hairline: c('hairline'),
      hoverBorder: c('hoverBorder'),
      inset: c('inset'),
      accent: c('accent'),
      accentHover: c('accentHover'),
      accentContrast: c('accentContrast'),
      accentContrastHover: coalesceColor(settings.accentContrastHover, c('accentContrast')),
      heroGlow: c('heroGlow'),
      heroMoodBg: c('heroMoodBg'),
      homepageAccent: c('homepageAccent'),
      menuActiveBg: c('menuActiveBg'),
      menuActiveText: c('menuActiveText'),
      menuActiveBorder: c('menuActiveBorder'),
      menuInactiveBg: c('menuInactiveBg'),
      menuInactiveText: c('menuInactiveText'),
      menuInactiveBorder: c('menuInactiveBorder'),
      menuHoverBg: c('menuHoverBg'),
      menuHoverBorder: c('menuHoverBorder'),
      navActiveBg: c('navActiveBg'),
      navActiveText: c('navActiveText'),
      navActiveBorder: c('navActiveBorder'),
      navHoverText: c('navHoverText'),
      navMobileActiveBg: c('navMobileActiveBg'),
      footerBg: c('footerBg'),
      footerText: c('footerText'),
      footerLinkHover: c('footerLinkHover'),
      footerBorder: c('footerBorder'),
      productCardBg: c('productCardBg'),
      productCardText: c('productCardText'),
      productCardTitleHover: c('productCardTitleHover'),
      productCardBorder: c('productCardBorder'),
      productCardHoverBorder: c('productCardHoverBorder'),
      btnSecondaryBg: coalesceColor(settings.btnSecondaryBg, c('card')),
      btnSecondaryText: coalesceColor(settings.btnSecondaryText, c('ink')),
      btnSecondaryBorder: coalesceColor(settings.btnSecondaryBorder, c('hairline')),
      btnSecondaryBgHover: coalesceColor(settings.btnSecondaryBgHover, c('cardHover')),
      btnSecondaryTextHover: coalesceColor(settings.btnSecondaryTextHover, coalesceColor(settings.btnSecondaryText, c('ink'))),
      success: c('success'),
      warning: c('warning'),
      danger: c('danger'),
      dangerHover: coalesceColor(settings.dangerHover, c('dangerHover')),
      dangerContrast: coalesceColor(settings.dangerContrast, c('dangerContrast')),
      dangerContrastHover: coalesceColor(settings.dangerContrastHover, coalesceColor(settings.dangerContrast, c('dangerContrast'))),
      fontDisplay: fonts.display || undefined,
      fontButtons: fonts.buttons || undefined,
      fontNav: fonts.nav || undefined,
      fontBody: fonts.body || undefined,
      googleFontsCssUrl: fonts.googleFontsCssUrl,
      displayEffectClass: fonts.displayEffectClass,
      moodEffectClass: fonts.moodEffectClass,
      navEffectClass: fonts.navEffectClass,
      menuEffectClass: fonts.menuEffectClass,
      productEffectClass: fonts.productEffectClass,
      buttonEffectClass: fonts.buttonEffectClass,
      navLogo: (settings.navLogoUrl || '').trim(),
      siteTitle: (settings.siteShortName || settings.siteTitle || 'Ð’Ð°ÑˆÐ¸ÑÑ‚ Ð±Ñ€Ð°Ð½Ð´').trim(),
    };
  }, [settings]);

  useEffect(() => {
    const href = p.googleFontsCssUrl;
    const id = 'brand-preview-google-fonts';
    const existing = document.getElementById(id) as HTMLLinkElement | null;
    if (!href) {
      existing?.remove();
      return;
    }
    if (existing) {
      if (existing.href !== href) existing.href = href;
      return;
    }
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
    return () => {
      document.getElementById(id)?.remove();
    };
  }, [p.googleFontsCssUrl]);

  return (
    <div className="sticky top-24 space-y-4">
      <div className="rounded-xl border border-[var(--theme-hairline)] bg-[var(--theme-card)] p-4">
        <h3 className="text-lg font-bold text-[var(--theme-ink)]">ÐŸÑ€ÐµÐ³Ð»ÐµÐ´ (Ð»Ð¾ÐºÐ°Ð»ÐµÐ½)</h3>
        <p className="theme-muted mt-1 text-xs leading-relaxed">
          ÐŸÐ¾ÐºÐ°Ð·Ð²Ð° Ñ‚ÐµÐºÑƒÑ‰Ð¸Ñ‚Ðµ ÑÑ‚Ð¾Ð¹Ð½Ð¾ÑÑ‚Ð¸ Ð² Ð¿Ð¾Ð»ÐµÑ‚Ð°Ñ‚Ð° â€” <strong>Ð±ÐµÐ· Ð·Ð°Ð¿Ð°Ð·Ð²Ð°Ð½Ðµ</strong>. Ð¡Ð»ÐµÐ´ â€žÐ—Ð°Ð¿Ð°Ð·Ð¸â€œ Ð¿Ñ€ÐµÐ·Ð°Ñ€ÐµÐ´Ð¸
          Ð¿ÑƒÐ±Ð»Ð¸Ñ‡Ð½Ð¸Ñ ÑÐ°Ð¹Ñ‚ Ð·Ð° Ñ„Ð¸Ð½Ð°Ð»ÐµÐ½ Ð²Ð¸Ð´. ÐŸÑŠÐ»ÐµÐ½ site preview Ð½Ðµ Ðµ Ð½ÑƒÐ¶ÐµÐ½ â€” Ñ‚Ð¾Ð²Ð° Ðµ Ð´Ð¾ÑÑ‚Ð°Ñ‚ÑŠÑ‡Ð½Ð¾ Ð·Ð° Ñ†Ð²ÐµÑ‚Ð¾Ð²Ðµ Ð¸ Ð±ÑƒÑ‚Ð¾Ð½Ð¸.
        </p>
      </div>

      <div
        className="overflow-hidden rounded-xl border shadow-md"
        style={{ borderColor: p.hairline, background: p.paper, color: p.ink, fontFamily: p.fontBody }}
      >
        {/* mock nav */}
        <div
          className="flex items-center justify-between gap-2 border-b px-3 py-2"
          style={{ borderColor: p.hairline, background: p.paper, fontFamily: p.fontNav }}
        >
          <div className="flex min-w-0 items-center gap-2">
            {p.navLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.navLogo} alt="" className="h-8 w-auto max-w-[100px] object-contain" />
            ) : (
              <span className="truncate text-sm font-semibold" style={{ fontFamily: p.fontNav }}>
                {p.siteTitle}
              </span>
            )}
          </div>
          <span className="text-xs opacity-70" style={{ fontFamily: p.fontNav }}>
            ÐœÐµÐ½ÑŽ Â· ÐšÐ¾Ð½Ñ‚Ð°ÐºÑ‚Ð¸
          </span>
        </div>

        <div className={`flex flex-wrap items-center gap-3 border-b px-3 py-2 text-xs ${p.navEffectClass}`} style={{ borderColor: p.hairline }}>
          <span className="border-b-2 font-semibold" style={{ color: p.navActiveText, borderColor: p.navActiveBorder }}>
            ÐœÐµÐ½ÑŽ
          </span>
          <span style={{ color: p.navHoverText }}>Hover</span>
          <span
            className="rounded-lg border-l-4 px-2 py-1"
            style={{ color: p.navActiveText, background: p.navMobileActiveBg, borderColor: p.navActiveBorder }}
          >
            Mobile
          </span>
        </div>

        <div className="space-y-3 p-3">
          {/* mood banner mock */}
          <p
            className={`mx-auto max-w-full rounded-full border-2 px-4 py-2 text-center text-sm ${p.moodEffectClass}`}
            style={{
              fontFamily: p.fontDisplay,
              borderColor: p.heroGlow,
              background: p.heroMoodBg,
              color: p.accentContrast,
              boxShadow: `0 0 22px ${p.heroGlow}55`,
            }}
          >
            Ð”Ð¾Ð±Ñ€Ð¾ Ð½Ð°ÑÑ‚Ñ€Ð¾ÐµÐ½Ð¸Ðµ
          </p>

          <div className="flex flex-wrap justify-center gap-2 text-xs font-medium">
            <span
              className={`rounded-full border px-3 py-1 uppercase tracking-[0.18em] ${p.displayEffectClass}`}
              style={{ borderColor: p.homepageAccent, color: p.homepageAccent, background: `${p.homepageAccent}18` }}
            >
              ÐŸÑ€ÐµÐ´Ð»Ð¾Ð¶ÐµÐ½Ð¸Ñ
            </span>
            <span
              className={`rounded-full border px-3 py-1 ${p.displayEffectClass}`}
              style={{ borderColor: p.homepageAccent, color: p.homepageAccent, background: `${p.homepageAccent}18` }}
            >
              ÐšÐ»Ð°ÑÐ¸ÐºÐ°
            </span>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${p.menuEffectClass}`}
              style={{ background: p.menuActiveBg, color: p.menuActiveText, borderColor: p.menuActiveBorder }}
            >
              ÐÐºÑ‚Ð¸Ð²Ð½Ð° ÐºÐ°Ñ‚ÐµÐ³Ð¾Ñ€Ð¸Ñ
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${p.menuEffectClass}`}
              style={{ background: p.menuInactiveBg, color: p.menuInactiveText, borderColor: p.menuInactiveBorder }}
            >
              ÐšÐ°Ñ‚ÐµÐ³Ð¾Ñ€Ð¸Ñ
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${p.menuEffectClass}`}
              style={{ background: p.menuHoverBg, color: p.menuInactiveText, borderColor: p.menuHoverBorder }}
            >
              Hover
            </span>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${p.buttonEffectClass}`}
              style={{ background: p.accent, color: p.accentContrast, fontFamily: p.fontButtons }}
            >
              ÐžÑÐ½Ð¾Ð²ÐµÐ½ Ð±ÑƒÑ‚Ð¾Ð½
            </button>
            <button
              type="button"
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${p.buttonEffectClass}`}
              style={{ background: p.accentHover, color: p.accentContrastHover, fontFamily: p.fontButtons }}
              title="ÐŸÑ€ÐµÐ³Ð»ÐµÐ´ Ð¿Ñ€Ð¸ hover"
            >
              ÐŸÑ€Ð¸ hover
            </button>
            <button
              type="button"
              className={`rounded-xl border px-4 py-2 text-sm font-semibold ${p.buttonEffectClass}`}
              style={{
                background: p.btnSecondaryBg,
                color: p.btnSecondaryText,
                borderColor: p.btnSecondaryBorder,
                fontFamily: p.fontButtons,
              }}
            >
              ÐžÑ‚ÐºÐ°Ð·
            </button>
            <button
              type="button"
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${p.buttonEffectClass}`}
              style={{ background: p.danger, color: p.dangerContrast, fontFamily: p.fontButtons }}
            >
              Ð”Ð°, Ð¸Ð·Ð»ÐµÐ·
            </button>
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="rounded-xl border px-4 py-2 text-sm font-semibold"
              style={{
                background: p.btnSecondaryBgHover,
                color: p.btnSecondaryTextHover,
                borderColor: p.btnSecondaryBorder,
                fontFamily: p.fontButtons,
              }}
              title="ÐžÑ‚ÐºÐ°Ð· Ð¿Ñ€Ð¸ hover"
            >
              ÐžÑ‚ÐºÐ°Ð· hover
            </button>
            <button
              type="button"
              className="rounded-xl px-4 py-2 text-sm font-semibold"
              style={{ background: p.dangerHover, color: p.dangerContrastHover, fontFamily: p.fontButtons }}
              title="ÐžÐ¿Ð°ÑÐµÐ½ Ð¿Ñ€Ð¸ hover"
            >
              Ð˜Ð·Ð»ÐµÐ· hover
            </button>
          </div>

          <div
            className="rounded-xl border p-3 text-sm"
            style={{ background: p.card, borderColor: p.hoverBorder, color: p.ink }}
          >
            <p className="font-semibold">ÐŸÑ€Ð¸Ð¼ÐµÑ€Ð½Ð° ÐºÐ°Ñ€Ñ‚Ð¸Ñ‡ÐºÐ°</p>
            <p style={{ color: p.muted }}>Ð’Ñ‚Ð¾Ñ€Ð¸Ñ‡ÐµÐ½ Ñ‚ÐµÐºÑÑ‚ Ð² Ð¼ÐµÐ½ÑŽ Ð¸Ð»Ð¸ Ð°Ð´Ð¼Ð¸Ð½.</p>
            <input
              readOnly
              value="ÐŸÑ€Ð¸Ð¼ÐµÑ€Ð½Ð¾ Ð¿Ð¾Ð»Ðµ"
              className="mt-2 w-full rounded-lg border px-2 py-1.5 text-sm"
              style={{ background: p.inset, borderColor: p.hairline, color: p.ink }}
            />
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <span className="rounded-full px-2 py-1" style={{ background: `${p.success}22`, color: p.success }}>
              Ð£ÑÐ¿ÐµÑ…
            </span>
            <span className="rounded-full px-2 py-1" style={{ background: `${p.warning}22`, color: p.warning }}>
              Ð’Ð½Ð¸Ð¼Ð°Ð½Ð¸Ðµ
            </span>
            <span className="rounded-full px-2 py-1" style={{ background: `${p.danger}22`, color: p.danger }}>
              Ð“Ñ€ÐµÑˆÐºÐ°
            </span>
          </div>
          <div
            className="rounded-xl border px-3 py-2 text-center text-xs"
            style={{ background: p.footerBg, borderColor: p.footerBorder, color: p.footerText }}
          >
            Реализирано от{' '}
            <span style={{ color: p.footerLinkHover, fontWeight: 700 }}>GSoft.bg</span>
          </div>
        </div>
      </div>

      <p className="theme-muted text-xs">
        Ð—Ð° ÑˆÑ€Ð¸Ñ„Ñ‚Ð¾Ð²Ðµ: Ð°ÐºÐ¾ ÑÐ¼ÐµÐ½Ð¸Ñˆ Google Fonts URL, Ð¿Ñ€ÐµÐ³Ð»ÐµÐ´ÑŠÑ‚ Ð¼Ð¾Ð¶Ðµ Ð´Ð° Ð¸Ð·Ð¿Ð¾Ð»Ð·Ð²Ð° ÑˆÑ€Ð¸Ñ„Ñ‚Ð° ÐµÐ´Ð²Ð° ÑÐ»ÐµÐ´ Ð·Ð°Ð¿Ð°Ð·Ð²Ð°Ð½Ðµ Ð¸ Ð¿Ñ€ÐµÐ·Ð°Ñ€ÐµÐ¶Ð´Ð°Ð½Ðµ
        (Ð±Ñ€Ð°ÑƒÐ·ÑŠÑ€ÑŠÑ‚ Ñ‚Ñ€ÑÐ±Ð²Ð° Ð´Ð° Ð·Ð°Ñ€ÐµÐ´Ð¸ CSS Ñ„Ð°Ð¹Ð»Ð°).
      </p>
    </div>
  );
}

export default function BrandingAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = React.use(params);
  const { data: session, status } = useSession();
  const router = useRouter();

  const role = (session?.user as any)?.role as string | undefined;
  const isSuper = role === 'SUPER_ADMIN';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [settings, setSettings] = useState<BrandAppearanceSettings | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__isOffline) return;
    if (status === 'unauthenticated') {
      window.location.href = `/${locale}/admin/login`;
    }
  }, [status, locale]);

  useEffect(() => {
    if (status !== 'authenticated' || !isSuper) return;
    void (async () => {
      try {
        const res = await fetch('/api/brand-appearance', { cache: 'no-store' });
        const data = await res.json();
        setSettings((data?.settings ?? null) as BrandAppearanceSettings | null);
      } catch {
        setToast({ message: 'Ð“Ñ€ÐµÑˆÐºÐ° Ð¿Ñ€Ð¸ Ð·Ð°Ñ€ÐµÐ¶Ð´Ð°Ð½Ðµ Ð½Ð° Ð½Ð°ÑÑ‚Ñ€Ð¾Ð¹ÐºÐ¸Ñ‚Ðµ', type: 'error' });
      } finally {
        setLoading(false);
      }
    })();
  }, [status, isSuper]);

  async function handleUpload(file: File): Promise<string> {
    const fd = new FormData();
    fd.set('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Ð“Ñ€ÐµÑˆÐºÐ° Ð¿Ñ€Ð¸ ÐºÐ°Ñ‡Ð²Ð°Ð½Ðµ');
    return String(data.url || '');
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch('/api/brand-appearance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Ð“Ñ€ÐµÑˆÐºÐ° Ð¿Ñ€Ð¸ Ð·Ð°Ð¿Ð°Ð·Ð²Ð°Ð½Ðµ');
      setSettings(data.settings as BrandAppearanceSettings);
      setToast({ message: 'âœ… Ð—Ð°Ð¿Ð°Ð·ÐµÐ½Ð¾ â€” Ð¿Ñ€ÐµÐ·Ð°Ñ€ÐµÐ´Ð¸ ÑÐ°Ð¹Ñ‚Ð° Ð·Ð° Ð¿ÑŠÐ»ÐµÐ½ ÐµÑ„ÐµÐºÑ‚', type: 'success' });
    } catch (e: any) {
      setToast({ message: e?.message || 'Ð“Ñ€ÐµÑˆÐºÐ° Ð¿Ñ€Ð¸ Ð·Ð°Ð¿Ð°Ð·Ð²Ð°Ð½Ðµ', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (status === 'loading' || loading) return <ManagedLoadingScreen locale={locale} />;

  if (!isSuper) {
    return (
      <div className="mx-auto w-full max-w-2xl p-6 md:p-8">
        <div className="theme-card p-6">
          <p className="theme-muted">Ð¡Ð°Ð¼Ð¾ Super Admin Ð¼Ð¾Ð¶Ðµ Ð´Ð° Ñ€ÐµÐ´Ð°ÐºÑ‚Ð¸Ñ€Ð° Ð±Ñ€Ð°Ð½Ð´Ð¸Ð½Ð³Ð°.</p>
        </div>
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="mx-auto max-w-6xl">
      {toast && typeof window !== 'undefined' && !(window as any).__isOffline && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="mb-8">
        <button
          type="button"
          onClick={() => router.push(`/${locale}/admin`)}
          className="theme-muted mb-4 flex items-center gap-2 transition-colors hover:text-[var(--theme-ink)]"
        >
          <span>â†</span>
          <span>ÐÐ°Ð·Ð°Ð´ ÐºÑŠÐ¼ Ñ‚Ð°Ð±Ð»Ð¾Ñ‚Ð¾</span>
        </button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="theme-admin-heading-font theme-admin-page-title">ðŸŽ¨ Ð‘Ñ€Ð°Ð½Ð´Ð¸Ð½Ð³ Ð¸ Ð²ÑŠÐ½ÑˆÐµÐ½ Ð²Ð¸Ð´</h1>
            <p className="theme-muted mt-2 max-w-2xl text-sm leading-relaxed">
              Ð¦Ð²ÐµÑ‚Ð¾Ð²Ðµ, Ð»Ð¾Ð³Ð°, ÑˆÑ€Ð¸Ñ„Ñ‚Ð¾Ð²Ðµ Ð¸ Ð·Ð°Ð³Ð»Ð°Ð²Ð¸Ðµ Ð² Ñ‚Ð°Ð±Ð°. ÐŸÑ€Ð°Ð·Ð½Ð¾ Ð¿Ð¾Ð»Ðµ = ÑÑ‚Ð¾Ð¹Ð½Ð¾ÑÑ‚ Ð¿Ð¾ Ð¿Ð¾Ð´Ñ€Ð°Ð·Ð±Ð¸Ñ€Ð°Ð½Ðµ Ð¾Ñ‚ Ñ‚ÐµÐ¼Ð°Ñ‚Ð°. ÐŸÑ€Ð¾Ð¼ÐµÐ½Ð¸Ñ‚Ðµ
              Ð²Ð°Ð¶Ð°Ñ‚ Ð·Ð° Ð¿ÑƒÐ±Ð»Ð¸Ñ‡Ð½Ð¸Ñ ÑÐ°Ð¹Ñ‚, Ð°Ð´Ð¼Ð¸Ð½ Ð¸ staff ÑÐ»ÐµÐ´ â€žÐ—Ð°Ð¿Ð°Ð·Ð¸â€œ.
            </p>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="theme-btn-primary theme-btn-admin-compact w-full shrink-0 rounded-lg font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {saving ? 'Ð—Ð°Ð¿Ð°Ð·Ð²Ð°Ð½Ðµ...' : 'Ð—Ð°Ð¿Ð°Ð·Ð¸ Ð²ÑÐ¸Ñ‡ÐºÐ¾'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_minmax(280px,340px)]">
        <div className="min-w-0 space-y-6">
          <section className="theme-card rounded-xl p-6 md:p-8 space-y-4">
            <h2 className="text-xl font-bold text-[var(--theme-ink)]">Ð˜Ð¼Ðµ Ð¸ Ñ‚Ð°Ð± Ð½Ð° Ð±Ñ€Ð°ÑƒÐ·ÑŠÑ€Ð°</h2>
            <p className="theme-muted text-sm">ÐšÐ°ÐºÐ²Ð¾ Ð¿Ð¸ÑˆÐµ Ð² Ð·Ð°Ð³Ð»Ð°Ð²Ð¸ÐµÑ‚Ð¾ Ð½Ð° Ñ‚Ð°Ð±Ð° Ð¸ Ð¿Ñ€Ð¸ â€žÐ”Ð¾Ð±Ð°Ð²Ð¸ ÐºÑŠÐ¼ Ð½Ð°Ñ‡Ð°Ð»Ð½Ð¸Ñ ÐµÐºÑ€Ð°Ð½â€œ.</p>
            <div className="grid grid-cols-1 gap-4">
              {(
                [
                  ['siteTitle', 'Ð—Ð°Ð³Ð»Ð°Ð²Ð¸Ðµ Ð² Ñ‚Ð°Ð±Ð°', 'Ð½Ð°Ð¿Ñ€. Ð ÐµÑÑ‚Ð¾Ñ€Ð°Ð½Ñ‚ÑÐºÐ¸ ÐºÐ¾Ð¼Ð¿Ð»ÐµÐºÑ Ð”ÑƒÐ½Ð°Ð² â€“ Ð ÑƒÑÐµ'],
                  ['siteShortName', 'ÐšÑ€Ð°Ñ‚ÐºÐ¾ Ð¸Ð¼Ðµ (Ð¸ÐºÐ¾Ð½Ð° Ð½Ð° Ñ‚ÐµÐ»ÐµÑ„Ð¾Ð½Ð°)', 'Ð½Ð°Ð¿Ñ€. Ð”ÑƒÐ½Ð°Ð²'],
                  ['siteDescription', 'ÐžÐ¿Ð¸ÑÐ°Ð½Ð¸Ðµ Ð·Ð° Google / ÑÐ¿Ð¾Ð´ÐµÐ»ÑÐ½Ðµ', 'Ð½Ð°Ð¿Ñ€. ÐœÐµÐ½ÑŽ, ÑÑŠÐ±Ð¸Ñ‚Ð¸Ñ Ð¸ Ð¿Ð¾Ñ€ÑŠÑ‡ÐºÐ¸â€¦'],
                ] as const
              ).map(([key, label, placeholder]) => (
                <div key={key} className="space-y-1">
                  <label className="theme-label">{label}</label>
                  <input
                    className="theme-field"
                    value={(settings as any)[key] ?? ''}
                    onChange={(e) => setSettings({ ...settings, [key]: e.target.value || null } as any)}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="theme-card rounded-xl p-6 md:p-8 space-y-4">
            <h2 className="text-xl font-bold text-[var(--theme-ink)]">Ð¨Ñ€Ð¸Ñ„Ñ‚Ð¾Ð²Ðµ</h2>
            <p className="theme-muted text-sm leading-relaxed">
              ÐžÑ‚{' '}
              <a
                href="https://fonts.google.com/specimen/Ruslan+Display?lang=bg_Cyrl"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--theme-accent)] underline"
              >
                Google Fonts
              </a>
              : â€žGet fontâ€œ â†’ ÐºÐ¾Ð¿Ð¸Ñ€Ð°Ð¹ <strong>link</strong> URL (Ð½Ðµ Ñ†ÐµÐ»Ð¸Ñ HTML Ñ‚Ð°Ð³) Ð¸Ð»Ð¸ ÑÐ°Ð¼Ð¾ Ð²ÑŠÐ²ÐµÐ´Ð¸ Ð¸Ð¼ÐµÑ‚Ð¾ Ð½Ð° ÑˆÑ€Ð¸Ñ„Ñ‚Ð°
              Ð¿Ð¾-Ð´Ð¾Ð»Ñƒ.
            </p>
            <div className="space-y-1">
              <label className="theme-label">Link ÐºÑŠÐ¼ Google Fonts (Ð¿Ð¾ Ð¸Ð·Ð±Ð¾Ñ€)</label>
              <input
                className="theme-field font-mono text-xs"
                value={settings.googleFontsCssUrl ?? ''}
                onChange={(e) => setSettings({ ...settings, googleFontsCssUrl: e.target.value || null })}
                placeholder="https://fonts.googleapis.com/css2?family=Ruslan+Display&display=swap"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {FONT_FIELDS.map(({ key, label, hint, placeholder }) => (
                <div key={key} className="space-y-1">
                  <label className="theme-label">{label}</label>
                  <p className="theme-muted text-xs">{hint}</p>
                  <input
                    className="theme-field"
                    value={(settings as any)[key] ?? ''}
                    onChange={(e) => setSettings({ ...settings, [key]: e.target.value || null } as any)}
                    placeholder={placeholder}
                    style={
                      (settings as any)[key]
                        ? { fontFamily: normalizeFontFamilyStack((settings as any)[key]) ?? undefined }
                        : undefined
                    }
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                ['fontMoodEffect', 'Ð•Ñ„ÐµÐºÑ‚ Ð·Ð° mood Ð±Ð°Ð½ÐµÑ€Ð°', 'Food â€¢ Drinksâ€¦ Ð² hero ÑÐµÐºÑ†Ð¸ÑÑ‚Ð°'],
                ['fontDisplayEffect', 'Ð•Ñ„ÐµÐºÑ‚ Ð·Ð° display Ð·Ð°Ð³Ð»Ð°Ð²Ð¸Ñ', 'Ð“Ð¾Ð»ÐµÐ¼Ð¸ Ð·Ð°Ð³Ð»Ð°Ð²Ð¸Ñ Ð¸ ÐµÑ‚Ð¸ÐºÐµÑ‚Ð¸ Ð½Ð° Ð½Ð°Ñ‡Ð°Ð»Ð½Ð°Ñ‚Ð°'],
                ['fontNavEffect', 'Ð•Ñ„ÐµÐºÑ‚ Ð·Ð° Ð½Ð°Ð²Ð¸Ð³Ð°Ñ†Ð¸ÑÑ‚Ð°', 'Ð›Ð¸Ð½ÐºÐ¾Ð²ÐµÑ‚Ðµ Ð² Ð³Ð¾Ñ€Ð½Ð¾Ñ‚Ð¾ Ð¼ÐµÐ½ÑŽ'],
                ['fontMenuEffect', 'Ð•Ñ„ÐµÐºÑ‚ Ð·Ð° Ð¼ÐµÐ½ÑŽ ÐºÐ°Ñ‚ÐµÐ³Ð¾Ñ€Ð¸Ð¸Ñ‚Ðµ', 'ÐšÐ°Ñ‚ÐµÐ³Ð¾Ñ€Ð¸Ð¹Ð½Ð¸ Ð±ÑƒÑ‚Ð¾Ð½Ð¸ Ð² /menu'],
                ['fontProductEffect', 'Ð•Ñ„ÐµÐºÑ‚ Ð·Ð° Ð¿Ñ€Ð¾Ð´ÑƒÐºÑ‚Ð¾Ð²Ð¸ Ð·Ð°Ð³Ð»Ð°Ð²Ð¸Ñ', 'Ð˜Ð¼ÐµÐ½Ð°Ñ‚Ð° Ð½Ð° Ð¿Ñ€Ð¾Ð´ÑƒÐºÑ‚Ð¸Ñ‚Ðµ Ð² Ð¼ÐµÐ½ÑŽÑ‚Ð¾'],
                ['fontButtonEffect', 'Ð•Ñ„ÐµÐºÑ‚ Ð·Ð° CTA Ð±ÑƒÑ‚Ð¾Ð½Ð¸', 'ÐžÑÐ½Ð¾Ð²Ð½Ð¸ Ð±ÑƒÑ‚Ð¾Ð½Ð¸ Ð½Ð° Ð½Ð°Ñ‡Ð°Ð»Ð½Ð°Ñ‚Ð°'],
              ].map(([key, label, hint]) => (
                <div key={key} className="space-y-1">
                  <label className="theme-label">{label}</label>
                  <p className="theme-muted text-xs">{hint}</p>
                  <select
                    className="theme-field"
                    value={(settings as any)[key] ?? 'none'}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        [key]: e.target.value === 'none' ? null : e.target.value,
                      } as any)
                    }
                  >
                    {GOOGLE_FONT_EFFECTS.map((effect) => (
                      <option key={effect} value={effect}>
                        {effect === 'none' ? 'Ð‘ÐµÐ· ÐµÑ„ÐµÐºÑ‚' : effect}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </section>

          {COLOR_GROUPS.map((group) => (
            <section key={group.title} className="theme-card rounded-xl p-6 md:p-8 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-[var(--theme-ink)]">{group.title}</h2>
                <p className="theme-muted mt-1 text-sm">{group.description}</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {group.fields.map((field) => (
                  <ColorInput
                    key={field.key}
                    label={field.label}
                    hint={field.hint}
                    value={(settings[field.key] as string | null) ?? ''}
                    fallback={colorFieldFallback(field.key)}
                    onChange={(v) => setSettings({ ...settings, [field.key]: v } as BrandAppearanceSettings)}
                  />
                ))}
              </div>
            </section>
          ))}

          <section className="theme-card rounded-xl p-6 md:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-[var(--theme-ink)]">Ð›Ð¾Ð³Ð° Ð¸ Ð¸ÐºÐ¾Ð½Ð¸</h2>
              <p className="theme-muted mt-1 text-sm">ÐšÐ°Ñ‡Ð¸ PNG/WebP/SVG. Ð’ÑÑÐºÐ¾ Ð¿Ð¾Ð»Ðµ Ð¸Ð¼Ð° Ð¼Ð¸Ð½Ð¸ Ð¿Ñ€ÐµÐ³Ð»ÐµÐ´ Ð¾Ñ‚Ð´Ð¾Ð»Ñƒ.</p>
            </div>

            {LOGO_FIELDS.map(({ key, label, hint }) => {
              const url = String((settings as any)[key] || '');
              return (
                <div
                  key={key}
                  className="rounded-lg border border-[var(--theme-hairline)] bg-[var(--theme-inset)]/40 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--theme-ink)]">{label}</p>
                      <p className="theme-muted mt-1 text-xs leading-snug">{hint}</p>
                      {url ? (
                        <p className="theme-muted mt-2 break-all text-xs font-mono">{url}</p>
                      ) : (
                        <p className="theme-muted mt-2 text-xs italic">ÐÑÐ¼Ð° ÐºÐ°Ñ‡ÐµÐ½ Ñ„Ð°Ð¹Ð» â€” Ð¿Ð¾Ð»Ð·Ð²Ð° ÑÐµ Ñ€ÐµÐ·ÐµÑ€Ð²Ð½Ð° Ð¸ÐºÐ¾Ð½Ð°</p>
                      )}
                    </div>
                    <label className="theme-btn-secondary inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold">
                      ÐšÐ°Ñ‡Ð¸ Ñ„Ð°Ð¹Ð»
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          e.currentTarget.value = '';
                          if (!f) return;
                          try {
                            const nextUrl = await handleUpload(f);
                            setSettings({ ...settings, [key]: nextUrl || null } as any);
                            setToast({ message: 'âœ… ÐšÐ°Ñ‡ÐµÐ½Ð¾', type: 'success' });
                          } catch (err: any) {
                            setToast({ message: err?.message || 'Ð“Ñ€ÐµÑˆÐºÐ° Ð¿Ñ€Ð¸ ÐºÐ°Ñ‡Ð²Ð°Ð½Ðµ', type: 'error' });
                          }
                        }}
                      />
                    </label>
                  </div>

                  {url ? (
                    <div className="mt-3 flex items-center justify-center rounded-lg bg-black/5 p-3">
                      <Image
                        src={url}
                        alt={label}
                        width={320}
                        height={180}
                        className="h-auto max-h-28 w-auto object-contain"
                        unoptimized
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>
        </div>

        <aside className="hidden xl:block">
          <BrandingPreview settings={settings} />
        </aside>
      </div>

      <div className="mt-8 xl:hidden">
        <BrandingPreview settings={settings} />
      </div>
    </div>
  );
}
