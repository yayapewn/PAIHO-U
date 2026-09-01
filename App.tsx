import React, { useState, useRef, useEffect, useMemo } from 'react';
import { X, RotateCw, Share2, Download, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, MousePointer2, Smartphone, Monitor, Pipette, Code, Save, Copy, Trash2 } from 'lucide-react';
import ModelViewer from './components/ModelViewer';
import { TextureItem, SelectedPart, TextureConfig } from './types';

const UNIFORM_LINK = "https://www.paiho.com/tw/material-hub/b873383c1623dcffafd786ce755b2786";
const ENABLE_DEV_TOOLS = true;

const MODELS = [
  { 
    id: 'lace', 
    name: 'Lace-shoe', 
    url: 'https://huggingface.co/yayapewn/huggingface/resolve/main/lace-shoe.glb',
    wireframeUrl: 'https://huggingface.co/yayapewn/huggingface/resolve/main/lace-shoe-wire_compressed.glb',
    scale: 2,
    rotation: [0, Math.PI, 0] as [number, number, number],
    position: [0, 0, 0] as [number, number, number],
    initialEnvRotation: 280
  },
  { 
    id: 'traveler', 
    name: 'Traveler-shoe', 
    url: 'https://huggingface.co/yayapewn/huggingface/resolve/main/Traveler-shoe.glb',
    wireframeUrl: 'https://huggingface.co/yayapewn/huggingface/resolve/main/Traveler-shoe-wire_compressed.glb',
    scale: 1.53, 
    rotation: [-0.3, Math.PI * 2.5, 0] as [number, number, number], 
    position: [0, 0.03, 0] as [number, number, number], 
    initialEnvRotation: 280
  },
  { 
    id: 'dna', 
    name: 'D.N.A-shoe', 
    url: null,
    wireframeUrl: null,
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


// --- Additional Color Spaces ---
const rgbToXyz = (r: number, g: number, b: number) => {
  let [R, G, B] = [r / 255, g / 255, b / 255].map(v => v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92);
  R *= 100; G *= 100; B *= 100;
  return [R * 0.4124 + G * 0.3576 + B * 0.1805, R * 0.2126 + G * 0.7152 + B * 0.0722, R * 0.0193 + G * 0.1192 + B * 0.9505];
};

const xyzToLab = (x: number, y: number, z: number) => {
  let [X, Y, Z] = [x / 95.047, y / 100.0, z / 108.883].map(v => v > 0.008856 ? Math.pow(v, 1/3) : (7.787 * v) + (16 / 116));
  return [(116 * Y) - 16, 500 * (X - Y), 200 * (Y - Z)];
};

const rgbToLab = (r: number, g: number, b: number) => {
  const [x, y, z] = rgbToXyz(r, g, b);
  const [L, A, B] = xyzToLab(x, y, z);
  return { l: Math.round(L), a: Math.round(A), b: Math.round(B) };
};

const labToXyz = (l: number, a: number, b: number) => {
  let y = (l + 16) / 116;
  let x = a / 500 + y;
  let z = y - b / 200;
  [x, y, z] = [x, y, z].map(v => Math.pow(v, 3) > 0.008856 ? Math.pow(v, 3) : (v - 16 / 116) / 7.787);
  return [x * 95.047, y * 100.0, z * 108.883];
};

const xyzToRgb = (x: number, y: number, z: number) => {
  let [X, Y, Z] = [x / 100, y / 100, z / 100];
  let r = X * 3.2404542 + Y * -1.5371385 + Z * -0.4985314;
  let g = X * -0.9692660 + Y * 1.8760108 + Z * 0.0415560;
  let b = X * 0.0556434 + Y * -0.2040259 + Z * 1.0572252;
  [r, g, b] = [r, g, b].map(v => v > 0.0031308 ? 1.055 * Math.pow(v, 1 / 2.4) - 0.055 : 12.92 * v);
  return { 
    r: Math.max(0, Math.min(255, Math.round(r * 255))), 
    g: Math.max(0, Math.min(255, Math.round(g * 255))), 
    b: Math.max(0, Math.min(255, Math.round(b * 255))) 
  };
};

const labToRgb = (l: number, a: number, b: number) => {
  const [x, y, z] = labToXyz(l, a, b);
  return xyzToRgb(x, y, z);
};

const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
};

const hslToRgb = (h: number, s: number, l: number) => {
  let r, g, b;
  h /= 360; s /= 100; l /= 100;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
};
/**

 * 專業級直覺檢色器
 */
const ProColorPicker: React.FC<{ color: string, onChange: (hex: string) => void, onLiveChange?: (hex: string) => void, isPickingColor: boolean, onTogglePick: () => void }> = ({ color, onChange, onLiveChange, isPickingColor, onTogglePick }) => {
  const [hsv, setHsv] = useState(() => rgbToHsv(hexToRgb(color).r, hexToRgb(color).g, hexToRgb(color).b));
  
  type ColorMode = 'HEX' | 'RGB' | 'HSL' | 'LAB';
  const [colorMode, setColorMode] = useState<ColorMode>('HEX');
  const [inputText, setInputText] = useState(color);
  const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsModeDropdownOpen(false);
      }
    };
    if (isModeDropdownOpen) {
        document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isModeDropdownOpen]);

  const formatColorString = (hexString: string, mode: ColorMode) => {
    const rgb = hexToRgb(hexString);
    if (mode === 'HEX') return hexString.toUpperCase();
    if (mode === 'RGB') return `${rgb.r}, ${rgb.g}, ${rgb.b}`;
    if (mode === 'HSL') {
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      return `${hsl.h}, ${hsl.s}%, ${hsl.l}%`;
    }
    if (mode === 'LAB') {
      const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
      return `${lab.l}, ${lab.a}, ${lab.b}`;
    }
    return hexString;
  };

  
  const colorRef = useRef(color);
  const hsvRef = useRef(hsv);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setInputText(formatColorString(colorRef.current, colorMode));
  }, [colorMode]);

  useEffect(() => {
    if (colorRef.current !== color) {
       colorRef.current = color;
       setInputText(formatColorString(color, colorMode));
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
    
    setInputText(formatColorString(newHex, colorMode));
    
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
      <div className="flex gap-1 items-stretch bg-gray-100 border border-gray-200 rounded-[2px] overflow-hidden">
        {/* HS 調色盤 - 高度減少 1/3，使用 3:2 比例 */}
        <div 
          ref={hsRef}
          className="relative flex-1 aspect-[3/2] cursor-crosshair overflow-hidden touch-none"
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
          className="relative w-8 cursor-pointer touch-none border-l border-gray-200"
          style={{ 
              background: `linear-gradient(to bottom, ${rgbToHex(hsvToRgb(hsv.h, hsv.s, 100).r, hsvToRgb(hsv.h, hsv.s, 100).g, hsvToRgb(hsv.h, hsv.s, 100).b)}, #000)` 
          }}
          onPointerDown={handlePointerDownV}
        >
          <div 
            className="absolute left-0 w-full h-2 bg-white border-y border-gray-400 shadow-sm -translate-y-1/2 pointer-events-none"
            style={{ top: `${100 - hsv.v}%` }}
          ></div>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_0.8fr] gap-3 items-end">
          <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1 mb-1.5">
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">COLOR CODE</span>
                  <div className="relative flex items-center" ref={dropdownRef}>
                      <button 
                          onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
                          className="flex items-center justify-center gap-1 px-2 py-1 text-[9px] font-bold text-gray-500 bg-transparent outline-none cursor-pointer hover:text-indigo-600 hover:bg-gray-100 rounded-[2px] transition-all"
                      >
                          <span className="leading-none pt-[1px]">{colorMode}</span>
                          <ChevronDown size={10} strokeWidth={3} className={`transition-transform duration-300 ${isModeDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {isModeDropdownOpen && (
                          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 bg-white border border-gray-200 shadow-lg rounded-[2px] overflow-hidden z-[100] min-w-[72px] animate-in fade-in zoom-in-95 duration-200">
                              {(['HEX', 'RGB', 'HSL', 'LAB'] as ColorMode[]).map((mode) => (
                                  <button
                                      key={mode}
                                      onClick={() => {
                                          setColorMode(mode);
                                          setIsModeDropdownOpen(false);
                                      }}
                                      className={`w-full text-center px-3 py-2 text-[9px] font-bold tracking-widest transition-colors ${
                                          colorMode === mode 
                                              ? 'bg-indigo-50 text-indigo-600' 
                                              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                                      }`}
                                  >
                                      {mode}
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 border border-gray-200 focus-within:border-indigo-600 transition-all flex items-center h-[52px] rounded-[2px]">
                  <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => {
                        const val = e.target.value;
                        setInputText(val);
                        
                        let hexValue = '';
                        try {
                          if (colorMode === 'HEX') {
                            if (/^#[0-9A-Fa-f]{6}$/i.test(val)) hexValue = val.toUpperCase();
                          } else if (colorMode === 'RGB') {
                            const match = val.match(/^\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*$/);
                            if (match) {
                               const r = Math.min(255, Math.max(0, parseInt(match[1])));
                               const g = Math.min(255, Math.max(0, parseInt(match[2])));
                               const b = Math.min(255, Math.max(0, parseInt(match[3])));
                               hexValue = rgbToHex(r, g, b);
                            }
                          } else if (colorMode === 'HSL') {
                            const match = val.match(/^\s*(\d{1,3})\s*,\s*(\d{1,3})%?\s*,\s*(\d{1,3})%?\s*$/);
                            if (match) {
                               const h = Math.min(360, Math.max(0, parseInt(match[1])));
                               const s = Math.min(100, Math.max(0, parseInt(match[2])));
                               const l = Math.min(100, Math.max(0, parseInt(match[3])));
                               const rgb = hslToRgb(h, s, l);
                               hexValue = rgbToHex(rgb.r, rgb.g, rgb.b);
                            }
                          } else if (colorMode === 'LAB') {
                            const match = val.match(/^\s*(\d{1,3})\s*,\s*(-?\d{1,3})\s*,\s*(-?\d{1,3})\s*$/);
                            if (match) {
                               const l = Math.min(100, Math.max(0, parseInt(match[1])));
                               const a = Math.min(127, Math.max(-128, parseInt(match[2])));
                               const b = Math.min(127, Math.max(-128, parseInt(match[3])));
                               const rgb = labToRgb(l, a, b);
                               hexValue = rgbToHex(rgb.r, rgb.g, rgb.b);
                            }
                          }
                        } catch(err) {}

                        if (hexValue) {
                            if (onLiveChange) onLiveChange(hexValue);
                            onChange(hexValue);
                        }
                    }}
                    className="bg-transparent border-none outline-none w-full text-[13px] font-black uppercase tracking-tight text-gray-700" 
                  />
              </div>
          </div>
          <button 
            onClick={onTogglePick}
            className={`h-[52px] w-[52px] flex items-center justify-center transition-colors border rounded-[2px] ${isPickingColor ? 'bg-indigo-50 text-indigo-600 border-indigo-600' : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300 hover:text-indigo-600'}`}
            title="Pick color from 3D model"
          >
            <Pipette size={20} />
          </button>
          <div className="w-full h-[52px] bg-gray-50 overflow-hidden border border-gray-200 shadow-inner rounded-[2px]" style={{ backgroundColor: color }}></div>
      </div>
    </div>
  );
};

const DEFAULT_PART_CONFIGS: Record<string, TextureConfig> = {
  'traveler_Vamp': { url: GENERAL_TEXTURES[0].url, normalUrl: GENERAL_TEXTURES[0].normalUrl, scale: 2.14, offsetX: 0, offsetY: 0.1, rotation: 0, roughness: 1, metalness: 0, opacity: 1, color: '#ffffff', originalRoughness: 1 },
  'traveler_Heel Counter': { url: GENERAL_TEXTURES[1].url, normalUrl: GENERAL_TEXTURES[1].normalUrl, scale: 1.5, offsetX: 0.2, offsetY: -0.1, rotation: 0, roughness: 1, metalness: 0, opacity: 1, color: '#ffffff', originalRoughness: 1 }
};

const App: React.FC = () => {
  const [devConfigs, setDevConfigs] = useState<Record<string, any>>(() => {
    try {
      const saved = localStorage.getItem('paiho_dev_configs');
      return saved ? JSON.parse(saved) : {};
    } catch(e) { return {}; }
  });

  useEffect(() => {
    localStorage.setItem('paiho_dev_configs', JSON.stringify(devConfigs));
  }, [devConfigs]);

  const [activeModelIndex, setActiveModelIndex] = useState(0);
  const [libraries, setLibraries] = useState({ materials: GENERAL_TEXTURES });
  const [selectedPart, setSelectedPart] = useState<SelectedPart | null>(null);
  const [activeTexture, setActiveTexture] = useState<TextureItem | null>(null);
  const [envIntensity, setEnvIntensity] = useState<number>(1.5); 
  const [envRotation, setEnvRotation] = useState<number>(MODELS[0].initialEnvRotation); 
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [isPickingColor, setIsPickingColor] = useState<boolean>(false);
  const [partTextures, setPartTextures] = useState<Record<string, TextureConfig | null>>(DEFAULT_PART_CONFIGS);

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
    
    // 依據不同鞋款獨立設定禁用材質庫的部位
    let disabledParts: string[] = [];
    if (currentModel.id === 'traveler') {
      // TRAVELER 鞋款的 TONGUE 開放全客製化 (不在此名單)
      disabledParts = ['OBJECT011', 'MIDSOLE', 'LINE048', 'OBJECT019', 'TONGUE LABEL', 'QUARTER LABEL', 'TONGUE REINFORCEMENT', 'HEEL COLLAR REINFORCEMENT', 'EYELET', 'HEEL STRAP', 'QUARTER OVERLAY', 'OUTSOLE'];
    } else if (currentModel.id === 'lace') {
      // LACE 鞋款的 TONGUE 為純色覆蓋模式 (在此名單)
      disabledParts = ['TONGUE', 'OBJECT011', 'MIDSOLE', 'LINE048', 'OBJECT019', 'TONGUE LABEL', 'QUARTER LABEL', 'TONGUE REINFORCEMENT', 'HEEL COLLAR REINFORCEMENT', 'EYELET', 'HEEL STRAP', 'QUARTER OVERLAY', 'OUTSOLE'];
    } else {
      disabledParts = ['OBJECT011', 'MIDSOLE', 'LINE048', 'OBJECT019', 'TONGUE LABEL', 'QUARTER LABEL', 'TONGUE REINFORCEMENT', 'HEEL COLLAR REINFORCEMENT', 'EYELET', 'HEEL STRAP', 'QUARTER OVERLAY', 'OUTSOLE'];
    }
    
    return !disabledParts.includes(name);
  };

  const applyTexture = (texture: TextureItem) => {
    if (!selectedPart || !isLibrarySupported(selectedPart.name)) return;
    setActiveTexture(texture);
    const partKey = `${currentModel.id}_${selectedPart.name}`;
    
    // 檢查是否有 Dev Tool 暫存的設定
    const savedConfig = devConfigs[partKey] || devConfigs[texture.url];
    const defaultScale = savedConfig ? savedConfig.scale : 2.5;
    const defaultOffsetX = savedConfig ? savedConfig.offsetX : 0;
    const defaultOffsetY = savedConfig ? savedConfig.offsetY : 0;

    setPartTextures(prev => {
      const existing = prev[partKey];
      const inheritedColor = existing?.color || '#ffffff'; // 繼承原本選定的顏色，若無則預設白色
      
      if (existing) return { ...prev, [partKey]: { ...existing, url: texture.url, normalUrl: texture.normalUrl, color: inheritedColor, scale: defaultScale, offsetX: defaultOffsetX, offsetY: defaultOffsetY } };
      return { ...prev, [partKey]: { url: texture.url, normalUrl: texture.normalUrl, scale: defaultScale, offsetX: defaultOffsetX, offsetY: defaultOffsetY, rotation: 0, roughness: 1, metalness: 0, opacity: 1, color: inheritedColor } };
    });
  };

  const removeTexture = () => {
    if (!selectedPart) return;
    setActiveTexture(null);
    const partKey = `${currentModel.id}_${selectedPart.name}`;
    setPartTextures(prev => {
      const config = prev[partKey];
      if (!config) return prev;
      return { ...prev, [partKey]: { ...config, url: '', normalUrl: '' } };
    });
  };

  const removeColor = () => {
    if (!selectedPart) return;
    const partKey = `${currentModel.id}_${selectedPart.name}`;
    setPartTextures(prev => {
      const config = prev[partKey];
      if (!config) return prev;
      return { ...prev, [partKey]: { ...config, color: '#ffffff' } };
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
      const partKey = `${currentModel.id}_${selectedPart.name}`;
      setPartTextures(prev => {
          const config = prev[partKey] || { url: '', normalUrl: '', scale: 2.5, offsetX: 0, offsetY: 0, rotation: 0, roughness: 1, metalness: 0, opacity: 1 };
          return { ...prev, [partKey]: { ...config, [key]: value } };
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

  const currentTextureConfig = selectedPart ? partTextures[`${currentModel.id}_${selectedPart.name}`] : null;
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
      const partKey = `${currentModel.id}_${selectedPart.name}`;
      const currentUrl = partTextures[partKey]?.url;
      if (currentUrl) {
          const match = libraries.materials.find(t => t.url === currentUrl);
          setActiveTexture(match || null);
      } else {
          setActiveTexture(null);
      }
    }
  }, [selectedPart, partTextures, libraries]);

  const asideClasses = useMemo(() => {
    const base = "fixed z-[60] bg-white transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] flex flex-col overflow-visible pb-[env(safe-area-inset-bottom)]";
    let mobileState = "bottom-0 left-0 w-full h-[32dvh] md:rounded-none border-t border-gray-200";
    
    if (selectedPart) mobileState += isPanelVisible ? " translate-y-0" : " translate-y-full";
    else mobileState += " translate-y-full";
    
    // 平板範圍 (768px ~ 1279px): 360px
    // 電腦範圍 (1280px 以上): 400px
    let desktopState = "md:top-0 md:bottom-0 md:right-0 md:left-auto md:h-full md:w-[320px] xl:w-[400px] md:border-t-0 md:border-l md:border-gray-200 md:translate-y-0";
    if (selectedPart) desktopState += isPanelVisible ? " md:translate-x-0 md:shadow-[-20px_0_40px_rgba(0,0,0,0.03)]" : " md:translate-x-full";
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
        <nav className="absolute top-8 left-1/2 -translate-x-1/2 z-[50] flex items-center p-2 bg-transparent backdrop-blur-[2px] border-b border-gray-200/50">
          {MODELS.map((model, idx) => (
            <button
              key={model.id}
              onClick={() => handleModelSwitch(idx)}
              className={`px-6 py-2 text-[10px] uppercase tracking-[0.2em] transition-all duration-300 relative ${activeModelIndex === idx ? 'font-bold text-gray-900' : 'font-medium text-gray-400 hover:text-gray-600'}`}
            >
              {model.name}
              {activeModelIndex === idx && (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4 h-[1px] bg-gray-900"></div>
              )}
            </button>
          ))}
          <button
            onClick={(e) => { e.stopPropagation(); setAutoRotate(!autoRotate); }}
            className={`ml-4 p-2 transition-all duration-300 ${autoRotate ? 'text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
            title="Toggle Auto Rotate"
          >
            <RotateCw size={14} className={autoRotate ? 'animate-spin' : ''} style={{ animationDuration: '3s' }} />
          </button>
        </nav>

        <main className="fixed inset-0 z-0 bg-[#f8f9fa]">
           <ModelViewer 
             ref={modelViewerRef} 
             url={currentModel.url!} 
             wireframeUrl={currentModel.wireframeUrl}
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

           {ENABLE_DEV_TOOLS && selectedPart && activeTexture && (
               <div className="hidden xl:block absolute left-6 top-32 w-72 bg-white/95 backdrop-blur-md border border-indigo-100 rounded-2xl shadow-2xl p-5 z-50 animate-in fade-in slide-in-from-left-4">
                   <div className="flex items-center justify-between mb-4">
                       <h3 className="text-[11px] font-black tracking-widest text-indigo-900 uppercase flex items-center gap-1.5"><Code size={14}/> Dev UV Tool</h3>
                       <span className="text-[9px] font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">DEV MODE</span>
                   </div>
                   
                   <div className="space-y-4 mb-5">
                       {activeTexture && (
                           <>
                               <div>
                                   <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
                                       <span>SCALE (縮放)</span>
                                       <span className="text-indigo-600">{partTextures[`${currentModel.id}_${selectedPart.name}`]?.scale.toFixed(2) || '2.50'}</span>
                                   </div>
                                   <input type="range" min="0.1" max="10" step="0.05" value={partTextures[`${currentModel.id}_${selectedPart.name}`]?.scale || 2.5} onChange={(e) => updateTextureConfig('scale', parseFloat(e.target.value))} className="w-full accent-indigo-600 h-[2px] bg-gray-200/80 rounded-full appearance-none cursor-pointer" />
                               </div>
                               <div>
                                   <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
                                       <span>OFFSET X (水平偏移)</span>
                                       <span className="text-indigo-600">{partTextures[`${currentModel.id}_${selectedPart.name}`]?.offsetX.toFixed(2) || '0.00'}</span>
                                   </div>
                                   <input type="range" min="-2" max="2" step="0.01" value={partTextures[`${currentModel.id}_${selectedPart.name}`]?.offsetX || 0} onChange={(e) => updateTextureConfig('offsetX', parseFloat(e.target.value))} className="w-full accent-indigo-600 h-[2px] bg-gray-200/80 rounded-full appearance-none cursor-pointer" />
                               </div>
                               <div>
                                   <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
                                       <span>OFFSET Y (垂直偏移)</span>
                                       <span className="text-indigo-600">{partTextures[`${currentModel.id}_${selectedPart.name}`]?.offsetY.toFixed(2) || '0.00'}</span>
                                   </div>
                                   <input type="range" min="-2" max="2" step="0.01" value={partTextures[`${currentModel.id}_${selectedPart.name}`]?.offsetY || 0} onChange={(e) => updateTextureConfig('offsetY', parseFloat(e.target.value))} className="w-full accent-indigo-600 h-[2px] bg-gray-200/80 rounded-full appearance-none cursor-pointer" />
                               </div>
                           </>
                       )}
                   </div>

                   <div className="space-y-2">
                       <button 
                           onClick={(e) => {
                               e.stopPropagation();
                               const partKey = `${currentModel.id}_${selectedPart.name}`;
                               const conf = partTextures[partKey];
                               if(conf) {
                                   setDevConfigs(prev => ({
                                       ...prev, 
                                       [partKey]: {
                                           partKey: partKey,
                                           colorUrl: activeTexture?.url || '',
                                           normalUrl: activeTexture?.normalUrl || '',
                                           scale: conf.scale,
                                           offsetX: conf.offsetX,
                                           offsetY: conf.offsetY,
                                           originalRoughness: conf.originalRoughness
                                       }
                                   }));
                                   setToast("Saved to LocalStorage!");
                                   setTimeout(() => setToast(null), 2000);
                               }
                           }}
                           className="w-full bg-indigo-50 text-indigo-600 font-bold text-[11px] py-2.5 rounded-lg hover:bg-indigo-100 flex items-center justify-center gap-1.5 transition-colors pointer-events-auto"
                       >
                           <Save size={14} /> 暫存此貼圖設定
                       </button>
                       
                       <button 
                           onClick={(e) => {
                               e.stopPropagation();
                               const configArray = Object.values(devConfigs);
                               if(configArray.length === 0) {
                                   setToast("沒有暫存任何資料");
                                   setTimeout(() => setToast(null), 2000);
                                   return;
                               }
                               const jsonStr = JSON.stringify(configArray, null, 2);
                               navigator.clipboard.writeText(jsonStr);
                               setToast("已複製大禮包 JSON !");
                               setTimeout(() => setToast(null), 2000);
                           }}
                           className="w-full bg-slate-900 text-white font-bold text-[11px] py-2.5 rounded-lg hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-colors shadow-md pointer-events-auto"
                       >
                           <Copy size={14} /> 匯出所有暫存 (JSON)
                       </button>

                       <button 
                           onClick={(e) => {
                               e.stopPropagation();
                               setDevConfigs({});
                               localStorage.removeItem('paiho_dev_configs');
                               setToast("已清空暫存");
                               setTimeout(() => setToast(null), 2000);
                           }}
                           className="w-full bg-red-50 text-red-500 font-bold text-[11px] py-2 rounded-lg hover:bg-red-100 flex items-center justify-center gap-1.5 transition-colors mt-2 pointer-events-auto"
                       >
                           <Trash2 size={13} /> 清空暫存
                       </button>
                   </div>
               </div>
           )}

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
                className="hidden md:flex absolute top-1/2 -translate-y-1/2 -left-10 z-50 items-center justify-center w-10 h-24 bg-white border border-gray-200 border-r-0 shadow-[-4px_0_12px_rgba(0,0,0,0.05)] rounded-l-[2px] transition-all duration-500 hover:bg-gray-50 text-gray-400 hover:text-indigo-600"
              >
                {isPanelVisible ? <ChevronRight size={20} strokeWidth={3} /> : <ChevronLeft size={20} strokeWidth={3} />}
              </button>
            )}

            {selectedPart && (
              <div className="md:hidden absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full px-2">
                 <button 
                  onClick={(e) => { e.stopPropagation(); setIsPanelVisible(!isPanelVisible); }}
                  className="w-20 h-10 bg-white border-t border-x border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] rounded-t-[2px] flex items-center justify-center text-gray-400 hover:text-indigo-600 transition-all duration-500"
                >
                   {isPanelVisible ? <ChevronDown size={20} strokeWidth={3} /> : <ChevronUp size={20} strokeWidth={3} />}
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col h-full">
                <div className="px-6 pb-10 pt-8 md:px-7 md:pt-12 md:pb-10 flex-1 space-y-10 md:space-y-12">
                    {selectedPart ? (
                        <div key={selectedPart.id} className="space-y-10 md:space-y-12 animate-in fade-in slide-in-from-bottom-8 md:slide-in-from-right-10 duration-700">
                            
                            {/* 材料庫部分 */}
                            {isLibrarySupported(selectedPart.name) && (
                              <section>
                                  <div className="flex justify-between items-center mb-5 px-1">
                                      <div className="flex flex-col gap-1.5">
                                          <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-gray-900 leading-none">Library</h3>
                                          <div className="w-8 h-[2px] bg-indigo-600 rounded-full"></div>
                                      </div>
                                  </div>
                                  <div className="grid grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-[2px] border border-gray-200 bg-white rounded-[2px] overflow-hidden">
                                      {libraries.materials.map(t => (
                                          <button key={t.id} onClick={(e) => { e.stopPropagation(); applyTexture(t); }} className={`aspect-square overflow-hidden transition-all relative group bg-white ${currentTextureConfig?.url === t.url ? 'ring-[3px] ring-inset ring-indigo-600 z-10' : 'hover:opacity-90'}`}>
                                              <img src={t.url} className="w-full h-full object-cover transition-transform duration-700" alt={t.name} />
                                          </button>
                                      ))}
                                  </div>
                              </section>
                            )}

                            {/* 專業級檢色器部分 */}
                            <section>
                                <div className="flex justify-between items-center mb-6 px-1">
                                    <div className="flex flex-col gap-1.5">
                                        <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-gray-900 leading-none">Spectrum</h3>
                                        <div className="w-8 h-[2px] bg-indigo-600 rounded-full"></div>
                                    </div>
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
                                    <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-gray-900 leading-none">Atmosphere</h3>
                                    <div className="w-8 h-[2px] bg-indigo-600 rounded-full"></div>
                                </div>
                                <div className="space-y-10 px-1">
                                    <div className="space-y-4">
                                        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-gray-400">
                                            <span>Brightness</span>
                                            <span className="text-indigo-600">{envIntensity.toFixed(1)}</span>
                                        </div>
                                        <input type="range" min="0" max="5" step="0.1" value={envIntensity} onChange={(e) => { e.stopPropagation(); setEnvIntensity(parseFloat(e.target.value)); }} className="w-full accent-indigo-600 h-[2px] bg-gray-200/80 rounded-full appearance-none cursor-pointer" />
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-gray-400">
                                            <span>Sun Rotation</span>
                                            <span className="text-indigo-600">{Math.round(envRotation)}°</span>
                                        </div>
                                        <input type="range" min="0" max="360" step="1" value={envRotation} onChange={(e) => { e.stopPropagation(); setEnvRotation(parseFloat(e.target.value)); }} className="w-full accent-indigo-600 h-[2px] bg-gray-200/80 rounded-full appearance-none cursor-pointer" />
                                    </div>
                                </div>
                            </section>
                        </div>
                    ) : null}
                </div>

                <div className="border-t border-gray-200 shrink-0 mt-auto bg-black">
                    <button onClick={handleShare} className="w-full flex items-center justify-center gap-3 px-6 py-5 bg-black text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all hover:bg-gray-900 active:scale-[0.98]">
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