import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Pipette } from 'lucide-react';
import {
  ColorMode,
  COLOR_MODES,
  hsvToRgb,
  rgbToHex,
  parseHexInput,
  hexToRgb,
  rgbToHsv,
  labToRgb,
  hslToRgb,
  formatColorValue,
} from '../services/colorUtils';
import { useAppStore } from '../store';

export const ProColorPicker: React.FC<{ color: string, onChange: (hex: string) => void, onLiveChange?: (hex: string) => void, isPickingColor: boolean, onTogglePick: () => void }> = ({ color, onChange, onLiveChange, isPickingColor, onTogglePick }) => {
  const [hsv, setHsv] = useState(() => rgbToHsv(hexToRgb(color).r, hexToRgb(color).g, hexToRgb(color).b));
  
  const colorMode = useAppStore((s) => s.colorMode);
  const setColorMode = useAppStore((s) => s.setColorMode);
  const [inputText, setInputText] = useState(() => formatColorValue(color, colorMode));
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

  const colorRef = useRef(color);
  const hsvRef = useRef(hsv);
  const rafRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isInputFocusedRef = useRef(false);

  useEffect(() => {
    setInputText(formatColorValue(colorRef.current, colorMode));
  }, [colorMode]);

  useEffect(() => {
    if (colorRef.current !== color) {
       colorRef.current = color;
       if (!isInputFocusedRef.current) {
         setInputText(formatColorValue(color, colorMode));
       }
       const newRgb = hexToRgb(color);
       const newHsv = rgbToHsv(newRgb.r, newRgb.g, newRgb.b);
       setHsv(newHsv);
       hsvRef.current = newHsv;
    }
  }, [color, colorMode]);

  const updateHsv = (updates: Partial<{h:number, s:number, v:number}>, isCommit = false) => {
    const nextHsv = { ...hsvRef.current, ...updates };
    setHsv(nextHsv);
    hsvRef.current = nextHsv;
    
    const newRgb = hsvToRgb(nextHsv.h, nextHsv.s, nextHsv.v);
    const newHex = rgbToHex(newRgb.r, newRgb.g, newRgb.b);
    
    setInputText(formatColorValue(newHex, colorMode));
    
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
    inputRef.current?.blur();
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
    inputRef.current?.blur();
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
                              {COLOR_MODES.map((mode) => (
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
                    ref={inputRef}
                    type="text" 
                    value={inputText}
                    onFocus={() => {
                      isInputFocusedRef.current = true;
                    }}
                    onBlur={() => {
                      isInputFocusedRef.current = false;
                      setInputText(formatColorValue(colorRef.current, colorMode));
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        setInputText(formatColorValue(colorRef.current, colorMode));
                        e.currentTarget.blur();
                      }
                    }}
                    onChange={(e) => {
                        const val = e.target.value;
                        const inputType = (e.nativeEvent as InputEvent | undefined)?.inputType;
                        let nextInputText = val;
                        
                        let hexValue = '';
                        try {
                          if (colorMode === 'HEX') {
                            const parsed = parseHexInput(val);
                            if (parsed) {
                              hexValue = parsed.hex;
                              if (!parsed.isShort) {
                                if (!parsed.hasHash || val !== val.trim()) {
                                  nextInputText = parsed.hex;
                                }
                              } else if (inputType === 'insertFromPaste') {
                                nextInputText = parsed.hex;
                              }
                            }
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

                        setInputText(nextInputText);

                        if (hexValue) {
                            if (hexValue !== colorRef.current) {
                                colorRef.current = hexValue;
                                const newRgb = hexToRgb(hexValue);
                                const newHsv = rgbToHsv(newRgb.r, newRgb.g, newRgb.b);
                                setHsv(newHsv);
                                hsvRef.current = newHsv;
                            }
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
