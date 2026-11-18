import React, { useEffect, useMemo, useState } from 'react';
import { Code, Save, Copy, Trash2, RotateCcw, X } from 'lucide-react';
import { SelectedPart, TextureConfig, TextureItem } from '../types';
import { getLinkedColorParts, getPartStorageKey } from '../services/partConfig';
import { textureCacheManager } from '../services/textureCacheManager';

interface DevUvToolProps {
  modelId: string;
  modelName: string;
  selectedPart: SelectedPart | null;
  activeTexture: TextureItem | null;
  materials: TextureItem[];
  currentTextureConfig: TextureConfig | null | undefined;
  partTextures: Record<string, TextureConfig | null>;
  devConfigs: Record<string, any>;
  setDevConfigs: (updater: (prev: Record<string, any>) => Record<string, any>) => void;
  clearDevConfigs: () => void;
  setPartTextures: (updater: (prev: Record<string, TextureConfig | null>) => Record<string, TextureConfig | null>) => void;
  setActiveTexture: (texture: TextureItem | null) => void;
  updateTextureConfig: (key: keyof TextureConfig, value: any) => void;
  setToast: (toast: string | null) => void;
}

export const DevUvTool: React.FC<DevUvToolProps> = ({
  modelId,
  modelName,
  selectedPart,
  activeTexture,
  materials,
  currentTextureConfig,
  partTextures,
  devConfigs,
  setDevConfigs,
  clearDevConfigs,
  setPartTextures,
  setActiveTexture,
  updateTextureConfig,
  setToast,
}) => {
  const [cacheStats, setCacheStats] = useState(() => textureCacheManager.getStats());
  const [savedViewTab, setSavedViewTab] = useState<'part' | 'all'>('part');

  const partKey = selectedPart ? getPartStorageKey(modelId, selectedPart.name) : '';
  const allSavedEntries = useMemo(
    () =>
      Object.entries(devConfigs).sort(([, a]: [string, any], [, b]: [string, any]) => {
        const keyCmp = String(a?.partKey || '').localeCompare(String(b?.partKey || ''));
        if (keyCmp !== 0) return keyCmp;
        return String(a?.textureId || '').localeCompare(String(b?.textureId || ''));
      }),
    [devConfigs]
  );

  const partSavedConfigs = useMemo(
    () => (partKey ? allSavedEntries.filter(([, c]: [string, any]) => c?.partKey === partKey) : []),
    [allSavedEntries, partKey]
  );

  const totalSavedCount = allSavedEntries.length;

  useEffect(() => {
    setCacheStats(textureCacheManager.getStats());
    const timer = setInterval(() => {
      setCacheStats(textureCacheManager.getStats());
    }, 600);
    return () => clearInterval(timer);
  }, [partTextures, activeTexture, modelId]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const handleExportAllJson = () => {
    if (allSavedEntries.length === 0) {
      showToast('目前沒有任何已暫存的設定');
      return;
    }
    const configArray = allSavedEntries.map(([, val]) => val);
    navigator.clipboard.writeText(JSON.stringify(configArray, null, 2));
    showToast(`已複製全部 ${configArray.length} 筆暫存參數 (JSON)！`);
  };

  const handleClearAllSavedAndCache = () => {
    clearDevConfigs();
    setPartTextures(() => ({}));
    setActiveTexture(null);
    setTimeout(() => {
      textureCacheManager.clearCache();
      setCacheStats(textureCacheManager.getStats());
    }, 60);
    showToast('已清空全部暫存、模型外觀與貼圖快取');
  };

  // 未選取部位但已有暫存資料時，顯示精簡總覽列方便直接一次匯出或清空
  if (!selectedPart) {
    if (totalSavedCount === 0) return null;
    return (
      <div
        className="hidden lg:flex items-center gap-3 absolute left-6 top-28 xl:top-32 bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl shadow-xl px-4 py-3 z-50 animate-in fade-in slide-in-from-left-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-[11px] font-black tracking-wider text-gray-900 uppercase">
          <Code size={14} />
          <span>已暫存 {totalSavedCount} 筆</span>
        </div>
        <button
          onClick={handleExportAllJson}
          className="px-3 py-1.5 bg-gray-900 hover:bg-black text-white text-[10px] font-bold rounded-lg flex items-center gap-1 transition-colors"
        >
          <Copy size={12} /> 匯出全部 (JSON)
        </button>
        <button
          onClick={handleClearAllSavedAndCache}
          className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-bold rounded-lg flex items-center gap-1 transition-colors"
          title="清空全部暫存參數、模型外觀與貼圖快取"
        >
          <Trash2 size={12} /> 清空
        </button>
      </div>
    );
  }

  const currentScale = currentTextureConfig?.scale ?? 2.5;
  const currentOffsetX = currentTextureConfig?.offsetX ?? 0;
  const currentOffsetY = currentTextureConfig?.offsetY ?? 0;

  const activeSavedEntry = activeTexture ? devConfigs[`${partKey}_${activeTexture.id}`] : null;
  const isDefaultUv =
    Math.abs(currentScale - 2.5) < 0.001 &&
    Math.abs(currentOffsetX) < 0.001 &&
    Math.abs(currentOffsetY) < 0.001;

  const isMatchesSaved =
    Boolean(activeSavedEntry) &&
    Math.abs(currentScale - activeSavedEntry.scale) < 0.001 &&
    Math.abs(currentOffsetX - activeSavedEntry.offsetX) < 0.001 &&
    Math.abs(currentOffsetY - activeSavedEntry.offsetY) < 0.001;

  const statusLabel = !activeTexture
    ? null
    : isMatchesSaved
    ? { text: '已套用暫存', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
    : isDefaultUv
    ? { text: '預設值', cls: 'bg-gray-100 text-gray-600 border-gray-200' }
    : { text: '未暫存變更', cls: 'bg-amber-50 text-amber-700 border-amber-200' };

  const handleApplySavedConfig = (saved: any) => {
    const matchedTexture = materials.find(
      (m) => m.id === saved.textureId || m.url === saved.colorUrl
    );
    if (!matchedTexture) {
      showToast('目前材質庫找不到此貼圖');
      return;
    }
    setActiveTexture(matchedTexture);
    setPartTextures((prev) => {
      const existing = prev[partKey];
      const inheritedColor = existing?.color || '#ffffff';
      return {
        ...prev,
        [partKey]: {
          url: matchedTexture.url,
          normalUrl: matchedTexture.normalUrl,
          scale: saved.scale ?? 2.5,
          offsetX: saved.offsetX ?? 0,
          offsetY: saved.offsetY ?? 0,
          rotation: existing?.rotation ?? 0,
          roughness: existing?.roughness ?? 1,
          metalness: existing?.metalness ?? 0,
          opacity: existing?.opacity ?? 1,
          color: inheritedColor,
        },
      };
    });
    showToast(`已載入 ${saved.textureName || saved.textureId}`);
  };

  const handleDeleteSingleSaved = (devKey: string, label: string) => {
    setDevConfigs((prev) => {
      const next = { ...prev };
      delete next[devKey];
      return next;
    });
    showToast(`已移除暫存：${label}`);
  };

  const handleRestorePartMaterial = () => {
    const linkedParts = getLinkedColorParts(selectedPart.name, modelId);
    setPartTextures((prev) => {
      const next = { ...prev };
      linkedParts.forEach((pName) => {
        delete next[getPartStorageKey(modelId, pName)];
      });
      delete next[partKey];
      return next;
    });
    setActiveTexture(null);
    showToast(`已還原 ${selectedPart.name} 原始貼圖與顏色`);
  };

  const handleSaveCurrent = () => {
    if (!activeTexture || !currentTextureConfig) return;
    const devKey = `${partKey}_${activeTexture.id}`;
    setDevConfigs((prev) => ({
      ...prev,
      [devKey]: {
        partKey,
        textureId: activeTexture.id,
        textureName: activeTexture.name,
        colorUrl: activeTexture.url || '',
        normalUrl: activeTexture.normalUrl || '',
        scale: currentTextureConfig.scale,
        offsetX: currentTextureConfig.offsetX,
        offsetY: currentTextureConfig.offsetY,
        originalRoughness: currentTextureConfig.originalRoughness,
      },
    }));
    showToast(`已暫存 ${selectedPart.name} - ${activeTexture.name}（累計 ${totalSavedCount + (devConfigs[devKey] ? 0 : 1)} 筆）`);
  };

  return (
    <div
      className="hidden lg:block absolute left-6 top-28 xl:top-32 w-80 max-h-[calc(100dvh-9rem)] overflow-y-auto no-scrollbar bg-white/95 backdrop-blur-md border border-gray-200 rounded-2xl shadow-xl p-5 z-50 animate-in fade-in slide-in-from-left-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="text-[11px] font-black tracking-widest text-gray-900 uppercase flex items-center gap-1.5">
          <Code size={14} /> Dev UV Tool
        </h3>
        <span className="text-[9px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
          快取 {cacheStats.cachedCount} 張 · {cacheStats.totalMemoryMB} MB
        </span>
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-500 font-semibold mb-4 pb-2.5 border-b border-gray-100">
        <span className="truncate pr-2">
          {modelName} · <span className="text-indigo-600 font-bold">{selectedPart.name}</span>
        </span>
        {statusLabel && (
          <span className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded border ${statusLabel.cls}`}>
            {statusLabel.text}
          </span>
        )}
      </div>

      {/* 1. 此部位 / 全部已存 分頁標籤 */}
      <div className="mb-4">
        <div className="flex items-center gap-1 mb-2">
          <button
            onClick={() => setSavedViewTab('part')}
            className={`px-2.5 py-1 rounded text-[9px] font-bold transition-colors ${
              savedViewTab === 'part'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-500 hover:text-gray-800'
            }`}
          >
            此部位 ({partSavedConfigs.length})
          </button>
          <button
            onClick={() => setSavedViewTab('all')}
            className={`px-2.5 py-1 rounded text-[9px] font-bold transition-colors ${
              savedViewTab === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-500 hover:text-gray-800'
            }`}
          >
            全部已存 ({totalSavedCount})
          </button>
        </div>

        {savedViewTab === 'part' ? (
          <div className="flex flex-wrap gap-1.5">
            {partSavedConfigs.map(([devKey, c]: [string, any]) => {
              const isCurrent = activeTexture?.id === c.textureId;
              const label = c.textureName || c.textureId;
              return (
                <div
                  key={devKey}
                  className={`inline-flex items-center gap-1 rounded-md border text-[9px] font-semibold transition-colors ${
                    isCurrent
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                      : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200/70'
                  }`}
                >
                  <button
                    onClick={() => handleApplySavedConfig(c)}
                    className="pl-2 py-0.5 text-left"
                    title="點擊套用此暫存設定"
                  >
                    {label}
                  </button>
                  <button
                    onClick={() => handleDeleteSingleSaved(devKey, label)}
                    className="pr-1.5 py-0.5 text-gray-400 hover:text-red-500 transition-colors"
                    title="刪除此暫存"
                  >
                    <X size={10} />
                  </button>
                </div>
              );
            })}
            {partSavedConfigs.length === 0 && (
              <span className="text-[9px] text-gray-400 font-medium">此部位尚無暫存參數</span>
            )}
          </div>
        ) : (
          <div className="max-h-32 overflow-y-auto space-y-1 pr-0.5">
            {allSavedEntries.map(([devKey, c]: [string, any]) => {
              const label = `${c.partKey} · ${c.textureName || c.textureId}`;
              return (
                <div
                  key={devKey}
                  className={`flex items-center justify-between px-2 py-1 rounded-md border text-[9px] font-semibold ${
                    c.partKey === partKey
                      ? 'bg-indigo-50/70 border-indigo-200 text-indigo-700'
                      : 'bg-gray-50 border-gray-200 text-gray-700'
                  }`}
                >
                  <span className="truncate pr-2">
                    {label} ({Number(c.scale).toFixed(2)})
                  </span>
                  <button
                    onClick={() => handleDeleteSingleSaved(devKey, label)}
                    className="shrink-0 text-gray-400 hover:text-red-500 transition-colors"
                    title="刪除此暫存"
                  >
                    <X size={11} />
                  </button>
                </div>
              );
            })}
            {allSavedEntries.length === 0 && (
              <span className="text-[9px] text-gray-400 font-medium">尚未暫存任何部位參數</span>
            )}
          </div>
        )}
      </div>

      {activeTexture ? (
        <div className="space-y-3.5 mb-5">
          <div>
            <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
              <span>SCALE (縮放)</span>
              <span className="text-gray-900 tabular-nums">{currentScale.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="10"
              step="0.05"
              value={currentScale}
              onChange={(e) => updateTextureConfig('scale', parseFloat(e.target.value))}
              className="w-full accent-gray-900 h-[2px] bg-gray-200 rounded-full appearance-none cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
              <span>OFFSET X (水平偏移)</span>
              <span className="text-gray-900 tabular-nums">{currentOffsetX.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.01"
              value={currentOffsetX}
              onChange={(e) => updateTextureConfig('offsetX', parseFloat(e.target.value))}
              className="w-full accent-gray-900 h-[2px] bg-gray-200 rounded-full appearance-none cursor-pointer"
            />
          </div>
          <div>
            <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
              <span>OFFSET Y (垂直偏移)</span>
              <span className="text-gray-900 tabular-nums">{currentOffsetY.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.01"
              value={currentOffsetY}
              onChange={(e) => updateTextureConfig('offsetY', parseFloat(e.target.value))}
              className="w-full accent-gray-900 h-[2px] bg-gray-200 rounded-full appearance-none cursor-pointer"
            />
          </div>
        </div>
      ) : (
        <div className="mb-4 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-100 text-[10px] text-gray-500 leading-relaxed">
          請於右側 Library 選擇材質，調整 UV 後按「暫存此貼圖」，再切換下一個部位繼續調整，最後按下方一次匯出全部。
        </div>
      )}

      {/* 2~5 核心操作按鈕 */}
      <div className="space-y-2">
        {activeTexture && (
          <button
            onClick={handleSaveCurrent}
            className="w-full bg-indigo-600 text-white font-bold text-[11px] py-2.5 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <Save size={14} /> 暫存此貼圖
          </button>
        )}

        {currentTextureConfig && (
          <button
            onClick={handleRestorePartMaterial}
            className="w-full bg-indigo-50 text-indigo-600 border border-indigo-100 font-bold text-[11px] py-2 rounded-lg hover:bg-indigo-100 flex items-center justify-center gap-1.5 transition-colors"
          >
            <RotateCcw size={13} /> 還原此部位
          </button>
        )}

        <button
          onClick={handleExportAllJson}
          disabled={totalSavedCount === 0}
          className="w-full bg-gray-900 text-white font-bold text-[11px] py-2.5 rounded-lg hover:bg-black flex items-center justify-center gap-1.5 transition-colors shadow-md disabled:opacity-40"
        >
          <Copy size={14} /> 一次匯出全部暫存 ({totalSavedCount} 筆 JSON)
        </button>

        <button
          onClick={handleClearAllSavedAndCache}
          className="w-full bg-red-50/70 text-red-600 border border-red-100 font-bold text-[11px] py-2 rounded-lg hover:bg-red-100/80 flex items-center justify-center gap-1.5 transition-colors"
          title="清空所有已暫存參數、重置模型外觀並釋放 GPU 貼圖快取"
        >
          <Trash2 size={13} /> 清空全部暫存
        </button>
      </div>
    </div>
  );
};
