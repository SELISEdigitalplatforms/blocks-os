import type { CSSProperties } from "react";

const DEFAULT_BRAND_COLOR = "#124091";

const parseHex = (hex: string): [number, number, number] | null => {
  const normalized = hex.replace("#", "").trim();
  if (!/^[0-9A-Fa-f]{6}$/.test(normalized)) return null;
  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ];
};

const toRgba = (rgb: [number, number, number], alpha: number) =>
  `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;

const lighten = (rgb: [number, number, number], amount: number): [number, number, number] => {
  return rgb.map((channel) => Math.min(255, Math.round(channel + (255 - channel) * amount))) as [
    number,
    number,
    number,
  ];
};

export const buildOidcBrandCssVars = (brandColor?: string | null): CSSProperties => {
  const hex = brandColor || DEFAULT_BRAND_COLOR;
  const rgb = parseHex(hex);
  if (!rgb) {
    return { "--accent": DEFAULT_BRAND_COLOR } as CSSProperties;
  }

  const accent2 = lighten(rgb, 0.15);
  const accent2Hex = `#${accent2.map((c) => c.toString(16).padStart(2, "0")).join("")}`;

  return {
    "--accent": hex,
    "--accent2": accent2Hex,
    "--accent-glow": toRgba(rgb, 0.35),
    "--accent-soft": toRgba(rgb, 0.1),
    "--accent-softer": toRgba(rgb, 0.06),
  } as CSSProperties;
};
