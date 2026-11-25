export type ColorMode = 'HEX' | 'RGB' | 'HSL' | 'LAB';

export const COLOR_MODES: ColorMode[] = ['HEX', 'RGB', 'HSL', 'LAB'];

export const hsvToRgb = (h: number, s: number, v: number) => {
  s /= 100;
  v /= 100;
  const i = Math.floor(h / 60);
  const f = h / 60 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0;
  let g = 0;
  let b = 0;
  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

export const rgbToHex = (r: number, g: number, b: number) => {
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
};

export const parseHexInput = (
  raw: string
): { hex: string; isShort: boolean; hasHash: boolean } | null => {
  const trimmed = raw.trim();
  const match6 = /^(#?)([0-9A-Fa-f]{6})$/.exec(trimmed);
  if (match6) {
    return {
      hex: `#${match6[2].toUpperCase()}`,
      isShort: false,
      hasHash: match6[1] === '#',
    };
  }
  const match3 = /^(#?)([0-9A-Fa-f]{3})$/.exec(trimmed);
  if (match3) {
    const [r, g, b] = match3[2].toUpperCase().split('');
    return {
      hex: `#${r}${r}${g}${g}${b}${b}`,
      isShort: true,
      hasHash: match3[1] === '#',
    };
  }
  return null;
};

export const hexToRgb = (hex: string) => {
  const parsed = parseHexInput(hex);
  const fullHex = parsed ? parsed.hex : hex;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 255, g: 255, b: 255 };
};

export const rgbToHsv = (r: number, g: number, b: number) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const v = max;
  const d = max - min;
  const s = max === 0 ? 0 : d / max;
  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, v: v * 100 };
};

const rgbToXyz = (r: number, g: number, b: number) => {
  let [R, G, B] = [r / 255, g / 255, b / 255].map((v) =>
    v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92
  );
  R *= 100;
  G *= 100;
  B *= 100;
  return [
    R * 0.4124 + G * 0.3576 + B * 0.1805,
    R * 0.2126 + G * 0.7152 + B * 0.0722,
    R * 0.0193 + G * 0.1192 + B * 0.9505,
  ];
};

const xyzToLab = (x: number, y: number, z: number) => {
  const [X, Y, Z] = [x / 95.047, y / 100.0, z / 108.883].map((v) =>
    v > 0.008856 ? Math.pow(v, 1 / 3) : 7.787 * v + 16 / 116
  );
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
};

export const rgbToLab = (r: number, g: number, b: number) => {
  const [x, y, z] = rgbToXyz(r, g, b);
  const [L, A, B] = xyzToLab(x, y, z);
  return { l: Math.round(L), a: Math.round(A), b: Math.round(B) };
};

const labToXyz = (l: number, a: number, b: number) => {
  let y = (l + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;
  [x, y, z] = [x, y, z].map((v) =>
    Math.pow(v, 3) > 0.008856 ? Math.pow(v, 3) : (v - 16 / 116) / 7.787
  );
  return [x * 95.047, y * 100.0, z * 108.883];
};

const xyzToRgb = (x: number, y: number, z: number) => {
  const [X, Y, Z] = [x / 100, y / 100, z / 100];
  let r = X * 3.2404542 + Y * -1.5371385 + Z * -0.4985314;
  let g = X * -0.969266 + Y * 1.8760108 + Z * 0.041556;
  let b = X * 0.0556434 + Y * -0.2040259 + Z * 1.0572252;
  [r, g, b] = [r, g, b].map((v) =>
    v > 0.0031308 ? 1.055 * Math.pow(v, 1 / 2.4) - 0.055 : 12.92 * v
  );
  return {
    r: Math.max(0, Math.min(255, Math.round(r * 255))),
    g: Math.max(0, Math.min(255, Math.round(g * 255))),
    b: Math.max(0, Math.min(255, Math.round(b * 255))),
  };
};

export const labToRgb = (l: number, a: number, b: number) => {
  const [x, y, z] = labToXyz(l, a, b);
  return xyzToRgb(x, y, z);
};

export const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

export const hslToRgb = (h: number, s: number, l: number) => {
  let r: number;
  let g: number;
  let b: number;
  h /= 360;
  s /= 100;
  l /= 100;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

export const formatColorValue = (hexString: string, mode: ColorMode): string => {
  const rgb = hexToRgb(hexString);
  if (mode === 'HEX') return hexString.toUpperCase();
  if (mode === 'RGB') return `${rgb.r}, ${rgb.g}, ${rgb.b}`;
  if (mode === 'HSL') {
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return `${hsl.h}, ${hsl.s}%, ${hsl.l}%`;
  }
  const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
  return `${lab.l}, ${lab.a}, ${lab.b}`;
};

export const formatColorBadge = (hexString: string, mode: ColorMode): string => {
  const rgb = hexToRgb(hexString);
  if (mode === 'HEX') return hexString.toUpperCase();
  if (mode === 'RGB') return `RGB ${rgb.r},${rgb.g},${rgb.b}`;
  if (mode === 'HSL') {
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return `HSL ${hsl.h},${hsl.s}%,${hsl.l}%`;
  }
  const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
  return `LAB ${lab.l},${lab.a},${lab.b}`;
};

export const formatColorSpecLabel = (
  hexString: string,
  mode: ColorMode
): { primary: string; secondary: string } => {
  const upperHex = hexString.toUpperCase();
  const rgb = hexToRgb(upperHex);
  const rgbText = `RGB(${rgb.r}, ${rgb.g}, ${rgb.b})`;

  if (mode === 'HEX') {
    return { primary: upperHex, secondary: rgbText };
  }
  if (mode === 'RGB') {
    return { primary: rgbText, secondary: upperHex };
  }
  if (mode === 'HSL') {
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    return { primary: `HSL(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`, secondary: upperHex };
  }
  const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
  return { primary: `LAB(${lab.l}, ${lab.a}, ${lab.b})`, secondary: upperHex };
};
