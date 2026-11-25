import { ColorMode, formatColorBadge, formatColorSpecLabel } from './colorUtils';
import paihoLogoUrl from '../assets/paiho-logo.png';

const STUDIO_BACKDROP = {
  bgHex: '#F4F5F7',
  cardBgHex: '#EAECEF',
  textHex: '#111827',
  mutedHex: '#4B5563',
  accentHex: '#4F46E5',
  borderHex: '#DCDFE6',
} as const;

type StudioBackdropPreset = typeof STUDIO_BACKDROP;

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
  modelName: string;
  specItems: ShareSpecItem[];
  signature: string;
  colorMode?: ColorMode;
}

interface ComposeMaterialSpecOptions {
  heroImageUrl: string;
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
    ctx.strokeStyle = 'rgba(17,24,39,0.12)';
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
  modelName,
  specItems,
  signature,
  colorMode = 'HEX',
}: ComposeShareSheetOptions): Promise<string> => {
  if (!baseImageUrl) return '';

  const preset = STUDIO_BACKDROP;
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
  const padX = 72;

  const logoDrawH = 34;
  const estimatedLogoW =
    logoImg && logoImg.naturalWidth > 0 && logoImg.naturalHeight > 0
      ? Math.round(logoDrawH * (logoImg.naturalWidth / logoImg.naturalHeight))
      : 0;
  const dnaStartX = estimatedLogoW > 0 ? padX + estimatedLogoW + 58 : padX;
  const dnaMaxRight = width - padX - 480;
  const isHexMode = colorMode === 'HEX';
  const chipWidth = isHexMode ? 236 : 316;
  const chipRowHeight = 40;
  const maxCols = Math.max(1, Math.floor((dnaMaxRight - dnaStartX) / chipWidth));
  const dnaRowCount = hasDna ? Math.ceil(slices.length / maxCols) : 0;

  const footerHeight = !hasDna ? 152 : 144 + dnaRowCount * chipRowHeight;
  const totalHeight = baseHeight + footerHeight;

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

  // 2. 依 3D 表面積比例分布的 Colorway 長條
  drawProportionalColorBar(ctx, slices, padX, barY, barWidth, 12, preset);

  // 3. 左下角：PAIHO 公司 LOGO（與配色列及右側署名水平置中對齊）
  const headerTextY = !hasDna ? baseHeight + 54 : dnaRowCount >= 2 ? baseHeight + 70 : baseHeight + 66;
  const footerCenterY = !hasDna ? baseHeight + 88 : dnaRowCount >= 2 ? baseHeight + 114 : baseHeight + 108;
  const metaTextY = !hasDna ? baseHeight + 124 : dnaRowCount >= 2 ? baseHeight + 158 : baseHeight + 148;
  const logoCenterY = !hasDna
    ? footerCenterY
    : dnaRowCount === 1
      ? footerCenterY
      : dnaRowCount === 2
        ? baseHeight + 122
        : baseHeight + 24 + (footerHeight - 24) / 2;
  drawBrandLogo(ctx, logoImg, padX, logoCenterY, logoDrawH);

  // 4. 中間：僅於有客製化調整顏色時顯示 Colorway Palette 摘要
  if (hasDna) {
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    ctx.fillStyle = preset.accentHex;
    ctx.font = '800 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const dnaTitle =
      colorMode === 'HEX'
        ? `${modelName.toUpperCase()}  ·  COLORWAY PALETTE`
        : `${modelName.toUpperCase()}  ·  COLORWAY PALETTE (${colorMode})`;
    ctx.fillText(dnaTitle, dnaStartX, headerTextY);

    slices.forEach((slice, idx) => {
      const col = idx % maxCols;
      const row = Math.floor(idx / maxCols);
      const chipX = dnaStartX + col * chipWidth;
      const chipY = footerCenterY + row * chipRowHeight;

      ctx.beginPath();
      ctx.arc(chipX + 10, chipY, 9.5, 0, Math.PI * 2);
      ctx.fillStyle = slice.hex;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(17,24,39,0.22)';
      ctx.stroke();

      const codeText = formatColorBadge(slice.hex, colorMode);
      ctx.fillStyle = preset.textHex;
      ctx.font = isHexMode
        ? '700 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        : '700 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(codeText, chipX + 28, chipY);

      const codeW = ctx.measureText(codeText).width;
      ctx.fillStyle = preset.accentHex;
      ctx.font = isHexMode
        ? '900 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        : '900 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`${slice.percentage}%`, chipX + 40 + codeW, chipY);
    });
  }

  // 5. 右下角：設計師自訂署名（字級協調縮小，不搶走品牌 LOGO 重心）
  const rightX = width - padX;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';

  const cleanSig = signature.trim();
  ctx.fillStyle = preset.mutedHex;
  ctx.font = '800 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(cleanSig ? 'DESIGNER' : 'DIGITAL DESIGN WORKSPACE', rightX, headerTextY);

  ctx.fillStyle = preset.textHex;
  ctx.font = '900 29px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const sigDisplay = truncateCanvasText(ctx, (cleanSig || 'PAIHO-U STUDIO').toUpperCase(), 460);
  ctx.fillText(sigDisplay, rightX, footerCenterY);

  const dateLabel = new Date().toISOString().slice(0, 10);
  ctx.fillStyle = preset.mutedHex;
  ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`PAIHO-U  ·  ${dateLabel}`, rightX, metaTextY);

  return canvas.toDataURL('image/png', 0.92);
};

export const composeMaterialSpecSheet = async ({
  heroImageUrl,
  modelName,
  specItems,
  signature,
  colorMode = 'HEX',
}: ComposeMaterialSpecOptions): Promise<string> => {
  const preset = STUDIO_BACKDROP;

  const sortedItems = [...specItems].sort((a, b) => b.area - a.area);
  const hasCustomColors = sortedItems.some((item) => item.hasCustomColor);
  const slices = hasCustomColors ? computeColorDna(sortedItems) : [];

  // 規格表上方對應各顏色的部位列表（包含純改色與貼圖染色的部位）
  const partsByHex = new Map<string, string[]>();
  sortedItems.forEach((item) => {
    if (!item.hasCustomColor) return;
    const key = item.hex.toUpperCase();
    const list = partsByHex.get(key) || [];
    if (!list.includes(item.partName)) {
      list.push(item.partName);
    }
    partsByHex.set(key, list);
  });

  // 規格表下方明細僅列出有套用／修改貼圖材質的部位
  const materialItems = sortedItems.filter((item) =>
    Boolean(item.materialImageUrl || item.materialTitle)
  );

  const uniqueThumbUrls = Array.from(
    new Set(materialItems.map((i) => i.materialImageUrl).filter(Boolean) as string[])
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
  const cardH = 224;
  const cardRowGap = 28;
  const rows = Math.max(1, Math.ceil(materialItems.length / cols));

  const useTwoPaletteCols = slices.length > 6;
  const paletteRowsPerCol = useTwoPaletteCols ? Math.ceil(slices.length / 2) : slices.length;
  const paletteRowStep = useTwoPaletteCols
    ? paletteRowsPerCol <= 4
      ? 58
      : paletteRowsPerCol === 5
        ? 48
        : paletteRowsPerCol === 6
          ? 44
          : 42
    : slices.length <= 4
      ? 58
      : slices.length === 5
        ? 48
        : 44;
  const paletteListOffset = (useTwoPaletteCols ? paletteRowsPerCol <= 4 : slices.length <= 4) ? 120 : 104;

  const headerBottomY = 160;
  const heroSectionY = 200;
  const heroSectionH =
    slices.length === 0
      ? 468
      : Math.max(468, paletteListOffset + (paletteRowsPerCol - 1) * paletteRowStep + 80);
  const scheduleTitleY = heroSectionY + heroSectionH + 62;
  const cardsStartY = scheduleTitleY + 40;
  const cardsTotalH = materialItems.length > 0 ? rows * cardH + (rows - 1) * cardRowGap : 148;
  const footerH = 92;
  const totalHeight = cardsStartY + cardsTotalH + footerH;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = preset.bgHex;
  ctx.fillRect(0, 0, width, totalHeight);
  drawDraftingGrid(ctx, 0, 0, width, totalHeight, 40, 5, 'rgba(17, 24, 39, 0.028)', 'rgba(17, 24, 39, 0.052)');

  // 1. 頁首：PAIHO Logo（縮小 25%）+ 標題 + 鞋型署名（字級比例對齊）
  ctx.textBaseline = 'middle';
  const logoRight = drawBrandLogo(ctx, logoImg, padX, 94, 34);
  const titleX = logoRight > padX ? logoRight + 28 : padX;

  ctx.textAlign = 'left';
  ctx.fillStyle = preset.textHex;
  ctx.font = '900 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('MATERIAL & COLOR SPECIFICATION', titleX, 80);

  ctx.fillStyle = preset.accentHex;
  ctx.font = '800 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('PAIHO-U DIGITAL DESIGN WORKSPACE', titleX, 114);

  const rightX = width - padX;
  ctx.textAlign = 'right';
  ctx.fillStyle = preset.textHex;
  ctx.font = '900 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(modelName.toUpperCase(), rightX, 80);

  const dateLabel = new Date().toISOString().slice(0, 10);
  const cleanSig = signature.trim().toUpperCase() || 'PAIHO-U STUDIO';
  ctx.fillStyle = preset.mutedHex;
  ctx.font = '700 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`${cleanSig}  ·  ${dateLabel}`, rightX, 114);

  ctx.fillStyle = preset.borderHex;
  ctx.fillRect(padX, headerBottomY, contentWidth, 2);

  // 2. 上半部：左側 3D 主視覺（無格線灰框）+ 右側配色與應用材質部位總覽
  const heroCardW = 880;
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
  ctx.font = '800 19px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('COLORWAY PALETTE  ·  3D SURFACE AREA', dnaPanelX, heroSectionY + 16);

  drawProportionalColorBar(ctx, slices, dnaPanelX, heroSectionY + 46, dnaPanelW, 18, preset);

  if (slices.length === 0) {
    ctx.fillStyle = preset.mutedHex;
    ctx.font = '600 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('No custom colorway adjustments specified.', dnaPanelX, heroSectionY + 122);
  } else {
    const listStartY = heroSectionY + paletteListOffset;
    const partLabelColor = '#374151';

    if (useTwoPaletteCols) {
      const paletteColGap = 56;
      const paletteColW = Math.floor((dnaPanelW - paletteColGap) / 2);
      const dividerX = dnaPanelX + paletteColW + Math.floor(paletteColGap / 2);

      ctx.fillStyle = preset.borderHex;
      ctx.fillRect(
        dividerX,
        listStartY - 14,
        1.5,
        (paletteRowsPerCol - 1) * paletteRowStep + 28
      );

      ctx.font = '800 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const maxCodeW = slices.reduce(
        (max, slice) => Math.max(max, ctx.measureText(formatColorBadge(slice.hex, colorMode)).width),
        0
      );

      slices.forEach((slice, idx) => {
        const col = Math.floor(idx / paletteRowsPerCol);
        const row = idx % paletteRowsPerCol;
        const colX = dnaPanelX + col * (paletteColW + paletteColGap);
        const ry = listStartY + row * paletteRowStep;
        const partsX = colX + 30 + Math.ceil(maxCodeW) + 22;
        const partsMaxW = Math.max(80, colX + paletteColW - partsX - 72);

        ctx.beginPath();
        ctx.arc(colX + 9.5, ry, 9.5, 0, Math.PI * 2);
        ctx.fillStyle = slice.hex;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(17,24,39,0.22)';
        ctx.stroke();

        const codeText = formatColorBadge(slice.hex, colorMode);
        ctx.fillStyle = preset.textHex;
        ctx.font = '800 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(codeText, colX + 30, ry);

        const partList = partsByHex.get(slice.hex.toUpperCase()) || [];
        if (partList.length > 0) {
          ctx.fillStyle = partLabelColor;
          ctx.font = '700 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText(truncateCanvasText(ctx, partList.join('  ·  '), partsMaxW), partsX, ry);
        }

        ctx.textAlign = 'right';
        ctx.fillStyle = preset.accentHex;
        ctx.font = '900 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`${slice.percentage}%`, colX + paletteColW, ry);
        ctx.textAlign = 'left';
      });
    } else {
      ctx.font = '800 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      const maxCodeW = slices.reduce(
        (max, slice) => Math.max(max, ctx.measureText(formatColorBadge(slice.hex, colorMode)).width),
        0
      );
      const partsX = dnaPanelX + 34 + Math.ceil(maxCodeW) + 32;
      const partsMaxW = Math.max(120, dnaPanelX + dnaPanelW - partsX - 88);

      slices.forEach((slice, idx) => {
        const ry = listStartY + idx * paletteRowStep;

        ctx.beginPath();
        ctx.arc(dnaPanelX + 10.5, ry, 10.5, 0, Math.PI * 2);
        ctx.fillStyle = slice.hex;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(17,24,39,0.22)';
        ctx.stroke();

        const codeText = formatColorBadge(slice.hex, colorMode);
        ctx.fillStyle = preset.textHex;
        ctx.font = '800 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(codeText, dnaPanelX + 34, ry);

        const partList = partsByHex.get(slice.hex.toUpperCase()) || [];
        if (partList.length > 0) {
          ctx.fillStyle = partLabelColor;
          ctx.font = '700 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText(truncateCanvasText(ctx, partList.join('  ·  '), partsMaxW), partsX, ry);
        }

        ctx.textAlign = 'right';
        ctx.fillStyle = preset.accentHex;
        ctx.font = '900 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`${slice.percentage}%`, dnaPanelX + dnaPanelW, ry);
        ctx.textAlign = 'left';
      });
    }
  }

  // 上方區塊底部：標示已配置材料的部位摘要
  const summaryDividerY = heroSectionY + heroSectionH - 44;
  const summaryTextY = heroSectionY + heroSectionH - 15;
  ctx.fillStyle = preset.borderHex;
  ctx.fillRect(dnaPanelX, summaryDividerY, dnaPanelW, 1.5);

  const textureSummaryPrefix = `APPLIED MATERIALS (${materialItems.length}):  `;
  ctx.font = '800 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = preset.accentHex;
  ctx.fillText(textureSummaryPrefix, dnaPanelX, summaryTextY);
  const prefixW = ctx.measureText(textureSummaryPrefix).width;

  const texturePartsLabel =
    materialItems.length > 0
      ? materialItems.map((i) => i.partName).join('  ·  ')
      : 'NONE';
  ctx.fillStyle = materialItems.length > 0 ? preset.textHex : preset.mutedHex;
  ctx.font = '700 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(
    truncateCanvasText(ctx, texturePartsLabel, Math.max(120, dnaPanelW - prefixW)),
    dnaPanelX + prefixW,
    summaryTextY
  );

  // 3. 下半部：材料應用規格明細卡片
  ctx.fillStyle = preset.textHex;
  ctx.font = '900 21px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(
    `MATERIAL SPECIFICATION (${materialItems.length} ${materialItems.length === 1 ? 'PART' : 'PARTS'})`,
    padX,
    scheduleTitleY
  );

  if (materialItems.length === 0) {
    ctx.fillStyle = preset.cardBgHex;
    ctx.fillRect(padX, cardsStartY, contentWidth, 148);
    ctx.strokeStyle = preset.borderHex;
    ctx.strokeRect(padX, cardsStartY, contentWidth, 148);

    ctx.fillStyle = preset.mutedHex;
    ctx.font = '600 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      'Select any part on the 3D sneaker and apply a PAIHO material before exporting.',
      width / 2,
      cardsStartY + 74
    );
    ctx.textAlign = 'left';
  } else {
    materialItems.forEach((item, idx) => {
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const cx = padX + col * (cardW + cardGap);
      const cy = cardsStartY + row * (cardH + cardRowGap);

      ctx.fillStyle = preset.cardBgHex;
      ctx.fillRect(cx, cy, cardW, cardH);
      ctx.strokeStyle = preset.borderHex;
      ctx.lineWidth = 2;
      ctx.strokeRect(cx, cy, cardW, cardH);

      const thumbSize = 164;
      const thumbX = cx + 30;
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

        // 僅於有調整染色時顯示右下角染色圓點
        if (item.hasCustomColor) {
          ctx.beginPath();
          ctx.arc(thumbX + thumbSize - 20, thumbY + thumbSize - 20, 14, 0, Math.PI * 2);
          ctx.fillStyle = item.hex;
          ctx.fill();
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = '#FFFFFF';
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = item.hex;
        ctx.fillRect(thumbX, thumbY, thumbSize, thumbSize);
        ctx.strokeStyle = preset.borderHex;
        ctx.lineWidth = 2;
        ctx.strokeRect(thumbX, thumbY, thumbSize, thumbSize);
      }

      const infoX = thumbX + thumbSize + 32;
      const infoW = cx + cardW - infoX - 30;

      // 部位名稱
      ctx.textAlign = 'left';
      ctx.fillStyle = preset.textHex;
      ctx.font = '900 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(truncateCanvasText(ctx, item.partName.toUpperCase(), infoW), infoX, cy + 40);

      // 材質名稱
      const matLabel = (item.materialTitle || 'PAIHO MATERIAL').toUpperCase();
      ctx.fillStyle = preset.accentHex;
      ctx.font = '800 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(truncateCanvasText(ctx, matLabel, infoW), infoX, cy + 74);

      // 材質說明文字
      if (item.materialDescription) {
        ctx.fillStyle = preset.mutedHex;
        ctx.font = '500 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        drawWrappedText(
          ctx,
          item.materialDescription,
          infoX,
          cy + 112,
          infoW,
          26,
          item.hasCustomColor ? 2 : 3
        );
      }

      // 色碼資訊（有調整染色時顯示當前色碼）
      if (item.hasCustomColor) {
        const { primary: cardPrimary } = formatColorSpecLabel(item.hex, colorMode);
        ctx.fillStyle = preset.textHex;
        ctx.font = '800 17px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(cardPrimary, infoX, cy + cardH - 28);
      }
    });
  }

  // 4. 精簡頁尾
  const footerY = totalHeight - 38;
  ctx.fillStyle = preset.borderHex;
  ctx.fillRect(padX, footerY - 28, contentWidth, 2);

  ctx.textAlign = 'left';
  ctx.fillStyle = preset.mutedHex;
  ctx.font = '700 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('PAIHO-U STUDIO', padX, footerY);

  ctx.textAlign = 'right';
  ctx.fillText('WWW.PAIHO.COM', width - padX, footerY);

  return canvas.toDataURL('image/png', 0.92);
};


