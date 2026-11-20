import { ColorMode, formatColorBadge, formatColorSpecLabel } from './colorUtils';
import paihoLogoUrl from '../assets/paiho-logo.png';

export type BackdropId = 'white' | 'concrete' | 'obsidian';

export interface StudioBackdropPreset {
  id: BackdropId;
  label: string;
  bgHex: string;
  cardBgHex: string;
  textHex: string;
  mutedHex: string;
  accentHex: string;
  borderHex: string;
  swatchHex: string;
}

export const STUDIO_BACKDROPS: Record<BackdropId, StudioBackdropPreset> = {
  white: {
    id: 'white',
    label: 'Pure White',
    bgHex: '#FFFFFF',
    cardBgHex: '#F9FAFB',
    textHex: '#111827',
    mutedHex: '#6B7280',
    accentHex: '#4F46E5',
    borderHex: '#E5E7EB',
    swatchHex: '#FFFFFF',
  },
  concrete: {
    id: 'concrete',
    label: 'Cool Concrete',
    bgHex: '#F4F5F7',
    cardBgHex: '#EAECEF',
    textHex: '#111827',
    mutedHex: '#4B5563',
    accentHex: '#4F46E5',
    borderHex: '#DCDFE6',
    swatchHex: '#ECEEF2',
  },
  obsidian: {
    id: 'obsidian',
    label: 'Obsidian',
    bgHex: '#14161A',
    cardBgHex: '#1C2026',
    textHex: '#F9FAFB',
    mutedHex: '#9CA3AF',
    accentHex: '#818CF8',
    borderHex: '#2A2F3A',
    swatchHex: '#14161A',
  },
};

export interface ShareSpecItem {
  partName: string;
  materialTitle?: string;
  materialDescription?: string;
  materialImageUrl?: string;
  hex: string;
  hasCustomColor: boolean;
  area: number;
}

export interface ColorDnaSlice {
  hex: string;
  area: number;
  ratio: number;
  percentage: number;
}

interface ComposeShareSheetOptions {
  baseImageUrl: string;
  backdropId?: BackdropId;
  modelName: string;
  specItems: ShareSpecItem[];
  signature: string;
  colorMode?: ColorMode;
}

interface ComposeMaterialSpecOptions {
  heroImageUrl: string;
  backdropId?: BackdropId;
  modelName: string;
  specItems: ShareSpecItem[];
  signature: string;
  colorMode?: ColorMode;
}

export const computeColorDna = (specItems: ShareSpecItem[]): ColorDnaSlice[] => {
  if (!specItems.length) return [];

  const colorItems = specItems.filter((item) => item.hasCustomColor);
  const source = colorItems.length > 0 ? colorItems : specItems;

  const grouped = new Map<string, number>();
  source.forEach((item) => {
    const key = item.hex.toUpperCase();
    const safeArea = item.area > 0 ? item.area : 0.001;
    grouped.set(key, (grouped.get(key) || 0) + safeArea);
  });

  const entries = Array.from(grouped.entries()).sort((a, b) => b[1] - a[1]);
  const totalArea = entries.reduce((sum, [, area]) => sum + area, 0);
  if (totalArea <= 0) return [];

  const raw = entries.map(([hex, area]) => {
    const ratio = area / totalArea;
    const exactPct = ratio * 100;
    const floored = Math.floor(exactPct);
    return {
      hex,
      area,
      ratio,
      floored,
      remainder: exactPct - floored,
    };
  });

  let remaining = 100 - raw.reduce((sum, item) => sum + item.floored, 0);
  const byRemainder = [...raw]
    .map((item, idx) => ({ idx, remainder: item.remainder }))
    .sort((a, b) => b.remainder - a.remainder);

  const percentages = raw.map((item) => item.floored);
  for (let i = 0; i < byRemainder.length && remaining > 0; i++) {
    percentages[byRemainder[i].idx] += 1;
    remaining -= 1;
  }

  // 極小佔比顏色仍保留至少 1% 可視識別
  raw.forEach((_, idx) => {
    if (percentages[idx] === 0) {
      const maxIdx = percentages.indexOf(Math.max(...percentages));
      if (percentages[maxIdx] > 1) {
        percentages[idx] = 1;
        percentages[maxIdx] -= 1;
      }
    }
  });

  return raw.map((item, idx) => ({
    hex: item.hex,
    area: item.area,
    ratio: item.ratio,
    percentage: percentages[idx],
  }));
};

const loadImageSafe = (src: string, crossOrigin = false): Promise<HTMLImageElement | null> =>
  new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    if (crossOrigin && !src.startsWith('data:') && !src.startsWith('/')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

const truncateCanvasText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string => {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}...`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}...`;
};

const drawWrappedText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  }

  const usedWordCount = lines.join(' ').split(/\s+/).filter(Boolean).length;
  if (usedWordCount < words.length && lines.length > 0) {
    lines[lines.length - 1] = truncateCanvasText(ctx, `${lines[lines.length - 1]}...`, maxWidth);
  }

  lines.forEach((line, idx) => {
    ctx.fillText(line, x, y + idx * lineHeight);
  });
};

const drawBrandLogo = (
  ctx: CanvasRenderingContext2D,
  logoImg: HTMLImageElement | null,
  x: number,
  centerY: number,
  targetHeight: number
): number => {
  if (!logoImg || logoImg.naturalWidth === 0 || logoImg.naturalHeight === 0) {
    return x;
  }

  const ratio = logoImg.naturalWidth / logoImg.naturalHeight;
  const drawW = Math.round(targetHeight * ratio);
  const drawH = targetHeight;
  const topY = Math.round(centerY - drawH / 2);

  ctx.drawImage(logoImg, x, topY, drawW, drawH);
  return x + drawW;
};

const drawProportionalColorBar = (
  ctx: CanvasRenderingContext2D,
  slices: ColorDnaSlice[],
  x: number,
  y: number,
  width: number,
  height: number,
  preset: StudioBackdropPreset
) => {
  if (slices.length === 0) {
    ctx.fillStyle = preset.borderHex;
    ctx.fillRect(x, y + Math.floor(height / 2) - 1, width, 2);
    return;
  }

  const gap = slices.length > 1 ? 3 : 0;
  const usableWidth = width - gap * (slices.length - 1);
  let cursorX = x;

  slices.forEach((slice, idx) => {
    const segW =
      idx === slices.length - 1
        ? x + width - cursorX
        : Math.max(8, Math.round(usableWidth * slice.ratio));

    ctx.fillStyle = slice.hex;
    ctx.fillRect(cursorX, y, segW, height);

    ctx.lineWidth = 1;
    ctx.strokeStyle =
      preset.id === 'obsidian' ? 'rgba(255,255,255,0.22)' : 'rgba(17,24,39,0.12)';
    ctx.strokeRect(cursorX + 0.5, y + 0.5, Math.max(1, segW - 1), height - 1);

    cursorX += segW + gap;
  });
};

const drawDraftingGrid = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  step = 40,
  majorEvery = 5,
  minorColor = 'rgba(17, 24, 39, 0.042)',
  majorColor = 'rgba(17, 24, 39, 0.075)'
) => {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();

  ctx.lineWidth = 1;

  for (let i = 0; i * step <= width; i++) {
    const gx = x + i * step + 0.5;
    ctx.strokeStyle = i % majorEvery === 0 ? majorColor : minorColor;
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, y + height);
    ctx.stroke();
  }

  for (let j = 0; j * step <= height; j++) {
    const gy = y + j * step + 0.5;
    ctx.strokeStyle = j % majorEvery === 0 ? majorColor : minorColor;
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + width, gy);
    ctx.stroke();
  }

  ctx.restore();
};

export const composeShareSheet = async ({
  baseImageUrl,
  backdropId = 'concrete',
  modelName,
  specItems,
  signature,
  colorMode = 'HEX',
}: ComposeShareSheetOptions): Promise<string> => {
  if (!baseImageUrl) return '';

  const preset = STUDIO_BACKDROPS[backdropId] || STUDIO_BACKDROPS.concrete;
  const [img, logoImg] = await Promise.all([
    loadImageSafe(baseImageUrl),
    loadImageSafe(paihoLogoUrl),
  ]);
  if (!img) return baseImageUrl;

  const width = 2560;
  const baseHeight =
    img.naturalWidth > 0 && img.naturalHeight > 0
      ? Math.round((img.naturalHeight / img.naturalWidth) * width)
      : 1440;
  const hasCustomColors = specItems.some((item) => item.hasCustomColor);
  const slices = hasCustomColors ? computeColorDna(specItems) : [];
  const hasDna = slices.length > 0;
  const footerHeight = hasDna ? 228 : 168;
  const totalHeight = baseHeight + footerHeight;
  const padX = 72;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return baseImageUrl;

  // 1. 填滿淡灰色攝影棚底色並鋪上設計稿細格紋，再合成透明背景五視角渲染圖
  ctx.fillStyle = preset.bgHex;
  ctx.fillRect(0, 0, width, totalHeight);
  drawDraftingGrid(ctx, 0, 0, width, totalHeight, 40, 5, 'rgba(17, 24, 39, 0.035)', 'rgba(17, 24, 39, 0.065)');
  ctx.drawImage(img, 0, 0, width, baseHeight);

  const barY = baseHeight + (hasDna ? 12 : 10);
  const barWidth = width - padX * 2;

  // 2. 依 3D 表面積比例分布的 Color DNA 長條
  drawProportionalColorBar(ctx, slices, padX, barY, barWidth, 14, preset);

  // 3. 左下角：PAIHO 公司 LOGO
  const footerCenterY = baseHeight + (hasDna ? 124 : 96);
  const headerTextY = baseHeight + (hasDna ? 82 : 58);
  const metaTextY = baseHeight + (hasDna ? 168 : 134);
  const logoRight = drawBrandLogo(ctx, logoImg, padX, footerCenterY, 45);

  // 4. 中間：僅於有客製化調整顏色時顯示 Color DNA 比例百分比色票摘要
  if (hasDna) {
    const dnaStartX = logoRight > padX ? logoRight + 46 : padX;
    const dnaMaxRight = width - padX - 540;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    ctx.fillStyle = preset.accentHex;
    ctx.font = '800 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const dnaTitle =
      colorMode === 'HEX'
        ? `${modelName.toUpperCase()}  ·  COLOR DNA DISTRIBUTION`
        : `${modelName.toUpperCase()}  ·  COLOR DNA DISTRIBUTION (${colorMode})`;
    ctx.fillText(dnaTitle, dnaStartX, headerTextY);

    const isHexMode = colorMode === 'HEX';
    const chipWidth = isHexMode ? 228 : 308;
    const chipRowHeight = 42;
    const maxCols = Math.max(1, Math.floor((dnaMaxRight - dnaStartX) / chipWidth));
    const displaySlices = slices.slice(0, maxCols * 2);

    displaySlices.forEach((slice, idx) => {
      const col = idx % maxCols;
      const row = Math.floor(idx / maxCols);
      const chipX = dnaStartX + col * chipWidth;
      const chipY = footerCenterY + row * chipRowHeight;

      ctx.beginPath();
      ctx.arc(chipX + 10, chipY, 10, 0, Math.PI * 2);
      ctx.fillStyle = slice.hex;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle =
        backdropId === 'obsidian' ? 'rgba(255,255,255,0.35)' : 'rgba(17,24,39,0.22)';
      ctx.stroke();

      const codeText = formatColorBadge(slice.hex, colorMode);
      ctx.fillStyle = preset.textHex;
      ctx.font = isHexMode
        ? '800 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        : '800 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(codeText, chipX + 28, chipY);

      const codeW = ctx.measureText(codeText).width;
      ctx.fillStyle = preset.accentHex;
      ctx.font = isHexMode
        ? '800 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        : '800 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`${slice.percentage}%`, chipX + 36 + codeW, chipY);
    });

    if (slices.length > displaySlices.length) {
      ctx.fillStyle = preset.mutedHex;
      ctx.font = '700 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`+${slices.length - displaySlices.length} MORE COLORS`, dnaStartX, baseHeight + 202);
    }
  }

  // 5. 右下角：設計師自訂署名
  const rightX = width - padX;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';

  const cleanSig = signature.trim();
  ctx.fillStyle = preset.mutedHex;
  ctx.font = '800 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(cleanSig ? 'DESIGNER' : 'DIGITAL DESIGN WORKSPACE', rightX, headerTextY);

  ctx.fillStyle = preset.textHex;
  ctx.font = '900 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const sigDisplay = truncateCanvasText(ctx, (cleanSig || 'PAIHO-U STUDIO').toUpperCase(), 500);
  ctx.fillText(sigDisplay, rightX, footerCenterY);

  const dateLabel = new Date().toISOString().slice(0, 10);
  ctx.fillStyle = preset.mutedHex;
  ctx.font = '600 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`PAIHO-U  ·  ${dateLabel}`, rightX, metaTextY);

  return canvas.toDataURL('image/png', 0.92);
};

export const composeMaterialSpecSheet = async ({
  heroImageUrl,
  backdropId = 'concrete',
  modelName,
  specItems,
  signature,
  colorMode = 'HEX',
}: ComposeMaterialSpecOptions): Promise<string> => {
  const preset = STUDIO_BACKDROPS[backdropId] || STUDIO_BACKDROPS.concrete;

  const sortedItems = [...specItems].sort((a, b) => b.area - a.area);
  const slices = computeColorDna(sortedItems);

  const uniqueThumbUrls = Array.from(
    new Set(sortedItems.map((i) => i.materialImageUrl).filter(Boolean) as string[])
  );

  const [logoImg, heroImg, ...thumbImages] = await Promise.all([
    loadImageSafe(paihoLogoUrl),
    loadImageSafe(heroImageUrl),
    ...uniqueThumbUrls.map((url) => loadImageSafe(url, true)),
  ]);

  const thumbMap = new Map<string, HTMLImageElement | null>();
  uniqueThumbUrls.forEach((url, idx) => {
    thumbMap.set(url, thumbImages[idx]);
  });

  const width = 2480;
  const padX = 96;
  const contentWidth = width - padX * 2;
  const cols = 2;
  const cardGap = 44;
  const cardW = Math.floor((contentWidth - cardGap) / cols);
  const cardH = 244;
  const rows = Math.max(1, Math.ceil(sortedItems.length / cols));

  const headerBottomY = 200;
  const heroSectionY = 244;
  const heroSectionH = 520;
  const scheduleTitleY = heroSectionY + heroSectionH + 74;
  const cardsStartY = scheduleTitleY + 46;
  const cardsTotalH = sortedItems.length > 0 ? rows * cardH + (rows - 1) * 32 : 200;
  const footerH = 120;
  const totalHeight = cardsStartY + cardsTotalH + footerH;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = preset.bgHex;
  ctx.fillRect(0, 0, width, totalHeight);
  drawDraftingGrid(ctx, 0, 0, width, totalHeight, 40, 5, 'rgba(17, 24, 39, 0.028)', 'rgba(17, 24, 39, 0.052)');

  // 1. 頁首：PAIHO Logo + 標題 + 鞋型署名
  ctx.textBaseline = 'middle';
  const logoRight = drawBrandLogo(ctx, logoImg, padX, 118, 46);
  const titleX = logoRight > padX ? logoRight + 38 : padX;

  ctx.textAlign = 'left';
  ctx.fillStyle = preset.textHex;
  ctx.font = '900 34px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('MATERIAL & COLOR SPECIFICATION', titleX, 102);

  ctx.fillStyle = preset.accentHex;
  ctx.font = '800 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('PAIHO-U DIGITAL DESIGN WORKSPACE  ·  COMPLETE BOM SCHEDULE', titleX, 142);

  const rightX = width - padX;
  ctx.textAlign = 'right';
  ctx.fillStyle = preset.textHex;
  ctx.font = '900 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(modelName.toUpperCase(), rightX, 102);

  const dateLabel = new Date().toISOString().slice(0, 10);
  const cleanSig = signature.trim().toUpperCase() || 'PAIHO-U STUDIO';
  ctx.fillStyle = preset.mutedHex;
  ctx.font = '700 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${cleanSig}  ·  ${dateLabel}`, rightX, 142);

  ctx.fillStyle = preset.borderHex;
  ctx.fillRect(padX, headerBottomY, contentWidth, 2);

  // 2. 主視覺與 Color DNA 總覽區
  const heroCardW = 940;
  ctx.fillStyle = preset.cardBgHex;
  ctx.fillRect(padX, heroSectionY, heroCardW, heroSectionH);
  ctx.strokeStyle = preset.borderHex;
  ctx.lineWidth = 2;
  ctx.strokeRect(padX, heroSectionY, heroCardW, heroSectionH);

  if (heroImg) {
    const padHero = 20;
    const availW = heroCardW - padHero * 2;
    const availH = heroSectionH - padHero * 2;
    const scale = Math.min(availW / heroImg.naturalWidth, availH / heroImg.naturalHeight);
    const drawW = heroImg.naturalWidth * scale;
    const drawH = heroImg.naturalHeight * scale;
    ctx.drawImage(
      heroImg,
      padX + (heroCardW - drawW) / 2,
      heroSectionY + (heroSectionH - drawH) / 2,
      drawW,
      drawH
    );
  }

  const dnaPanelX = padX + heroCardW + 64;
  const dnaPanelW = width - padX - dnaPanelX;

  ctx.textAlign = 'left';
  ctx.fillStyle = preset.accentHex;
  ctx.font = '800 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('COLOR DNA  ·  3D SURFACE AREA DISTRIBUTION', dnaPanelX, heroSectionY + 24);

  drawProportionalColorBar(ctx, slices, dnaPanelX, heroSectionY + 58, dnaPanelW, 24, preset);

  if (slices.length === 0) {
    ctx.fillStyle = preset.mutedHex;
    ctx.font = '600 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('No customized color adjustments recorded yet.', dnaPanelX, heroSectionY + 140);
  } else {
    const maxList = slices.slice(0, 7);
    const rowStep = 50;
    maxList.forEach((slice, idx) => {
      const ry = heroSectionY + 130 + idx * rowStep;

      ctx.beginPath();
      ctx.arc(dnaPanelX + 12, ry, 12, 0, Math.PI * 2);
      ctx.fillStyle = slice.hex;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle =
        backdropId === 'obsidian' ? 'rgba(255,255,255,0.35)' : 'rgba(17,24,39,0.22)';
      ctx.stroke();

      const { primary, secondary } = formatColorSpecLabel(slice.hex, colorMode);

      ctx.fillStyle = preset.textHex;
      ctx.font = '800 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(primary, dnaPanelX + 38, ry);
      const primaryW = ctx.measureText(primary).width;

      ctx.fillStyle = preset.mutedHex;
      ctx.font = '600 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(secondary, Math.max(dnaPanelX + 172, dnaPanelX + 54 + primaryW), ry);

      // 迷你比例條
      const miniBarX = dnaPanelX + 460;
      const miniBarW = dnaPanelW - 570;
      if (miniBarW > 60) {
        ctx.fillStyle = preset.borderHex;
        ctx.fillRect(miniBarX, ry - 4, miniBarW, 8);
        ctx.fillStyle = slice.hex;
        ctx.fillRect(miniBarX, ry - 4, Math.max(6, Math.round(miniBarW * slice.ratio)), 8);
      }

      ctx.textAlign = 'right';
      ctx.fillStyle = preset.accentHex;
      ctx.font = '900 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`${slice.percentage}%`, dnaPanelX + dnaPanelW, ry);
      ctx.textAlign = 'left';
    });
  }

  ctx.fillStyle = preset.mutedHex;
  ctx.font = '700 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(
    `CUSTOMIZED PARTS: ${sortedItems.length}   ·   ACTIVE PALETTE COLORS: ${slices.length}`,
    dnaPanelX,
    heroSectionY + heroSectionH - 14
  );

  // 3. 完整部位材料圖文明細表
  ctx.fillStyle = preset.textHex;
  ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`COMPLETE MATERIAL & COLOR SCHEDULE (${sortedItems.length} PARTS)`, padX, scheduleTitleY);

  if (sortedItems.length === 0) {
    ctx.fillStyle = preset.cardBgHex;
    ctx.fillRect(padX, cardsStartY, contentWidth, 160);
    ctx.strokeStyle = preset.borderHex;
    ctx.strokeRect(padX, cardsStartY, contentWidth, 160);

    ctx.fillStyle = preset.mutedHex;
    ctx.font = '600 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      'Select any part on the 3D sneaker to apply PAIHO materials or custom colors before exporting.',
      width / 2,
      cardsStartY + 80
    );
    ctx.textAlign = 'left';
  } else {
    sortedItems.forEach((item, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cx = padX + col * (cardW + cardGap);
      const cy = cardsStartY + row * (cardH + 32);

      ctx.fillStyle = preset.cardBgHex;
      ctx.fillRect(cx, cy, cardW, cardH);
      ctx.strokeStyle = preset.borderHex;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx, cy, cardW, cardH);

      const thumbSize = 180;
      const thumbX = cx + 32;
      const thumbY = cy + (cardH - thumbSize) / 2;

      const thumbImg = item.materialImageUrl ? thumbMap.get(item.materialImageUrl) : null;
      if (thumbImg && thumbImg.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(thumbX, thumbY, thumbSize, thumbSize);
        ctx.clip();

        const coverScale = Math.max(thumbSize / thumbImg.naturalWidth, thumbSize / thumbImg.naturalHeight);
        const dw = thumbImg.naturalWidth * coverScale;
        const dh = thumbImg.naturalHeight * coverScale;
        ctx.drawImage(
          thumbImg,
          thumbX + (thumbSize - dw) / 2,
          thumbY + (thumbSize - dh) / 2,
          dw,
          dh
        );
        ctx.restore();

        ctx.strokeStyle = preset.borderHex;
        ctx.lineWidth = 2;
        ctx.strokeRect(thumbX, thumbY, thumbSize, thumbSize);

        // 右下角染色標記圓點
        ctx.beginPath();
        ctx.arc(thumbX + thumbSize - 22, thumbY + thumbSize - 22, 16, 0, Math.PI * 2);
        ctx.fillStyle = item.hex;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();
      } else {
        ctx.fillStyle = item.hex;
        ctx.fillRect(thumbX, thumbY, thumbSize, thumbSize);
        ctx.strokeStyle = preset.borderHex;
        ctx.lineWidth = 2;
        ctx.strokeRect(thumbX, thumbY, thumbSize, thumbSize);
      }

      const infoX = thumbX + thumbSize + 34;
      const infoW = cx + cardW - infoX - 32;

      // 部位名稱
      ctx.textAlign = 'left';
      ctx.fillStyle = preset.textHex;
      ctx.font = '900 25px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(truncateCanvasText(ctx, item.partName.toUpperCase(), infoW), infoX, cy + 44);

      // 材質名稱
      const matLabel = item.materialTitle
        ? item.materialTitle.toUpperCase()
        : 'CUSTOM COLOR FINISH';
      ctx.fillStyle = preset.accentHex;
      ctx.font = '800 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(truncateCanvasText(ctx, matLabel, infoW), infoX, cy + 82);

      // 材質說明文字
      const desc =
        item.materialDescription ||
        `Bespoke solid colorway treatment calibrated to exact ${colorMode} & studio lighting specification.`;
      ctx.fillStyle = preset.mutedHex;
      ctx.font = '500 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      drawWrappedText(ctx, desc, infoX, cy + 120, infoW, 25, 3);

      // 色碼資訊（僅顯示分享視窗當前選擇的色彩模式）
      const { primary: cardPrimary } = formatColorSpecLabel(item.hex, colorMode);
      ctx.fillStyle = preset.textHex;
      ctx.font = '800 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(cardPrimary, infoX, cy + cardH - 30);
    });
  }

  // 4. 頁尾
  const footerY = totalHeight - 52;
  ctx.fillStyle = preset.borderHex;
  ctx.fillRect(padX, footerY - 34, contentWidth, 2);

  ctx.textAlign = 'left';
  ctx.fillStyle = preset.mutedHex;
  ctx.font = '700 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('PAIHO-U DIGITAL DESIGN WORKSPACE  ·  COMPLETE MATERIAL SPECIFICATION', padX, footerY);

  ctx.textAlign = 'right';
  ctx.fillText('WWW.PAIHO.COM', width - padX, footerY);

  return canvas.toDataURL('image/png', 0.92);
};


