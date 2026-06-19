import type { CSSProperties } from 'react';

export type HeaderTheme = {
  background: string;
  color: string;
  colorMuted: string;
  borderColor: string;
  pillActive: string;
  pillHover: string;
  pillSolid: string;
  mobilePanelBg: string;
  langSwitcherTheme: 'on-dark' | 'on-light';
};

const DEFAULT_THEME: HeaderTheme = {
  background: 'linear-gradient(to right, rgba(29, 78, 216, 0.85), rgba(2, 132, 199, 0.85))',
  color: '#ffffff',
  colorMuted: 'rgba(255, 255, 255, 0.85)',
  borderColor: 'rgba(255, 255, 255, 0.2)',
  pillActive: 'rgba(255, 255, 255, 0.2)',
  pillHover: 'rgba(255, 255, 255, 0.1)',
  pillSolid: 'rgba(255, 255, 255, 0.2)',
  mobilePanelBg: 'rgba(30, 58, 138, 0.95)',
  langSwitcherTheme: 'on-dark',
};

type Rgb = { r: number; g: number; b: number };

function parseHex(hex: string): Rgb | null {
  const t = hex.trim();
  const m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(t);
  if (m3) {
    return {
      r: parseInt(m3[1] + m3[1], 16),
      g: parseInt(m3[2] + m3[2], 16),
      b: parseInt(m3[3] + m3[3], 16),
    };
  }
  const m6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(t);
  if (!m6) return null;
  return {
    r: parseInt(m6[1], 16),
    g: parseInt(m6[2], 16),
    b: parseInt(m6[3], 16),
  };
}

function relativeLuminance({ r, g, b }: Rgb): number {
  const srgb = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function mixRgb(base: Rgb, target: Rgb, amount: number): Rgb {
  const t = Math.min(1, Math.max(0, amount));
  return {
    r: Math.round(base.r + (target.r - base.r) * t),
    g: Math.round(base.g + (target.g - base.g) * t),
    b: Math.round(base.b + (target.b - base.b) * t),
  };
}

function toRgba(rgb: Rgb, alpha: number): string {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function toHex(rgb: Rgb): string {
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`;
}

/** Pick white or dark slate text for readable contrast on the header background. */
export function resolveHeaderTheme(headerBackgroundColor?: string | null): HeaderTheme {
  const raw = headerBackgroundColor?.trim();
  if (!raw) return DEFAULT_THEME;

  const rgb = parseHex(raw);
  if (!rgb) return DEFAULT_THEME;

  const lum = relativeLuminance(rgb);
  const useLightText = lum < 0.45;
  const fg = useLightText ? '#ffffff' : '#0f172a';
  const fgMuted = useLightText ? 'rgba(255, 255, 255, 0.85)' : 'rgba(15, 23, 42, 0.75)';
  const gradientEnd = mixRgb(rgb, useLightText ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 }, 0.18);
  const mobileBase = mixRgb(rgb, { r: 0, g: 0, b: 0 }, useLightText ? 0.35 : 0.08);

  return {
    background: `linear-gradient(to right, ${toRgba(rgb, 0.92)}, ${toRgba(gradientEnd, 0.92)})`,
    color: fg,
    colorMuted: fgMuted,
    borderColor: useLightText ? 'rgba(255, 255, 255, 0.2)' : 'rgba(15, 23, 42, 0.12)',
    pillActive: useLightText ? 'rgba(255, 255, 255, 0.2)' : 'rgba(15, 23, 42, 0.1)',
    pillHover: useLightText ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.06)',
    pillSolid: useLightText ? 'rgba(255, 255, 255, 0.2)' : 'rgba(15, 23, 42, 0.08)',
    mobilePanelBg: toRgba(mobileBase, 0.96),
    langSwitcherTheme: useLightText ? 'on-dark' : 'on-light',
  };
}

export function headerSurfaceStyle(theme: HeaderTheme): CSSProperties {
  return {
    background: theme.background,
    color: theme.color,
  };
}

export function headerNavLinkStyle(theme: HeaderTheme, active: boolean): CSSProperties {
  return {
    color: active ? theme.color : theme.colorMuted,
    backgroundColor: active ? theme.pillActive : 'transparent',
  };
}

/** Normalise admin colour input to #rrggbb or null. */
export function normalizeHeaderColorInput(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const rgb = parseHex(v.startsWith('#') ? v : `#${v}`);
  return rgb ? toHex(rgb) : null;
}

export const DEFAULT_HEADER_COLOR = '#1d4ed8';
