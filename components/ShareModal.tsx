import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Download,
  Edit3,
  FileText,
  Mail,
  Send,
  Check,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  BackdropId,
  STUDIO_BACKDROPS,
  ShareSpecItem,
  composeShareSheet,
  composeMaterialSpecSheet,
  buildEmailSummaryData,
  prepareEmailAttachmentBase64,
} from '../services/shareComposer';
import { COLOR_MODES, ColorMode } from '../services/colorUtils';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  isGeneratingScreenshot: boolean;
  isUpdatingBackdrop: boolean;
  screenshotUrl: string | null;
  heroScreenshotUrl: string | null;
  modelName: string;
  specItems: ShareSpecItem[];
  backdrop: BackdropId;
  onBackdropChange: (backdrop: BackdropId) => void;
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
  signature: string;
  onSignatureChange: (signature: string) => void;
  onDownload: (imageUrl: string, filename?: string) => void;
}

const BACKDROP_ORDER: BackdropId[] = ['white', 'concrete', 'obsidian'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  isGeneratingScreenshot,
  isUpdatingBackdrop,
  screenshotUrl,
  heroScreenshotUrl,
  modelName,
  specItems,
  backdrop,
  onBackdropChange,
  colorMode,
  onColorModeChange,
  signature,
  onSignatureChange,
  onDownload,
}) => {
  const [composedUrl, setComposedUrl] = useState<string | null>(null);
  const [isExportingSpec, setIsExportingSpec] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [emailFeedback, setEmailFeedback] = useState('');

  const modalCardRef = useRef<HTMLDivElement | null>(null);
  const pointerDownOutsideRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      setEmailStatus('idle');
      setEmailFeedback('');
      return;
    }
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
      backdropId: backdrop,
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
  }, [isOpen, screenshotUrl, backdrop, modelName, specItems, signature, colorMode]);

  useEffect(() => {
    if (emailStatus === 'sent') {
      const timer = setTimeout(() => {
        setEmailStatus('idle');
        setEmailFeedback('');
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [emailStatus]);

  if (!isOpen) return null;

  const previewUrl = composedUrl || screenshotUrl;
  const safeSlug = modelName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'paiho-u';

  const handleDownloadSpecSheet = async () => {
    if (isExportingSpec) return;
    setIsExportingSpec(true);
    try {
      const specUrl = await composeMaterialSpecSheet({
        heroImageUrl: heroScreenshotUrl || screenshotUrl || '',
        backdropId: backdrop,
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

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!previewUrl || isUpdatingBackdrop || emailStatus === 'sending') return;

    const cleanRecipient = recipientEmail.trim();
    if (!EMAIL_REGEX.test(cleanRecipient)) {
      setEmailStatus('error');
      setEmailFeedback('Please enter a valid recipient email address.');
      return;
    }

    setEmailStatus('sending');
    setEmailFeedback('');

    try {
      const [{ base64, ext }, summary] = await Promise.all([
        prepareEmailAttachmentBase64(previewUrl),
        Promise.resolve(
          buildEmailSummaryData({
            backdropId: backdrop,
            specItems,
            signature,
            colorMode,
          })
        ),
      ]);

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: cleanRecipient,
          modelName,
          designer: summary.designer,
          colorMode,
          backdropLabel: summary.backdropLabel,
          paletteChips: summary.paletteChips,
          partRows: summary.partRows,
          attachmentBase64: base64,
          attachmentFilename: `${safeSlug}-design-render.${ext}`,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string };

      if (!res.ok) {
        setEmailStatus('error');
        if (data.error === 'EMAIL_SERVICE_NOT_CONFIGURED') {
          setEmailFeedback(
            'Email delivery requires RESEND_API_KEY in server/Vercel environment variables.'
          );
        } else {
          setEmailFeedback(data.message || 'Failed to send email. Please try again.');
        }
        return;
      }

      setEmailStatus('sent');
      setEmailFeedback(`Design render sent to ${cleanRecipient}`);
    } catch {
      setEmailStatus('error');
      setEmailFeedback('Network error while sending email.');
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
                The Masterpiece
              </h2>
              <div className="w-8 h-[2px] bg-indigo-600 rounded-full"></div>
              <p className="text-[9px] text-gray-400 font-black tracking-[0.35em] uppercase pt-0.5">
                STUDIO RENDER · MULTI-VIEW EXPORT
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
            {isGeneratingScreenshot ? (
              <div className="aspect-[2560/1260] bg-gray-50 border border-gray-200 rounded-[2px] flex flex-col items-center justify-center space-y-5">
                <div className="w-12 h-12 border-[4px] border-gray-200 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-[10px] font-black tracking-[0.4em] uppercase text-gray-400">
                  Synthesizing Pixels...
                </p>
              </div>
            ) : (
              <>
                {previewUrl && (
                  <div className="relative rounded-[2px] overflow-hidden shadow-[0_12px_36px_rgba(0,0,0,0.06)] border border-gray-200 bg-white">
                    <img
                      src={previewUrl}
                      className={`w-full h-auto block transition-opacity duration-200 ${
                        isUpdatingBackdrop ? 'opacity-65' : 'opacity-100'
                      }`}
                      alt="Final Design"
                    />
                    {isUpdatingBackdrop && (
                      <div className="absolute top-3 right-3 md:top-4 md:right-4 px-3 py-1.5 bg-black/85 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-[2px]">
                        Updating Studio...
                      </div>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[auto_auto_1fr] gap-3 md:gap-4 items-end bg-gray-50/90 border border-gray-200 p-3.5 md:p-4 rounded-[2px]">
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.25em] block">
                      Studio Backdrop
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {BACKDROP_ORDER.map((id) => {
                        const preset = STUDIO_BACKDROPS[id];
                        const isActive = backdrop === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            disabled={isUpdatingBackdrop}
                            onClick={() => onBackdropChange(id)}
                            className={`flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider border rounded-[2px] h-[36px] transition-all cursor-pointer disabled:opacity-60 ${
                              isActive
                                ? 'bg-white border-indigo-600 text-indigo-600 shadow-sm'
                                : 'bg-white/70 border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900'
                            }`}
                          >
                            <span
                              className="w-3.5 h-3.5 rounded-full border border-gray-300 shrink-0"
                              style={{ backgroundColor: preset.swatchHex }}
                            />
                            <span className="whitespace-nowrap">{preset.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[9px] font-black text-gray-400 uppercase tracking-[0.25em] block">
                      Color Format
                    </span>
                    <div className="inline-flex items-center bg-white border border-gray-200 p-[3px] rounded-[2px] h-[36px]">
                      {COLOR_MODES.map((mode) => {
                        const isActive = colorMode === mode;
                        return (
                          <button
                            key={mode}
                            type="button"
                            disabled={isUpdatingBackdrop}
                            onClick={() => onColorModeChange(mode)}
                            className={`h-full px-2.5 text-[10px] font-black uppercase tracking-wider rounded-[2px] transition-all cursor-pointer disabled:opacity-60 ${
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

                  <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
                    <label
                      htmlFor="share-signature-input"
                      className="text-[9px] font-black text-gray-400 uppercase tracking-[0.25em] block"
                    >
                      Designer Signature
                    </label>
                    <div className="bg-white border border-gray-200 focus-within:border-indigo-600 transition-colors px-3 py-2 flex items-center gap-2 rounded-[2px] h-[36px]">
                      <Edit3 size={13} className="text-gray-400 shrink-0" />
                      <input
                        id="share-signature-input"
                        type="text"
                        maxLength={32}
                        value={signature}
                        onChange={(e) => onSignatureChange(e.target.value)}
                        placeholder="Enter designer name"
                        className="w-full bg-transparent border-none outline-none text-[11px] font-bold uppercase tracking-wider text-gray-800 placeholder:normal-case placeholder:font-semibold placeholder:tracking-wide placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5 pt-1">
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => previewUrl && onDownload(previewUrl, `${safeSlug}-design-render.png`)}
                      disabled={!previewUrl || isUpdatingBackdrop}
                      className="h-[44px] flex items-center gap-2.5 bg-black text-white border border-black px-6 md:px-7 rounded-[2px] font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:bg-gray-900 active:scale-[0.99] disabled:opacity-40 cursor-pointer whitespace-nowrap"
                    >
                      <Download size={15} /> Download Image
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadSpecSheet}
                      disabled={!previewUrl || isUpdatingBackdrop || isExportingSpec}
                      className="h-[44px] flex items-center gap-2.5 bg-white text-gray-900 border border-gray-300 px-6 md:px-7 rounded-[2px] font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:border-indigo-600 hover:text-indigo-600 active:scale-[0.99] disabled:opacity-40 cursor-pointer whitespace-nowrap"
                    >
                      <FileText size={15} />
                      {isExportingSpec ? 'Generating Spec...' : 'Download Spec'}
                    </button>

                    <form
                      onSubmit={handleSendEmail}
                      className="h-[44px] w-full sm:w-auto sm:min-w-[330px] flex items-stretch bg-white border border-gray-300 focus-within:border-indigo-600 rounded-[2px] overflow-hidden transition-colors"
                    >
                      <div className="flex-1 flex items-center gap-2 px-3 min-w-0">
                        <Mail size={14} className="text-gray-400 shrink-0" />
                        <input
                          type="email"
                          value={recipientEmail}
                          onChange={(e) => {
                            setRecipientEmail(e.target.value);
                            if (emailStatus === 'error') {
                              setEmailStatus('idle');
                              setEmailFeedback('');
                            }
                          }}
                          placeholder="Enter recipient email"
                          aria-label="Recipient Email"
                          disabled={!previewUrl || isUpdatingBackdrop || emailStatus === 'sending'}
                          className="w-full bg-transparent border-none outline-none text-[11px] font-semibold tracking-wide text-gray-800 placeholder:text-gray-400 disabled:opacity-50"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={!previewUrl || isUpdatingBackdrop || emailStatus === 'sending'}
                        className={`px-5 flex items-center justify-center gap-2 font-black text-[10px] uppercase tracking-[0.2em] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 ${
                          emailStatus === 'sent'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                      >
                        {emailStatus === 'sending' ? (
                          <>
                            <Loader2 size={14} className="animate-spin" /> Sending...
                          </>
                        ) : emailStatus === 'sent' ? (
                          <>
                            <Check size={14} /> Sent
                          </>
                        ) : (
                          <>
                            <Send size={13} /> Send Email
                          </>
                        )}
                      </button>
                    </form>
                  </div>

                  {emailFeedback && (
                    <div
                      className={`flex items-center justify-center gap-1.5 text-[11px] font-semibold ${
                        emailStatus === 'sent' ? 'text-emerald-600' : 'text-red-600'
                      }`}
                    >
                      {emailStatus === 'sent' ? <Check size={13} /> : <AlertCircle size={13} />}
                      <span>{emailFeedback}</span>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
