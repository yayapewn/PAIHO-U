const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

// 1. Update imports
const importTarget = `import { X, RotateCw, Share2, Download, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, MousePointer2, Smartphone, Monitor, Pipette } from 'lucide-react';`;
const importReplacement = `import { X, RotateCw, Share2, Download, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, MousePointer2, Smartphone, Monitor, Pipette, Code, Save, Copy, Trash2 } from 'lucide-react';`;
content = content.replace(importTarget, importReplacement);

// 2. Add ENABLE_DEV_TOOLS constant
const constTarget = `const UNIFORM_LINK = "https://www.paiho.com/tw/material-hub/b873383c1623dcffafd786ce755b2786";`;
const constReplacement = `const UNIFORM_LINK = "https://www.paiho.com/tw/material-hub/b873383c1623dcffafd786ce755b2786";\nconst ENABLE_DEV_TOOLS = true;`;
content = content.replace(constTarget, constReplacement);

// 3. Add devConfigs state
const stateTarget = `const App: React.FC = () => {
  const [activeModelIndex, setActiveModelIndex] = useState(0);`;
const stateReplacement = `const App: React.FC = () => {
  const [devConfigs, setDevConfigs] = useState<Record<string, any>>(() => {
    try {
      const saved = localStorage.getItem('paiho_dev_configs');
      return saved ? JSON.parse(saved) : {};
    } catch(e) { return {}; }
  });

  useEffect(() => {
    localStorage.setItem('paiho_dev_configs', JSON.stringify(devConfigs));
  }, [devConfigs]);

  const [activeModelIndex, setActiveModelIndex] = useState(0);`;
content = content.replace(stateTarget, stateReplacement);

// 4. Update applyTexture
const applyTarget = `  const applyTexture = (texture: TextureItem) => {
    if (!selectedPart || !isLibrarySupported(selectedPart.name)) return;
    setActiveTexture(texture);
    setPartTextures(prev => {
      const existing = prev[selectedPart.id];
      if (existing) return { ...prev, [selectedPart.id]: { ...existing, url: texture.url, normalUrl: texture.normalUrl, color: '#ffffff' } };
      return { ...prev, [selectedPart.id]: { url: texture.url, normalUrl: texture.normalUrl, scale: 2.5, offsetX: 0, offsetY: 0, rotation: 0, roughness: 1, metalness: 0, opacity: 1, color: '#ffffff' } };
    });
  };`;

const applyReplacement = `  const applyTexture = (texture: TextureItem) => {
    if (!selectedPart || !isLibrarySupported(selectedPart.name)) return;
    setActiveTexture(texture);
    
    // 檢查是否有 Dev Tool 暫存的設定
    const savedConfig = devConfigs[texture.url];
    const defaultScale = savedConfig ? savedConfig.scale : 2.5;
    const defaultOffsetX = savedConfig ? savedConfig.offsetX : 0;
    const defaultOffsetY = savedConfig ? savedConfig.offsetY : 0;

    setPartTextures(prev => {
      const existing = prev[selectedPart.id];
      if (existing) return { ...prev, [selectedPart.id]: { ...existing, url: texture.url, normalUrl: texture.normalUrl, color: '#ffffff', scale: defaultScale, offsetX: defaultOffsetX, offsetY: defaultOffsetY } };
      return { ...prev, [selectedPart.id]: { url: texture.url, normalUrl: texture.normalUrl, scale: defaultScale, offsetX: defaultOffsetX, offsetY: defaultOffsetY, rotation: 0, roughness: 1, metalness: 0, opacity: 1, color: '#ffffff' } };
    });
  };`;
content = content.replace(applyTarget, applyReplacement);

// 5. Inject Dev UI
const uiTarget = `           {(!selectedPart) && (
             <div className="absolute inset-0 flex items-end justify-center pb-[max(6rem,18dvh)] pointer-events-none animate-in fade-in zoom-in-95 duration-700">`;

const uiReplacement = `           {ENABLE_DEV_TOOLS && selectedPart && activeTexture && partTextures[selectedPart.id] && (
               <div className="absolute left-6 top-32 w-72 bg-white/95 backdrop-blur-md border border-indigo-100 rounded-2xl shadow-2xl p-5 z-50 animate-in fade-in slide-in-from-left-4">
                   <div className="flex items-center justify-between mb-4">
                       <h3 className="text-[11px] font-black tracking-widest text-indigo-900 uppercase flex items-center gap-1.5"><Code size={14}/> Dev UV Tool</h3>
                       <span className="text-[9px] font-bold bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full">DEV MODE</span>
                   </div>
                   
                   <div className="space-y-4 mb-5">
                       <div>
                           <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
                               <span>SCALE (縮放)</span>
                               <span className="text-indigo-600">{partTextures[selectedPart.id]?.scale.toFixed(2)}</span>
                           </div>
                           <input type="range" min="0.1" max="10" step="0.05" value={partTextures[selectedPart.id]?.scale} onChange={(e) => updateTextureConfig('scale', parseFloat(e.target.value))} className="w-full accent-indigo-600 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer" />
                       </div>
                       <div>
                           <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
                               <span>OFFSET X (水平偏移)</span>
                               <span className="text-indigo-600">{partTextures[selectedPart.id]?.offsetX.toFixed(2)}</span>
                           </div>
                           <input type="range" min="-2" max="2" step="0.01" value={partTextures[selectedPart.id]?.offsetX} onChange={(e) => updateTextureConfig('offsetX', parseFloat(e.target.value))} className="w-full accent-indigo-600 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer" />
                       </div>
                       <div>
                           <div className="flex justify-between text-[10px] font-bold text-gray-500 mb-1">
                               <span>OFFSET Y (垂直偏移)</span>
                               <span className="text-indigo-600">{partTextures[selectedPart.id]?.offsetY.toFixed(2)}</span>
                           </div>
                           <input type="range" min="-2" max="2" step="0.01" value={partTextures[selectedPart.id]?.offsetY} onChange={(e) => updateTextureConfig('offsetY', parseFloat(e.target.value))} className="w-full accent-indigo-600 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer" />
                       </div>
                   </div>

                   <div className="space-y-2">
                       <button 
                           onClick={(e) => {
                               e.stopPropagation();
                               const conf = partTextures[selectedPart.id];
                               if(conf) {
                                   setDevConfigs(prev => ({
                                       ...prev, 
                                       [activeTexture.url]: {
                                           id: activeTexture.name || activeTexture.url.split('/').pop(),
                                           colorUrl: activeTexture.url,
                                           normalUrl: activeTexture.normalUrl,
                                           scale: conf.scale,
                                           offsetX: conf.offsetX,
                                           offsetY: conf.offsetY
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
                               if(window.confirm("確定要清除所有暫存的 UV 設定嗎？")) {
                                   setDevConfigs({});
                               }
                           }}
                           className="w-full bg-red-50 text-red-500 font-bold text-[11px] py-2 rounded-lg hover:bg-red-100 flex items-center justify-center gap-1.5 transition-colors mt-2 pointer-events-auto"
                       >
                           <Trash2 size={13} /> 清空暫存
                       </button>
                   </div>
               </div>
           )}

           {(!selectedPart) && (
             <div className="absolute inset-0 flex items-end justify-center pb-[max(6rem,18dvh)] pointer-events-none animate-in fade-in zoom-in-95 duration-700">`;
content = content.replace(uiTarget, uiReplacement);

fs.writeFileSync('App.tsx', content);
console.log('App.tsx updated');
