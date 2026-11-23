import React, { useEffect, useRef, useState } from 'react';
import { X, Download, Edit3, FileText } from 'lucide-react';
import {
  ShareSpecItem,
  composeShareSheet,
  composeMaterialSpecSheet,
} from '../services/shareComposer';
import { COLOR_MODES, ColorMode } from '../services/colorUtils';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  isGeneratingScreenshot: boolean;
  screenshotUrl: string | null;
  heroScreenshotUrl: string | null;
  modelName: string;
  specItems: ShareSpecItem[];
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
  signature: string;
  onSignatureChange: (signature: string) => void;
  onDownload: (imageUrl: string, filename?: string) => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  isGeneratingScreenshot,
  screenshotUrl,
  heroScreenshotUrl,
  modelName,
  specItems,
  colorMode,
  onColorModeChange,
  signature,
  onSignatureChange,
  onDownload,
}) => {
  const [composedUrl, setComposedUrl] = useState<string | null>(null);
  const [isExportingSpec, setIsExportingSpec] = useState(false);

  const modalCardRef = useRef<HTMLDivElement | null>(null);
  const pointerDownOutsideRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !screenshotUrl) {
      setComposedUrl(null);
      return;
    }

    let cancelled = false;
    composeShareSheet({
      baseImageUrl: screenshotUrl,
      modelName,
      specItems,
      signature,
      colorMode,
    })
      .then((resultUrl) => {
        if (!cancelled && resultUrl) {
          setComposedUrl(resultUrl);
        }
      })
      .catch(() => {
        if (!cancelled) setComposedUrl(screenshotUrl);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, screenshotUrl, modelName, specItems, signature, colorMode]);

  if (!isOpen) return null;

  const isSynthesizing = isGeneratingScreenshot || (Boolean(screenshotUrl) && !composedUrl);
  const previewUrl = composedUrl;
  const safeSlug = modelName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'paiho-u';

  const handleDownloadSpecSheet = async () => {
    if (isExportingSpec) return;
    setIsExportingSpec(true);
    try {
      const specUrl = await composeMaterialSpecSheet({
        heroImageUrl: heroScreenshotUrl || screenshotUrl || '',
        modelName,
        specItems,
        signature,
        colorMode,
      });
      if (specUrl) {
        onDownload(specUrl, `${safeSlug}-spec.png`);
      }
    } finally {
      setIsExportingSpec(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-white/95 backdrop-blur-md p-4 md:p-6 animate-in fade-in duration-500"
      onPointerDown={(e) => {
        pointerDownOutsideRef.current = Boolean(
          modalCardRef.current && !modalCardRef.current.contains(e.target as Node)
        );
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (
          pointerDownOutsideRef.current &&
          modalCardRef.current &&
          !modalCardRef.current.contains(e.target as Node)
        ) {
          onClose();
        }
        pointerDownOutsideRef.current = false;
      }}
    >
      <div className="min-h-full flex items-center justify-center py-2">
        <div ref={modalCardRef} className="w-full max-w-4xl animate-in zoom-in-95 duration-500">
          <div className="flex items-start justify-between mb-5 md:mb-6">
            <div className="space-y-2">
              <h2 className="text-xl md:text-2xl font-black tracking-[0.14em] uppercase text-gray-900 leading-none">
                Design Specification
              </h2>
              <div className="w-8 h-[2px] bg-indigo-600 rounded-full"></div>
              <p className="text-[9px] text-gray-400 font-black tracking-[0.35em] uppercase pt-0.5">
                MULTI-VIEW RENDER · MATERIAL & COLORWAY EXPORT
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-[2px] transition-all text-gray-400 hover:text-gray-900 active:scale-95 cursor-pointer shrink-0"
              aria-label="Close"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          <div className="space-y-4 md:space-y-5">
            {isSynthesizing ? (
              <div className="aspect-[2560/1260] bg-gray-50 border border-gray-200 rounded-[2px] flex flex-col items-center justify-center space-y-5">
                <div className="w-12 h-12 border-[4px] border-gray-200 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-[10px] font-black tracking-[0.4em] uppercase text-gray-400">
                  Synthesizing Pixels...
                </p>
              </div>
            ) : (
              <>
                {previewUrl && (
                  <div className="relative rounded-[2px] overflow-hidden shadow-[0_12px_36px_rgba(0,0,0,0.06)] border border-gray-200 bg-[#F4F5F7]">
                    <img
                      src={previewUrl}
                      className="w-full h-auto block"
                      alt="Final Design"
                    />
                  </div>
                )}

                <div className="grid grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-[auto_minmax(0,1fr)_auto] gap-2.5 sm:gap-3 md:gap-4 items-end bg-gray-50/90 border border-gray-200 p-3 sm:p-3.5 md:p-4 rounded-[2px]">
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.18em] sm:tracking-[0.25em] block whitespace-nowrap">
                      Color Format
                    </span>
                    <div className="inline-flex items-center bg-white border border-gray-200 p-[3px] rounded-[2px] h-[38px]">
                      {COLOR_MODES.map((mode) => {
                        const isActive = colorMode === mode;
                        return (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => onColorModeChange(mode)}
                            className={`h-full px-2 sm:px-2.5 text-[9.5px] sm:text-[10px] font-black uppercase tracking-wider rounded-[2px] transition-all cursor-pointer ${
                              isActive
                                ? 'bg-indigo-600 text-white shadow-sm'
                                : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                          >
                            {mode}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5 min-w-0">
                    <label
                      htmlFor="share-signature-input"
                      className="text-[9px] font-black text-gray-400 uppercase tracking-[0.16em] sm:tracking-[0.25em] block truncate"
                    >
                      Designer Signature
                    </label>
                    <div className="bg-white border border-gray-200 focus-within:border-indigo-600 transition-colors px-2.5 sm:px-3 flex items-center gap-1.5 sm:gap-2 rounded-[2px] h-[38px] min-w-0">
                      <Edit3 size={13} className="text-gray-400 shrink-0" />
                      <input
                        id="share-signature-input"
                        type="text"
                        maxLength={32}
                        value={signature}
                        onChange={(e) => onSignatureChange(e.target.value)}
                        placeholder="Enter designer name"
                        className="w-full min-w-0 bg-transparent border-none outline-none text-[11px] font-bold uppercase tracking-wider text-gray-800 placeholder:normal-case placeholder:font-semibold placeholder:tracking-wide placeholder:text-gray-400"
                      />
                    </div>
                  </div>

                  <div className="col-span-2 lg:col-span-1 flex items-center gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => previewUrl && onDownload(previewUrl, `${safeSlug}-design-render.png`)}
                      disabled={!previewUrl}
                      className="flex-1 lg:flex-none h-[38px] flex items-center justify-center gap-2 bg-black text-white border border-black px-3 sm:px-5 rounded-[2px] font-black text-[9.5px] sm:text-[10px] uppercase tracking-[0.14em] sm:tracking-[0.18em] transition-all hover:bg-gray-900 active:scale-[0.99] disabled:opacity-40 cursor-pointer whitespace-nowrap"
                    >
                      <Download size={14} /> Download Render
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadSpecSheet}
                      disabled={!previewUrl || isExportingSpec}
                      className="flex-1 lg:flex-none h-[38px] flex items-center justify-center gap-2 bg-white text-gray-900 border border-gray-300 px-3 sm:px-5 rounded-[2px] font-black text-[9.5px] sm:text-[10px] uppercase tracking-[0.14em] sm:tracking-[0.18em] transition-all hover:border-indigo-600 hover:text-indigo-600 active:scale-[0.99] disabled:opacity-40 cursor-pointer whitespace-nowrap"
                    >
                      <FileText size={14} />
                      {isExportingSpec ? 'Generating Spec...' : 'Download Spec'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
