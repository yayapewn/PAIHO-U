
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Upload, X, RotateCw, Share2, Download, ChevronUp, ChevronDown, Menu } from 'lucide-react';
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
  
  const [isPanelExpanded, setIsPanelExpanded] = useState(true);

  const modelViewerRef = useRef<any>(null);

  const handleTextureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) return alert('Invalid image file.');
      if (file.size > 5 * 1024 * 1024) return alert('File too large (>5MB).');

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
        ...prev, 
        [selectedPart.id]: { url: texture.url, scale: 2.5, offsetX: 0, offsetY: 0, rotation: 0, roughness: 1, metalness: 0, opacity: 1 } 
      };
    });
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

  // Open panel when a part is selected on mobile
  useEffect(() => {
    if (selectedPart) setIsPanelExpanded(true);
  }, [selectedPart]);

  return (
    <div className="flex flex-col h-screen bg-[#f8f9fa] text-[#1a1a1a] overflow-hidden">
      {/* Navigation Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-100 shrink-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-black tracking-tighter uppercase leading-none">
            PAIHO <span className="text-indigo-600">:</span> U
          </h1>
          <span className="hidden sm:inline-block text-[9px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full tracking-widest">V3.5.0</span>
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
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold transition-all hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-100"
            >
                <Share2 size={14} /> <span>Share</span>
            </button>
            <button 
                onClick={() => setAutoRotate(!autoRotate)} 
                className={`p-2 rounded-lg border text-sm transition ${autoRotate ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-100 hover:bg-gray-50'}`}
            >
                <RotateCw size={16} className={autoRotate ? 'animate-spin' : ''} />
            </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Main Canvas Area */}
        <main className="flex-1 relative bg-[#f8f9fa]">
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
        </main>

        {/* Customization Sidebar / Bottom Sheet */}
        <aside className={`
          fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 shadow-[0_-20px_40px_rgba(0,0,0,0.05)] transition-transform duration-500 ease-in-out
          lg:static lg:w-[380px] lg:h-full lg:border-l lg:border-t-0 lg:translate-y-0
          ${isPanelExpanded ? 'translate-y-0' : 'translate-y-[calc(100%-48px)]'}
          flex flex-col
        `}>
            {/* Mobile Drag Handle / Toggle */}
            <div className="lg:hidden flex items-center justify-center h-12 border-b border-gray-50 cursor-pointer" onClick={() => setIsPanelExpanded(!isPanelExpanded)}>
               {isPanelExpanded ? <ChevronDown size={20} className="text-gray-300" /> : <ChevronUp size={20} className="text-gray-300" />}
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-6 lg:p-8 space-y-8 h-[60vh] lg:h-auto">
                {!selectedPart ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 animate-in fade-in duration-500">
                        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mb-2">
                           <Menu size={24} className="text-gray-200" />
                        </div>
                        <div>
                            <p className="text-sm font-black text-gray-900">Customize Part</p>
                            <p className="text-[11px] text-gray-400 mt-1 max-w-[220px] mx-auto leading-relaxed">
                                Click directly on any part of the 3D model to begin customization.
                            </p>
                        </div>
                    </div>
                ) : (
                    <div key={selectedPart.id} className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center justify-between pb-4 border-b border-gray-50">
                            <div>
                                <p className="text-[9px] uppercase tracking-widest text-indigo-500 font-bold mb-0.5">Customizing</p>
                                <h2 className="text-xl font-black">{selectedPart.name}</h2>
                            </div>
                            <button onClick={() => setSelectedPart(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"><X size={18}/></button>
                        </div>

                        {/* Material Grid */}
                        {(visibleLibs.vamp || visibleLibs.label) && (
                            <section>
                                <div className="flex justify-between items-center mb-4 px-1">
                                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Library</h3>
                                    <label className="text-[9px] cursor-pointer text-indigo-500 hover:underline flex items-center gap-1 font-bold uppercase">
                                        <Upload size={10}/> Upload
                                        <input type="file" className="hidden" onChange={handleTextureUpload} />
                                    </label>
                                </div>
                                <div className="grid grid-cols-4 gap-3">
                                    {(visibleLibs.vamp ? libraries.vamp : libraries.label).map(t => (
                                        <button 
                                            key={t.id} 
                                            onClick={() => applyTexture(t)} 
                                            className={`aspect-square rounded-xl border-2 overflow-hidden transition-all transform active:scale-95 ${currentTextureConfig?.url === t.url ? 'border-indigo-600 ring-2 ring-indigo-50 ring-offset-1' : 'border-transparent bg-gray-50 hover:border-gray-200'}`}
                                        >
                                            <img src={t.url} className="w-full h-full object-cover" alt={t.name} />
                                        </button>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Color Picker */}
                        {visibleLibs.shoelace && (
                            <section>
                                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">Color</h3>
                                <div className="bg-gray-50 p-5 rounded-2xl flex items-center gap-5 border border-gray-100">
                                    <div className="relative w-12 h-12 rounded-xl overflow-hidden shadow-sm border border-gray-200">
                                        <input 
                                            type="color" 
                                            value={currentColorHex} 
                                            onChange={(e) => updateTextureConfig('color', e.target.value)} 
                                            className="absolute inset-0 w-[200%] h-[200%] -translate-x-1/4 -translate-y-1/4 cursor-pointer" 
                                        />
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-[9px] text-gray-400 uppercase font-bold tracking-widest">Hex Code</p>
                                        <p className="text-lg font-black text-indigo-600 uppercase tracking-tighter">{currentColorHex}</p>
                                    </div>
                                </div>
                            </section>
                        )}

                        {/* Controls */}
                        {currentTextureConfig && !visibleLibs.shoelace && (
                            <section className="pt-4 border-t border-gray-50 space-y-4">
                                <div className="flex justify-between items-center px-1">
                                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Scaling</h3>
                                    <span className="text-[10px] font-bold text-indigo-600">{currentTextureConfig.scale.toFixed(1)}x</span>
                                </div>
                                <input 
                                    type="range" min="0" max="5" step="0.1" 
                                    value={currentTextureConfig.scale} 
                                    onChange={(e) => updateTextureConfig('scale', parseFloat(e.target.value))} 
                                    className="w-full accent-indigo-600 h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer" 
                                />
                            </section>
                        )}
                    </div>
                )}

                {/* Environment Global Settings */}
                <div className="pt-10 mt-6 border-t border-gray-50">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-6">Environment</h3>
                    <div className="space-y-6 bg-gray-50/50 p-6 rounded-2xl border border-gray-50">
                        <div className="space-y-3">
                            <div className="flex justify-between text-[10px] font-bold uppercase text-gray-400">
                                <span>Intensity</span>
                                <span className="text-indigo-600">{envIntensity.toFixed(1)}</span>
                            </div>
                            <input type="range" min="0" max="5" step="0.1" value={envIntensity} onChange={(e) => setEnvIntensity(parseFloat(e.target.value))} className="w-full accent-indigo-600 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between text-[10px] font-bold uppercase text-gray-400">
                                <span>Light Angle</span>
                                <span className="text-indigo-600">{Math.round(envRotation)}°</span>
                            </div>
                            <input type="range" min="0" max="360" step="1" value={envRotation} onChange={(e) => setEnvRotation(parseFloat(e.target.value))} className="w-full accent-indigo-600 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer" />
                        </div>
                    </div>
                </div>
            </div>
          </aside>
      </div>

       {/* Share Modal */}
       {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[32px] w-full max-w-4xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">
                <div className="flex items-center justify-between p-8 border-b border-gray-50">
                    <div>
                        <h2 className="text-2xl font-black tracking-tight">Design Preview</h2>
                        <p className="text-[9px] text-gray-400 font-bold tracking-[0.3em] uppercase mt-1">Rendered Snapshot v1.0</p>
                    </div>
                    <button onClick={() => setIsShareModalOpen(false)} className="p-3 hover:bg-gray-100 rounded-full transition-all text-gray-400 hover:text-gray-900"><X size={24}/></button>
                </div>
                <div className="p-8">
                    {isGeneratingScreenshot ? (
                        <div className="h-[350px] flex flex-col items-center justify-center text-gray-400 space-y-6">
                            <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-100 border-t-indigo-600"></div>
                            <p className="text-xs font-bold tracking-widest uppercase">Capturing Multiside Render...</p>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                                <img src={screenshotUrl!} className="w-full" alt="Render" />
                            </div>
                            <a href={screenshotUrl!} download="design-export.png" className="w-full flex justify-center items-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-100 active:scale-[0.98]">
                                <Download size={18} /> Download HD Image
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
