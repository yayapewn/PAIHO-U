import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, RotateCw, Share2, Download, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, MousePointer2 } from 'lucide-react';
import ModelViewer from './components/ModelViewer';
import { TextureItem, SelectedPart, TextureConfig } from './types';

// Mock Data
const VAMP_TEXTURES: TextureItem[] = [
  { id: 'v1', name: 'Fine Fabric 01', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000601%20A%20WP_BASE.jpg' },
  { id: 'v2', name: 'Woven Fabric 02', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000716%20A%20WP_BASE.jpg' },
  { id: 'v3', name: 'Tech Mesh 03', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000820%20J%20WP_BASE.jpg' },
  { id: 'v4', name: 'Durable 04', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01305-01A-000A_BASE.jpg' },
  { id: 'v5', name: 'Breathable 05', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01317-01A-000A_BASE.jpg' },
  { id: 'v6', name: 'Digital 06', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01436-01A-000A_BASE.jpg' },
];
const SHOELACE_TEXTURES: TextureItem[] = [
  { id: 's1', name: 'Lace Texture 01', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01305-01A-000A_BASE.jpg' },
  { id: 's2', name: 'Lace Texture 02', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000601%20A%20WP_BASE.jpg' },
  { id: 's3', name: 'Lace Texture 03', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01317-01A-000A_BASE.jpg' },
];
const LABEL_TEXTURES: TextureItem[] = [
  { id: 'l1', name: 'Leather', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000716%20A%20WP_BASE.jpg' },
  { id: 'l2', name: 'Carbon Fiber', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT01317-01A-000A_BASE.jpg' },
  { id: 'l3', name: 'Matte Finish', url: 'https://raw.githubusercontent.com/yayapewn/shoe-textures/main/EGT%2000820%20J%20WP_BASE.jpg' },
];

const App: React.FC = () => {
  const [libraries, setLibraries] = useState({ vamp: VAMP_TEXTURES, shoelace: SHOELACE_TEXTURES, label: LABEL_TEXTURES });
  const [selectedPart, setSelectedPart] = useState<SelectedPart | null>(null);
  const [envIntensity, setEnvIntensity] = useState<number>(1.5); 
  const [envRotation, setEnvRotation] = useState<number>(280); 
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [partTextures, setPartTextures] = useState<Record<string, TextureConfig | null>>({});

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [isGeneratingScreenshot, setIsGeneratingScreenshot] = useState(false);
  
  const [isPanelVisible, setIsPanelVisible] = useState(false);

  const modelViewerRef = useRef<any>(null);

  const handleTextureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) return alert('Invalid image file.');
      const url = URL.createObjectURL(file);
      setLibraries(prev => ({ 
          ...prev, 
          vamp: [{ id: crypto.randomUUID(), name: file.name, url }, ...prev.vamp] 
      }));
    }
  };

  const applyTexture = (texture: TextureItem) => {
    if (!selectedPart) return;
    setPartTextures(prev => {
      const existing = prev[selectedPart.id];
      if (existing) return { ...prev, [selectedPart.id]: { ...existing, url: texture.url } };
      return { 
        [selectedPart.id]: { url: texture.url, scale: 2.5, offsetX: 0, offsetY: 0, rotation: 0, roughness: 1, metalness: 0, opacity: 1 },
        ...prev
      };
    });
    
    if (window.innerWidth < 1024) {
      setTimeout(() => setIsPanelVisible(false), 300);
    }
  };

  const updateTextureConfig = (key: keyof TextureConfig, value: any) => {
      if (!selectedPart) return;
      setPartTextures(prev => {
          const config = prev[selectedPart.id] || { url: '', scale: 2.5, offsetX: 0, offsetY: 0, rotation: 0, roughness: 1, metalness: 0, opacity: 1 };
          return { ...prev, [selectedPart.id]: { ...config, [key]: value } };
      });
  };

  const currentTextureConfig = selectedPart ? partTextures[selectedPart.id] : null;
  const currentColorHex = currentTextureConfig?.color || '#ffffff';

  const mappedTextureMap = useMemo(() => {
    const mapped: Record<string, TextureConfig | null> = {};
    Object.keys(partTextures).forEach(id => {
        const config = partTextures[id];
        if (config) mapped[id] = { ...config, scale: 3 + (config.scale * 1.4) };
        else mapped[id] = null;
    });
    return mapped;
  }, [partTextures]);

  const visibleLibs = useMemo(() => {
    if (!selectedPart) return { vamp: false, shoelace: false, label: false };
    const name = selectedPart.name;
    return {
        vamp: name.includes('Shape027'),
        shoelace: name.includes('Shape026'),
        label: name.includes('Line040')
    };
  }, [selectedPart]);

  useEffect(() => {
    if (selectedPart) {
      setIsPanelVisible(true);
    }
  }, [selectedPart]);

  const asideClasses = useMemo(() => {
    const base = "absolute z-[60] bg-white transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col overflow-visible shadow-2xl";
    let mobileState = "bottom-0 left-0 w-full h-[60vh] rounded-t-[40px]";
    if (selectedPart) {
        mobileState += isPanelVisible ? " translate-y-0" : " translate-y-full";
    } else {
        mobileState += " translate-y-full";
    }
    let desktopState = "lg:top-0 lg:bottom-0 lg:right-0 lg:left-auto lg:h-full lg:w-[400px] lg:rounded-none lg:border-l lg:border-gray-50 lg:translate-y-0";
    if (selectedPart) {
        desktopState += isPanelVisible ? " lg:translate-x-0" : " lg:translate-x-full";
    } else {
        desktopState += " lg:translate-x-full";
    }
    return `${base} ${mobileState} ${desktopState}`;
  }, [selectedPart, isPanelVisible]);

  return (
    <div className="flex flex-col h-screen bg-white text-[#1a1a1a] overflow-hidden font-sans">
      <header className="flex items-center justify-between pl-8 pr-6 lg:pl-10 py-4 bg-white border-b border-gray-100 shrink-0 z-50">
        <div className="flex items-center gap-3">
          <h1 className="text-[20px] lg:text-[25px] font-black tracking-tighter uppercase leading-none">
            PAIHO <span className="text-indigo-600">:</span> U
          </h1>
        </div>
        <div className="flex items-center gap-3">
            <button 
                onClick={async () => {
                    setIsShareModalOpen(true);
                    setIsGeneratingScreenshot(true);
                    setTimeout(async () => {
                        const dataUrl = await modelViewerRef.current?.captureComposition();
                        setScreenshotUrl(dataUrl);
                        setIsGeneratingScreenshot(false);
                    }, 500);
                }} 
                className="flex items-center gap-2 px-4 py-2 bg-transparent text-black border border-black rounded-full text-xs font-black uppercase tracking-widest transition-all hover:bg-black hover:text-white active:scale-95 shadow-sm"
            >
                <Share2 size={14} /> <span className="hidden sm:inline">Share</span>
            </button>
            <button 
                onClick={() => setAutoRotate(!autoRotate)} 
                className={`flex items-center gap-2 px-4 py-2 border rounded-full text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm ${autoRotate ? 'bg-black border-black text-white' : 'bg-transparent border-black text-black hover:bg-black hover:text-white'}`}
            >
                <RotateCw size={14} className={autoRotate ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Rotate</span>
            </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <main className="absolute inset-0 z-0 bg-[#f8f9fa]">
           <ModelViewer 
             ref={modelViewerRef} 
             modelFile={null} 
             selectedPart={selectedPart} 
             onPartSelect={setSelectedPart}
             textureMap={mappedTextureMap} 
             envPreset="studio" 
             envIntensity={envIntensity / 10} 
             envRotation={envRotation} 
             dirLightRotation={104}
             shadowBlur={0.25}
             shadowNormalBias={0.2}
             autoRotate={autoRotate}
           />

           {(!selectedPart) && (
             <div className="absolute inset-0 flex items-end justify-center pb-[18vh] pointer-events-none animate-in fade-in zoom-in-95 duration-700">
               <div className="flex flex-col items-center gap-4">
                  <div className="w-14 h-14 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-2xl border border-white animate-bounce">
                    <MousePointer2 size={28} className="text-indigo-600" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-gray-400 drop-shadow-sm">Select Part to customize</span>
               </div>
             </div>
           )}
        </main>

        <aside className={asideClasses}>
            {selectedPart && (
              <button 
                onClick={() => setIsPanelVisible(!isPanelVisible)}
                className={`
                  hidden lg:flex absolute top-1/2 -translate-y-1/2 -left-10 z-50 items-center justify-center
                  w-10 h-24 bg-white border border-gray-100 shadow-[-10px_0_30px_rgba(0,0,0,0.08)] rounded-l-2xl transition-all duration-500
                  hover:bg-gray-50 text-gray-400 hover:text-indigo-600
                `}
              >
                {isPanelVisible ? <ChevronRight size={20} strokeWidth={3} /> : <ChevronLeft size={20} strokeWidth={3} />}
              </button>
            )}

            {selectedPart && (
              <button 
                onClick={() => setIsPanelVisible(!isPanelVisible)}
                className={`
                  lg:hidden absolute left-1/2 -translate-x-1/2 -top-10 z-[70] flex items-center justify-center
                  w-24 h-10 bg-white border border-gray-100 shadow-[0_-10px_30px_rgba(0,0,0,0.08)] rounded-t-2xl transition-all duration-500
                  text-gray-400 active:scale-90
                `}
              >
                {isPanelVisible ? <ChevronDown size={28} strokeWidth={3} /> : <ChevronUp size={28} strokeWidth={3} />}
              </button>
            )}

            <div className="flex-1 overflow-y-auto no-scrollbar px-8 pb-20 pt-10 lg:px-10 lg:py-8 space-y-12">
                {selectedPart ? (
                    <div key={selectedPart.id} className="space-y-10 animate-in fade-in slide-in-from-bottom-6 lg:slide-in-from-right-10 duration-700">
                        {(visibleLibs.vamp || visibleLibs.label) && (
                            <section>
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-900">Materials</h3>
                                    <label className="text-[10px] cursor-pointer text-indigo-600 font-black uppercase tracking-widest hover:underline px-4 py-1.5 border border-indigo-600 rounded-full hover:bg-indigo-600 hover:text-white transition-all">
                                        Upload <input type="file" className="hidden" onChange={handleTextureUpload} />
                                    </label>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    {(visibleLibs.vamp ? libraries.vamp : libraries.label).map(t => (
                                        <button 
                                            key={t.id} 
                                            onClick={() => applyTexture(t)} 
                                            className={`aspect-square rounded-2xl overflow-hidden transition-all border-2 group ${currentTextureConfig?.url === t.url ? 'border-indigo-600 scale-[0.98] shadow-lg' : 'border-transparent bg-gray-50 hover:border-gray-100'}`}
                                        >
                                            <img src={t.url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={t.name} />
                                        </button>
                                    ))}
                                </div>
                            </section>
                        )}
                        {visibleLibs.shoelace && (
                            <section>
                                <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-900 mb-6">Palette Selection</h3>
                                <div className="bg-gray-50 p-6 rounded-3xl flex items-center justify-between gap-6 border border-gray-100">
                                    <div className="flex items-center gap-6">
                                        <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-inner border-4 border-white">
                                            <input 
                                                type="color" 
                                                value={currentColorHex} 
                                                onChange={(e) => {
                                                  updateTextureConfig('color', e.target.value);
                                                }} 
                                                onBlur={() => {
                                                  if (window.innerWidth < 1024) setIsPanelVisible(false);
                                                }}
                                                className="absolute inset-0 w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer" 
                                            />
                                        </div>
                                        <div>
                                            <p className="text-[16px] font-black text-gray-900 uppercase tracking-tighter">{currentColorHex}</p>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-[0.1em] font-bold">Current Shade</p>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}
                        <div className="pt-6 border-t border-gray-50">
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-900 mb-8">Atmosphere</h3>
                            <div className="space-y-8 bg-gray-50 p-6 rounded-3xl border border-gray-100">
                                <div className="space-y-4">
                                    <div className="flex justify-between text-[10px] font-black uppercase text-gray-400">
                                        <span>Brightness</span>
                                        <span className="text-indigo-600">{envIntensity.toFixed(1)}</span>
                                    </div>
                                    <input type="range" min="0" max="5" step="0.1" value={envIntensity} onChange={(e) => setEnvIntensity(parseFloat(e.target.value))} className="w-full accent-black h-1 bg-gray-200 rounded-full appearance-none cursor-pointer" />
                                </div>
                                <div className="space-y-4">
                                    <div className="flex justify-between text-[10px] font-black uppercase text-gray-400">
                                        <span>Sun Rotation</span>
                                        <span className="text-indigo-600">{Math.round(envRotation)}°</span>
                                    </div>
                                    <input type="range" min="0" max="360" step="1" value={envRotation} onChange={(e) => setEnvRotation(parseFloat(e.target.value))} className="w-full accent-black h-1 bg-gray-200 rounded-full appearance-none cursor-pointer" />
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
          </aside>
      </div>

       {isShareModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/95 backdrop-blur-md p-4 animate-in fade-in duration-500">
            <div className="w-full max-w-4xl animate-in zoom-in-95 duration-500">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-4xl font-black tracking-tighter uppercase leading-none">The Masterpiece</h2>
                        <p className="text-[10px] text-indigo-500 font-black tracking-[0.5em] uppercase mt-2">Captured in Ultra High Definition</p>
                    </div>
                    <button onClick={() => setIsShareModalOpen(false)} className="p-4 hover:bg-gray-100 rounded-full transition-all text-gray-400 active:scale-90">
                        <X size={28}/>
                    </button>
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
                                <a href={screenshotUrl!} download="paiho-u-render.png" className="flex items-center gap-4 bg-transparent text-black border border-black px-12 py-6 rounded-full font-black text-xs uppercase tracking-[0.2em] transition-all hover:bg-black hover:text-white active:scale-95 shadow-xl">
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