import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, RotateCw, Share2, Download, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, MousePointer2, Smartphone, Monitor, Pipette } from 'lucide-react';
import ModelViewer from './components/ModelViewer';
import { TextureItem, SelectedPart, TextureConfig } from './types';

const UNIFORM_LINK = "https://www.paiho.com/tw/material-hub/b873383c1623dcffafd786ce755b2786";

const MODELS = [
  { 
    id: 'lace', 
    name: 'Lace-shoe', 
    url: 'https://huggingface.co/yayapewn/huggingface/resolve/main/lace-shoe.glb',
    scale: 2,
    rotation: [0, Math.PI, 0] as [number, number, number],
    position: [0, 0, 0] as [number, number, number],
    initialEnvRotation: 280
  },
  { 
    id: 'traveler', 
    name: 'Traveler-shoe', 
    url: 'https://huggingface.co/yayapewn/huggingface/resolve/main/Traveler-shoe.glb',
    scale: 1.53, 
    rotation: [-0.3, Math.PI * 2.5, 0] as [number, number, number], 
    position: [0, 0.03, 0] as [number, number, number], 
    initialEnvRotation: 280
  },
  { 
    id: 'dna', 
    name: 'D.N.A-shoe', 
    url: null,
    scale: 2,
    rotation: [0, Math.PI, 0] as [number, number, number],
    position: [0, 0, 0] as [number, number, number],
    initialEnvRotation: 280
  }
];

const GENERAL_TEXTURES: TextureItem[] = [
  { id: 'v1', name: 'Fine Fabric 01', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000601%20A%20WP_BASE.jpg', normalUrl: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000601%20A%20WP_NRM.jpg', title: '4-WAY STRETCH FABRIC', description: 'A dynamic stretchable fabric providing high flexibility and comfort for peak performance.', link: UNIFORM_LINK },
  { id: 'v2', name: 'Woven Fabric 02', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000716%20A%20WP_BASE.jpg', normalUrl: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000716%20A%20WP_NRM.jpg', title: 'ENGINEERED JACQUARD', description: 'Intricately woven patterns designed for strategic support and maximum breathability.', link: UNIFORM_LINK },
  { id: 'v3', name: 'Tech Mesh 03', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000820%20J%20WP_BASE.jpg', normalUrl: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000820%20J%20WP_NRM.jpg', title: 'AERO-VENT MESH', description: 'Lightweight mesh engineered with open structures to ensure optimal cooling during activity.', link: UNIFORM_LINK },
  { id: 'v4', name: 'Durable 04', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01305-01A-000A_BASE.jpg', normalUrl: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01305-01A-000A_NRM.jpg', title: 'HEAVY DUTY NYLON', description: 'Abrasion-resistant nylon blend crafted for rugged environments and longevity.', link: UNIFORM_LINK },
  { id: 'v5', name: 'Breathable 05', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01317-01A-000A_BASE.jpg', normalUrl: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01317-01A-000A_NRM.jpg', title: 'ECO-KNIT MATERIAL', description: 'Sustainable yarn choice offering a soft touch and reduced environmental impact.', link: UNIFORM_LINK },
  { id: 'v6', name: 'Digital 06', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01436-01A-000A_BASE.jpg', normalUrl: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01436-01A-000A_NRM.jpg', title: 'DIGITAL PRINT 3D', description: 'Vibrant 3D printed texture for a futuristic and personalized aesthetic.', link: UNIFORM_LINK },
];

// --- Color Conversion Helpers ---
const hsvToRgb = (h: number, s: number, v: number) => {
  s /= 100; v /= 100;
  const i = Math.floor(h / 60);
  const f = h / 60 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0, g = 0, b = 0;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};

const rgbToHex = (r: number, g: number, b: number) => {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
};

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 255, g: 255, b: 255 };
};

const rgbToHsv = (r: number, g: number, b: number) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max !== min) {
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, v: v * 100 };
};

/**
 * 專業級直覺檢色器
 */
const ProColorPicker: React.FC<{ color: string, onChange: (hex: string) => void, onLiveChange?: (hex: string) => void, isPickingColor: boolean, onTogglePick: () => void }> = ({ color, onChange, onLiveChange, isPickingColor, onTogglePick }) => {
  const [hsv, setHsv] = useState(() => rgbToHsv(hexToRgb(color).r, hexToRgb(color).g, hexToRgb(color).b));
  const [inputText, setInputText] = useState(color);
  
  const colorRef = useRef(color);
  const hsvRef = useRef(hsv);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (colorRef.current !== color) {
       colorRef.current = color;
       setInputText(color);
       const newRgb = hexToRgb(color);
       const newHsv = rgbToHsv(newRgb.r, newRgb.g, newRgb.b);
       setHsv(newHsv);
       hsvRef.current = newHsv;
    }
  }, [color]);

  const updateHsv = (updates: Partial<{h:number, s:number, v:number}>, isCommit = false) => {
    const nextHsv = { ...hsvRef.current, ...updates };
    setHsv(nextHsv);
    hsvRef.current = nextHsv;
    
    const newRgb = hsvToRgb(nextHsv.h, nextHsv.s, nextHsv.v);
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    
    setInputText(newHex);
    
    if (newHex !== colorRef.current) {
        colorRef.current = newHex;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        
        if (isCommit) {
            onChange(newHex);
        } else if (onLiveChange) {
            rafRef.current = requestAnimationFrame(() => {
                onLiveChange(newHex);
            });
        }
    } else if (isCommit) {
        onChange(newHex);
    }
  };

  const hsRef = useRef<HTMLDivElement>(null);
  const vRef = useRef<HTMLDivElement>(null);

  const handlePointerDownHS = (e: React.PointerEvent) => {
    if (!hsRef.current) return;
    const rect = hsRef.current.getBoundingClientRect();
    const update = (clientX: number, clientY: number, isCommit = false) => {
      const h = Math.max(0, Math.min(360, ((clientX - rect.left) / rect.width) * 360));
      const s = Math.max(0, Math.min(100, (1 - (clientY - rect.top) / rect.height) * 100));
      updateHsv({ h, s }, isCommit);
    };
    update(e.clientX, e.clientY);
    const onMove = (m: PointerEvent) => update(m.clientX, m.clientY);
    const onUp = (m: PointerEvent) => { 
        update(m.clientX, m.clientY, true);
        window.removeEventListener('pointermove', onMove); 
        window.removeEventListener('pointerup', onUp); 
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handlePointerDownV = (e: React.PointerEvent) => {
    if (!vRef.current) return;
    const rect = vRef.current.getBoundingClientRect();
    const update = (clientY: number, isCommit = false) => {
      const v = Math.max(0, Math.min(100, (1 - (clientY - rect.top) / rect.height) * 100));
      updateHsv({ v }, isCommit);
    };
    update(e.clientY);
    const onMove = (m: PointerEvent) => update(m.clientY);
    const onUp = (m: PointerEvent) => { 
        update(m.clientY, true);
        window.removeEventListener('pointermove', onMove); 
        window.removeEventListener('pointerup', onUp); 
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-700">
      <div className="flex gap-4 items-stretch">
        {/* HS 調色盤 - 高度減少 1/3，使用 3:2 比例 */}
        <div 
          ref={hsRef}
          className="relative flex-1 aspect-[3/2] rounded-[24px] cursor-crosshair overflow-hidden touch-none"
          style={{ 
            background: `
              linear-gradient(to bottom, transparent, #fff),
              linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)
            ` 
          }}
          onPointerDown={handlePointerDownHS}
        >
          <div 
            className="absolute w-5 h-5 border-2 border-white rounded-full shadow-lg -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `${(hsv.h / 360) * 100}%`, top: `${100 - hsv.s}%` }}
          ></div>
        </div>

        <div 
          ref={vRef}
          className="relative w-5 rounded-full cursor-pointer touch-none"
          style={{ 
              background: `linear-gradient(to bottom, ${rgbToHex(hsvToRgb(hsv.h, hsv.s, 100).r, hsvToRgb(hsv.h, hsv.s, 100).g, hsvToRgb(hsv.h, hsv.s, 100).b)}, #000)` 
          }}
          onPointerDown={handlePointerDownV}
        >
          <div 
            className="absolute left-1/2 -translate-x-1/2 w-5 h-5 bg-white border border-gray-100 rounded-full shadow-md -translate-y-1/2 pointer-events-none"
            style={{ top: `${100 - hsv.v}%` }}
          ></div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_0.8fr] gap-3 items-end">
          <div className="space-y-1.5">
              <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block ml-1">HEX CODE</span>
              <div className="bg-gray-50 rounded-xl px-4 py-3 border border-transparent focus-within:border-indigo-100 transition-all flex items-center h-[52px]">
                  <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setInputText(val);
                        if (/^#[0-9A-F]{6}$/i.test(val)) {
                            if (onLiveChange) onLiveChange(val);
                            onChange(val);
                        }
                    }}
                    className="bg-transparent border-none outline-none w-full text-[13px] font-black uppercase tracking-tight text-gray-700" 
                  />
              </div>
          </div>
          <button 
            onClick={onTogglePick}
            className={`h-[52px] w-[52px] flex items-center justify-center rounded-xl transition-colors border ${isPickingColor ? 'bg-indigo-100 text-indigo-600 border-indigo-200 shadow-sm' : 'bg-gray-50 text-gray-400 hover:text-indigo-500 hover:bg-gray-200/50 border-transparent'}`}
            title="Pick color from 3D model"
          >
            <Pipette size={20} />
          </button>
          <div className="w-full h-[52px] bg-gray-50 rounded-xl overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] border border-gray-100" style={{ backgroundColor: color }}></div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [activeModelIndex, setActiveModelIndex] = useState(0);
  const [libraries, setLibraries] = useState({ materials: GENERAL_TEXTURES });
  const [selectedPart, setSelectedPart] = useState<SelectedPart | null>(null);
  const [activeTexture, setActiveTexture] = useState<TextureItem | null>(null);
  const [envIntensity, setEnvIntensity] = useState<number>(1.5); 
  const [envRotation, setEnvRotation] = useState<number>(MODELS[0].initialEnvRotation); 
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [isPickingColor, setIsPickingColor] = useState<boolean>(false);
  const [partTextures, setPartTextures] = useState<Record<string, TextureConfig | null>>({});

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [isGeneratingScreenshot, setIsGeneratingScreenshot] = useState(false);
  
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [orientationError, setOrientationError] = useState<'mobile-portrait' | 'tablet-landscape' | null>(null);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
  const [toast, setToast] = useState<string | null>(null);

  const modelViewerRef = useRef<any>(null);
  const currentModel = MODELS[activeModelIndex];

  useEffect(() => {
    const checkOrientation = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isPortrait = height > width;
      const isMobile = width < 768;
      const isTablet = width >= 768 && width < 1280;
      
      setIsMobileView(isMobile);

      if (isMobile && !isPortrait) setOrientationError('mobile-portrait');
      else if (isTablet && isPortrait) setOrientationError('tablet-landscape');
      else setOrientationError(null);
    };
    window.addEventListener('resize', checkOrientation);
    checkOrientation();
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  const handleModelSwitch = (index: number) => {
    if (!MODELS[index].url) {
      setToast("COMING SOON");
      setTimeout(() => setToast(null), 3000);
      return;
    }
    setActiveModelIndex(index);
    setEnvRotation(MODELS[index].initialEnvRotation);
    setSelectedPart(null);
    setActiveTexture(null);
    setPartTextures({});
  };

  const isLibrarySupported = (partName: string) => {
    if (!partName) return false;
    const name = partName.toUpperCase();
    return !['TONGUE', 'MIDSOLE', 'OUTSOLE'].includes(name);
  };

  const applyTexture = (texture: TextureItem) => {
    if (!selectedPart || !isLibrarySupported(selectedPart.name)) return;
    setActiveTexture(texture);
    setPartTextures(prev => {
      const existing = prev[selectedPart.id];
      if (existing) return { ...prev, [selectedPart.id]: { ...existing, url: texture.url, normalUrl: texture.normalUrl, color: '#ffffff' } };
      return { ...prev, [selectedPart.id]: { url: texture.url, normalUrl: texture.normalUrl, scale: 2.5, offsetX: 0, offsetY: 0, rotation: 0, roughness: 1, metalness: 0, opacity: 1, color: '#ffffff' } };
    });
  };

  const removeTexture = () => {
    if (!selectedPart) return;
    setActiveTexture(null);
    setPartTextures(prev => {
      const config = prev[selectedPart.id];
      if (!config) return prev;
      return { ...prev, [selectedPart.id]: { ...config, url: '', normalUrl: '' } };
    });
  };

  const removeColor = () => {
    if (!selectedPart) return;
    setPartTextures(prev => {
      const config = prev[selectedPart.id];
      if (!config) return prev;
      return { ...prev, [selectedPart.id]: { ...config, color: '#ffffff' } };
    });
  };

  const handleColorPicked = (hex: string) => {
    if (selectedPart) {
      updateTextureConfig('color', hex);
      setIsPickingColor(false);
    }
  };

  const updateTextureConfig = (key: keyof TextureConfig, value: any) => {
      if (!selectedPart) return;
      setPartTextures(prev => {
          const config = prev[selectedPart.id] || { url: '', normalUrl: '', scale: 2.5, offsetX: 0, offsetY: 0, rotation: 0, roughness: 1, metalness: 0, opacity: 1 };
          return { ...prev, [selectedPart.id]: { ...config, [key]: value } };
      });
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsShareModalOpen(true);
    setIsGeneratingScreenshot(true);
    setTimeout(async () => {
        const dataUrl = await modelViewerRef.current?.captureComposition();
        setScreenshotUrl(dataUrl);
        setIsGeneratingScreenshot(false);
    }, 500);
  };

  const currentTextureConfig = selectedPart ? partTextures[selectedPart.id] : null;
  const currentColorHex = (currentTextureConfig?.color || '#ffffff').toUpperCase();

  const mappedTextureMap = useMemo(() => {
    const mapped: Record<string, TextureConfig | null> = {};
    Object.keys(partTextures).forEach(id => {
        const config = partTextures[id];
        if (config) mapped[id] = { ...config, scale: 3 + (config.scale * 1.4) };
        else mapped[id] = null;
    });
    return mapped;
  }, [partTextures]);

  useEffect(() => {
    if (selectedPart) {
      setIsPanelVisible(true);
      const currentUrl = partTextures[selectedPart.id]?.url;
      if (currentUrl) {
          const match = libraries.materials.find(t => t.url === currentUrl);
          setActiveTexture(match || null);
      } else {
          setActiveTexture(null);
      }
    }
  }, [selectedPart, partTextures, libraries]);

  const asideClasses = useMemo(() => {
    const base = "fixed z-[60] bg-white transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col overflow-visible shadow-[0_-15px_60px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]";
    let mobileState = "bottom-0 left-0 w-full h-[32dvh] rounded-t-[42px] md:rounded-none";
    
    if (selectedPart) mobileState += isPanelVisible ? " translate-y-0" : " translate-y-full";
    else mobileState += " translate-y-full";
    
    // 平板範圍 (768px ~ 1279px): 360px
    // 電腦範圍 (1280px 以上): 400px
    let desktopState = "md:top-0 md:bottom-0 md:right-0 md:left-auto md:h-full md:w-[320px] xl:w-[400px] md:border-l md:border-gray-50 md:translate-y-0";
    if (selectedPart) desktopState += isPanelVisible ? " md:translate-x-0" : " md:translate-x-full";
    else desktopState += " md:translate-x-full";
    
    return `${base} ${mobileState} ${desktopState}`;
  }, [selectedPart, isPanelVisible]);

  return (
    <div className="flex flex-col h-[100dvh] bg-white text-[#1a1a1a] overflow-hidden font-sans">
      
      {orientationError && (
        <div className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500">
          <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-8 animate-pulse">
            {orientationError === 'mobile-portrait' ? <Smartphone size={48} className="text-indigo-600 rotate-90" /> : <Monitor size={48} className="text-indigo-600" />}
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tighter mb-4">{orientationError === 'mobile-portrait' ? 'Please Rotate to Portrait' : 'Please Rotate to Landscape'}</h2>
          <p className="text-sm text-gray-500 font-medium max-w-xs leading-relaxed">{orientationError === 'mobile-portrait' ? 'This mobile experience is optimized for portrait view.' : 'This tablet experience is optimized for landscape view.'}</p>
        </div>
      )}

      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 bg-black text-white rounded-full text-[10px] font-black tracking-[0.3em] uppercase animate-in slide-in-from-top-8 duration-500 shadow-2xl">
          {toast}
        </div>
      )}

      <div className="relative flex-1">
        <nav className="absolute top-8 left-1/2 -translate-x-1/2 z-[50] flex items-center p-1.5 bg-white/60 backdrop-blur-2xl border border-white/50 rounded-full shadow-[0_15px_50px_rgba(0,0,0,0.06)]">
          {MODELS.map((model, idx) => (
            <button
              key={model.id}
              onClick={() => handleModelSwitch(idx)}
              className={`px-5 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.2em] transition-all duration-300 relative ${activeModelIndex === idx ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {model.name}
              {activeModelIndex === idx && <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-600 rounded-full animate-pulse"></span>}
            </button>
          ))}
          <div className="w-[1px] h-4 bg-gray-300/50 mx-1"></div>
          <button
            onClick={(e) => { e.stopPropagation(); setAutoRotate(!autoRotate); }}
            className={`w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300 ${autoRotate ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
            title="Toggle Auto Rotate"
          >
            <RotateCw size={15} className={autoRotate ? 'animate-spin' : ''} style={{ animationDuration: '3s' }} />
          </button>
        </nav>

        <main className="fixed inset-0 z-0 bg-[#f8f9fa]">
           <ModelViewer 
             ref={modelViewerRef} 
             url={currentModel.url!} 
             modelId={currentModel.id}
             modelScale={isMobileView ? currentModel.scale * 0.5 : currentModel.scale} 
             modelRotation={currentModel.rotation}
             modelPosition={currentModel.position}
             selectedPart={selectedPart} 
             onPartSelect={setSelectedPart}
             textureMap={mappedTextureMap} 
             activeTexture={activeTexture}
             envPreset="studio" 
             envIntensity={envIntensity / 10} 
             envRotation={envRotation} 
             dirLightRotation={104}
             shadowBlur={0.25}
             shadowNormalBias={0.4}
             autoRotate={autoRotate}
             isPickingColor={isPickingColor}
             onColorPicked={handleColorPicked}
           />

           {(!selectedPart) && (
             <div className="absolute inset-0 flex items-end justify-center pb-[max(6rem,18dvh)] pointer-events-none animate-in fade-in zoom-in-95 duration-700">
               <div className="flex flex-col items-center gap-4">
                  <div className="w-14 h-14 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-2xl border border-white animate-bounce">
                    <MousePointer2 size={28} className="text-indigo-600" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400 drop-shadow-sm">Select Part to customize</span>
               </div>
             </div>
           )}
        </main>

        <aside className={asideClasses} onClick={(e) => e.stopPropagation()}>
            {selectedPart && (
              <button 
                onClick={(e) => { e.stopPropagation(); setIsPanelVisible(!isPanelVisible); }}
                className="hidden md:flex absolute top-1/2 -translate-y-1/2 -left-10 z-50 items-center justify-center w-10 h-24 bg-white border border-gray-100 shadow-[-10px_0_30px_rgba(0,0,0,0.08)] rounded-l-2xl transition-all duration-500 hover:bg-gray-50 text-gray-400 hover:text-indigo-600"
              >
                {isPanelVisible ? <ChevronRight size={20} strokeWidth={3} /> : <ChevronLeft size={20} strokeWidth={3} />}
              </button>
            )}

            {selectedPart && (
              <div className="md:hidden absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full px-2">
                 <button 
                  onClick={(e) => { e.stopPropagation(); setIsPanelVisible(!isPanelVisible); }}
                  className="w-20 h-10 bg-white border-t border-x border-gray-100 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] rounded-t-2xl flex items-center justify-center text-gray-400 hover:text-indigo-600 transition-all duration-500"
                >
                   {isPanelVisible ? <ChevronDown size={20} strokeWidth={3} /> : <ChevronUp size={20} strokeWidth={3} />}
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-10 pt-8 md:px-7 md:pt-12 md:pb-10 flex flex-col h-full">
                <div className="flex-1 space-y-10 md:space-y-12">
                    {selectedPart ? (
                        <div key={selectedPart.id} className="space-y-10 md:space-y-12 animate-in fade-in slide-in-from-bottom-8 md:slide-in-from-right-10 duration-700">
                            
                            {/* 材料庫部分 */}
                            {isLibrarySupported(selectedPart.name) && (
                              <section>
                                  <div className="flex justify-between items-center mb-5 px-1">
                                      <div className="flex flex-col gap-1.5">
                                          <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-900 leading-none">Library</h3>
                                          <div className="w-8 h-[2px] bg-indigo-600 rounded-full"></div>
                                      </div>
                                      <button onClick={removeTexture} className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Remove Texture">
                                          <X size={18} strokeWidth={3} />
                                      </button>
                                  </div>
                                  <div className="grid grid-cols-4 gap-2 md:gap-3 px-1">
                                      {libraries.materials.map(t => (
                                          <button key={t.id} onClick={(e) => { e.stopPropagation(); applyTexture(t); }} className={`aspect-square rounded-[22px] overflow-hidden transition-all border-2 group ${currentTextureConfig?.url === t.url ? 'border-indigo-600 scale-[0.98] shadow-xl shadow-indigo-100/30' : 'border-transparent bg-gray-50 hover:border-gray-100'}`}>
                                              <img src={t.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={t.name} />
                                          </button>
                                      ))}
                                  </div>
                              </section>
                            )}

                            {/* 專業級檢色器部分 */}
                            <section>
                                <div className="flex justify-between items-center mb-6 px-1">
                                    <div className="flex flex-col gap-1.5">
                                        <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-900 leading-none">Spectrum</h3>
                                        <div className="w-8 h-[2px] bg-indigo-600 rounded-full"></div>
                                    </div>
                                    <button onClick={removeColor} className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Remove Color">
                                        <X size={18} strokeWidth={3} />
                                    </button>
                                </div>
                                <div className="px-1">
                                    <ProColorPicker 
                                      color={currentColorHex} 
                                      onChange={(hex) => updateTextureConfig('color', hex)}
                                      onLiveChange={(hex) => {
                                          window.dispatchEvent(new CustomEvent('preview-part-color', { 
                                              detail: { partId: selectedPart.id, color: hex } 
                                          }));
                                      }}
                                      isPickingColor={isPickingColor}
                                      onTogglePick={() => setIsPickingColor(!isPickingColor)}
                                    />
                                </div>
                            </section>

                            {/* 環境設定部分 */}
                            <section>
                                 <div className="flex flex-col gap-1.5 mb-5 px-1">
                                    <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-gray-900 leading-none">Atmosphere</h3>
                                    <div className="w-8 h-[2px] bg-indigo-600 rounded-full"></div>
                                </div>
                                <div className="space-y-10 px-1">
                                    <div className="space-y-4">
                                        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-gray-400">
                                            <span>Brightness</span>
                                            <span className="text-indigo-600">{envIntensity.toFixed(1)}</span>
                                        </div>
                                        <input type="range" min="0" max="5" step="0.1" value={envIntensity} onChange={(e) => { e.stopPropagation(); setEnvIntensity(parseFloat(e.target.value)); }} className="w-full accent-indigo-600 h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer" />
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-gray-400">
                                            <span>Sun Rotation</span>
                                            <span className="text-indigo-600">{Math.round(envRotation)}°</span>
                                        </div>
                                        <input type="range" min="0" max="360" step="1" value={envRotation} onChange={(e) => { e.stopPropagation(); setEnvRotation(parseFloat(e.target.value)); }} className="w-full accent-indigo-600 h-1.5 bg-gray-100 rounded-full appearance-none cursor-pointer" />
                                    </div>
                                </div>
                            </section>
                        </div>
                    ) : null}
                </div>

                <div className="mt-8 pt-8 border-t border-gray-100 shrink-0">
                    <button onClick={handleShare} className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-black text-white rounded-[24px] text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-gray-800 active:scale-95 shadow-lg shadow-black/10">
                        <Share2 size={16} /> <span>Share Design</span>
                    </button>
                </div>
            </div>
          </aside>
      </div>

       {isShareModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/95 backdrop-blur-md p-4 animate-in fade-in duration-500" onClick={(e) => e.stopPropagation()}>
            <div className="w-full max-w-4xl animate-in zoom-in-95 duration-500">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-4xl font-black tracking-tighter uppercase leading-none">The Masterpiece</h2>
                        <p className="text-[10px] text-indigo-500 font-black tracking-[0.5em] uppercase mt-2">Captured in Ultra High Definition</p>
                    </div>
                    <button onClick={() => setIsShareModalOpen(false)} className="p-4 hover:bg-gray-100 rounded-full transition-all text-gray-400 active:scale-90"><X size={28}/></button>
                </div>
                <div className="space-y-10">
                    {isGeneratingScreenshot ? (
                        <div className="aspect-video bg-gray-50 rounded-[40px] flex flex-col items-center justify-center space-y-6">
                            <div className="w-16 h-16 border-[6px] border-indigo-50 border-t-indigo-600 rounded-full animate-spin"></div>
                            <p className="text-[12px] font-black tracking-[0.4em] uppercase text-gray-400">Synthesizing Pixels...</p>
                        </div>
                    ) : (
                        <>
                            <div className="rounded-[40px] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.1)] border-[12px] border-white bg-white">
                                <img src={screenshotUrl!} className="w-full h-auto" alt="Final Design" />
                            </div>
                            <div className="flex justify-center">
                                <a href={screenshotUrl!} download="design-render.png" className="flex items-center gap-4 bg-transparent text-black border border-black px-12 py-6 rounded-[30px] font-black text-xs uppercase tracking-[0.2em] transition-all hover:bg-black hover:text-white active:scale-95 shadow-xl">
                                    <Download size={20} /> Download UHD Image
                                </a>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;