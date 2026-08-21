import React, { Component, useEffect, useState, Suspense, useRef, ErrorInfo, useMemo, ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html, Loader, Environment, PerspectiveCamera, Center, ContactShadows, AdaptiveDpr, AdaptiveEvents } from '@react-three/drei';
import * as THREE from 'three';
import { SelectedPart, TextureConfig, TextureItem } from '../types';

// 標準化八大部位名稱
const MAIN_PARTS = [
  'VAMP', 'TONGUE', 'COLLAR', 'PULL_TAB', 
  'HEEL_COUNTER', 'WELT', 'MIDSOLE', 'OUTSOLE'
];

// 包含模型原始 ID 的互動關鍵字
const INTERACTIVE_KEYWORDS = [
  ...MAIN_PARTS,
  'Shape027_1', 'Shape027', 'Line040', 'Shape026'
];

const DEFAULT_VIEW = {
    pos: [0.85, 0, 0] as [number, number, number], 
    target: [0, 0, 0] as [number, number, number],
    fov: 37.8
};

const TRUSTED_DOMAINS = [
    'raw.githubusercontent.com',
    'huggingface.co',
    'aistudiocdn.com'
];

// R3F 內建元素宣告，避免 TypeScript 在某些環境下的編譯錯誤
const Group = 'group' as any;
const AmbientLight = 'ambientLight' as any;
const DirectionalLight = 'directionalLight' as any;
const Primitive = 'primitive' as any;

/**
 * 將模型網格名稱映射為標準化的部位名稱（依據 Traveler 運動鞋設計圖）
 */
const getNormalizedPartName = (meshName: string): string => {
    const upperName = meshName.toUpperCase();
    
    // Traveler 專屬部位名稱對照
    if (upperName.includes('TONGUE_PULL_TAB')) return 'Tongue Pull Tab';
    if (upperName.includes('TONGUE_LABEL')) return 'Tongue Label';
    if (upperName.includes('TONGUE_REINFORCEMENT')) return 'Tongue Reinforcement';
    if (upperName.includes('TONGUE')) return 'Tongue';
    
    if (upperName.includes('HEEL_PULL_TAB')) return 'Heel Pull Tab';
    if (upperName.includes('HEEL_COLLAR_REINFORCEMENT')) return 'Heel Collar Reinforcement';
    if (upperName.includes('HEEL_COUNTER')) return 'Heel Counter';
    if (upperName.includes('HEEL_STRAP')) return 'Heel Strap';
    
    if (upperName.includes('QUARTER_LABEL')) return 'Quarter Label';
    if (upperName.includes('QUARTER_OVERLAY')) return 'Quarter Overlay';
    
    if (upperName.includes('VAMP') || upperName.includes('SHAPE027')) return 'Vamp';
    if (upperName.includes('SHOELACE') || upperName.includes('SHAPE026')) return 'Shoelace';
    if (upperName.includes('EYELET')) return 'Eyelet';
    if (upperName.includes('OUTSOLE')) return 'Outsole';
    if (upperName.includes('MIDSOLE')) return 'Midsole';
    if (upperName.includes('WELT')) return 'Welt';
    if (upperName.includes('COLLAR')) return 'Collar';
    if (upperName.includes('PULL_TAB')) return 'Pull Tab';
    
    // 預設處理：移除底線與結尾數字，並轉為首字母大寫
    return meshName
        .replace(/_/g, ' ')
        .replace(/\d+$/, '')
        .trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
};

const isInteractive = (name: string) => {
    return INTERACTIVE_KEYWORDS.some(keyword => name && name.toUpperCase().includes(keyword.toUpperCase()));
};

const isUrlSafe = (url: string) => {
    if (!url) return false;
    if (url.startsWith('blob:') || url.startsWith('data:')) return true;
    try {
        const parsedUrl = new URL(url);
        return TRUSTED_DOMAINS.includes(parsedUrl.hostname);
    } catch {
        return false;
    }
};

const ScreenshotHandler = React.forwardRef<any, any>((props, ref) => {
    const { gl, scene, camera } = useThree();
    React.useImperativeHandle(ref, () => ({
        captureComposition: async () => {
            return new Promise<string>((resolve) => {
                const originalPosition = camera.position.clone();
                const originalRotation = camera.rotation.clone();
                const originalAspect = (camera as THREE.PerspectiveCamera).aspect;
                const totalWidth = 2560;
                const totalHeight = 1440;
                const halfWidth = totalWidth / 2;
                const halfHeight = totalHeight / 2;
                const quarterWidth = halfWidth / 2;
                
                const gutter = 20; // 增加間距以提升視覺舒適度

                const canvas = document.createElement('canvas');
                canvas.width = totalWidth;
                canvas.height = totalHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) { resolve(''); return; }
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, totalWidth, totalHeight);

                const renderAndDraw = (x: number, y: number, w: number, h: number, camPos: THREE.Vector3, lookAt: THREE.Vector3, up?: THREE.Vector3, customFov?: number) => {
                     const originalUp = camera.up.clone();
                     const originalFov = (camera as THREE.PerspectiveCamera).fov;
                     
                     if (up) camera.up.copy(up);
                     else camera.up.set(0, 1, 0);
                     
                     camera.position.copy(camPos);
                     camera.lookAt(lookAt);
                     
                     // 根據視圖類型微調 FOV，確保模型大小與參考圖一致且不被裁切
                     (camera as THREE.PerspectiveCamera).fov = customFov || 30;
                     camera.updateProjectionMatrix();
                     camera.updateMatrixWorld();
                     
                     gl.render(scene, camera);
                     const tempCanvas = document.createElement('canvas');
                     tempCanvas.width = gl.domElement.width;
                     tempCanvas.height = gl.domElement.height;
                     const tempCtx = tempCanvas.getContext('2d');
                     if(tempCtx) {
                         tempCtx.drawImage(gl.domElement, 0, 0);
                         const srcAspect = tempCanvas.width / tempCanvas.height;
                         const destAspect = w / h;
                         
                         // 使用 92% 的佔比，預留安全空間確保陰影不被裁切
                         const scaleFactor = 0.92;
                         const targetW = w * scaleFactor;
                         const targetH = h * scaleFactor;
                         
                         let drawW, drawH, drawX, drawY;
                         
                         if (srcAspect > destAspect) {
                             drawW = targetW; 
                             drawH = targetW / srcAspect; 
                             drawX = x + (w - drawW) / 2; 
                             drawY = y + (h - drawH) / 2;
                         } else {
                             drawH = targetH; 
                             drawW = targetH * srcAspect; 
                             drawY = y + (h - drawH) / 2; 
                             drawX = x + (w - drawW) / 2;
                         }
                         ctx.drawImage(tempCanvas, drawX, drawY, drawW, drawH);
                     }
                     
                     camera.up.copy(originalUp);
                     (camera as THREE.PerspectiveCamera).fov = originalFov;
                     camera.updateProjectionMatrix();
                };

                const lookAtCenter = new THREE.Vector3(0, 0, 0);
                
                // 1. 左上：正側視圖 (Side View)
                renderAndDraw(0, 0, halfWidth - gutter, halfHeight - gutter, new THREE.Vector3(0.75, 0, 0), lookAtCenter);
                
                // 2. 左下：上視圖 (Top View)
                renderAndDraw(0, halfHeight + gutter, halfWidth - gutter, halfHeight - gutter, new THREE.Vector3(0, 0.75, 0), lookAtCenter, new THREE.Vector3(-1, 0, 0));
                
                // 3. 右上：45度角視圖 (Perspective View)
                renderAndDraw(halfWidth + gutter, 0, halfWidth - gutter, halfHeight - gutter, new THREE.Vector3(0.55, 0.4, 0.55), lookAtCenter);
                
                // 4. 右下左：鞋頭視角 (Toe View)
                renderAndDraw(halfWidth + gutter, halfHeight + gutter, quarterWidth - gutter, halfHeight - gutter, new THREE.Vector3(0, 0, 0.8), lookAtCenter, undefined, 28);
                
                // 5. 右下右：鞋跟視角 (Heel View)
                renderAndDraw(halfWidth + quarterWidth + gutter, halfHeight + gutter, quarterWidth - gutter, halfHeight - gutter, new THREE.Vector3(0, 0, -0.8), lookAtCenter, undefined, 28);
                camera.position.copy(originalPosition);
                camera.rotation.copy(originalRotation);
                (camera as THREE.PerspectiveCamera).aspect = originalAspect;
                camera.updateProjectionMatrix();
                resolve(canvas.toDataURL('image/png', 0.9));
            });
        }
    }));
    return null;
});

interface ErrorBoundaryProps { 
    children?: ReactNode;
}

interface ErrorBoundaryState { 
    hasError: boolean; 
    error: any; 
}

// Fixed ErrorBoundary by extending React.Component directly to ensure state, props, and setState are correctly recognized as inherited members.
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error("Model loading error:", error, errorInfo);
  }

  render() {
    const { hasError } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <Html center>
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 text-center w-80">
            <div className="text-red-500 font-bold mb-2 text-lg">Loading Failed</div>
            <p className="text-sm text-gray-500 mb-4">Unable to load the 3D model. Please check the URL or your connection.</p>
            <button 
                onClick={() => this.setState({ hasError: false, error: null })} 
                className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm hover:bg-indigo-700 transition"
            >
                Retry
            </button>
          </div>
        </Html>
      );
    }
    return children;
  }
}

interface ModelProps {
  url: string;
  modelId?: string;
  modelScale: number;
  modelRotation: [number, number, number];
  modelPosition: [number, number, number];
  selectedPart: SelectedPart | null;
  onPartSelect: (part: SelectedPart | null) => void;
  textureMap: Record<string, TextureConfig | null>;
  controls: any;
  isPickingColor?: boolean;
  onColorPicked?: (hex: string) => void;
}

const Model: React.FC<ModelProps> = ({ url, modelId, modelScale, modelRotation, selectedPart, onPartSelect, textureMap, controls, isPickingColor, onColorPicked }) => {
  const { scene } = useGLTF(url);
  // 使用獨立的 LoadingManager，避免觸發全域的 Suspense Loader（防止閃黑畫面）
  const textureLoader = useMemo(() => {
      const manager = new THREE.LoadingManager();
      return new THREE.TextureLoader(manager);
  }, []);
  
  // 用於判斷是拖曳旋轉還是點擊部位
  const pointerDownPos = useRef({ x: 0, y: 0 });

  const cachedMeshes = useMemo(() => {
    const interactive: THREE.Mesh[] = [];
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (!mesh.userData.originalMaterial) {
            mesh.userData.originalMaterial = mesh.material;
        }
        
        // 如果是 traveler 模型，則所有網格都視為可互動
        const interactiveFlag = modelId === 'traveler' ? true : isInteractive(mesh.name);

        if (interactiveFlag) {
            interactive.push(mesh);
            if (!mesh.userData.isCustomMaterial) {
                const originalMat = Array.isArray(mesh.userData.originalMaterial) 
                    ? mesh.userData.originalMaterial[0] 
                    : mesh.userData.originalMaterial;
                const newMat = originalMat.clone();
                newMat.side = THREE.DoubleSide;
                newMat.transparent = true;
                if (newMat.emissive) {
                    newMat.emissive.setHex(0xffffff);
                    newMat.emissiveIntensity = 0;
                }



                mesh.material = newMat;
                mesh.userData.isCustomMaterial = true;
                mesh.userData.glowEnergy = 0;
            }
        }
      }
    });
    return interactive;
  }, [scene, modelId]);

  useEffect(() => {
    const handlePreviewColor = (e: any) => {
      const { partId, color } = e.detail;
      const mesh = cachedMeshes.find(m => m.uuid === partId);
      if (mesh) {
        const material = mesh.material as THREE.MeshStandardMaterial;
        if (material && material.color) {
            material.color.set(color);
            
            const upperName = getNormalizedPartName(mesh.name).toUpperCase();
            if (['TONGUE', 'MIDSOLE', 'OUTSOLE'].includes(upperName)) {
                let changed = false;
                if (material.map !== null) { material.map = null; changed = true; }
                if (material.aoMap !== null) { material.aoMap = null; changed = true; }
                if (material.lightMap !== null) { material.lightMap = null; changed = true; }
                if (material.emissiveMap !== null) { material.emissiveMap = null; changed = true; }
                if (material.vertexColors) { material.vertexColors = false; changed = true; }
                if (changed) material.needsUpdate = true;
            }
        }
      }
    };
    window.addEventListener('preview-part-color', handlePreviewColor);
    return () => window.removeEventListener('preview-part-color', handlePreviewColor);
  }, [cachedMeshes]);

  useEffect(() => {
    cachedMeshes.forEach(mesh => {
      const config = textureMap[mesh.uuid];
      if (config) {
        const material = mesh.material as THREE.MeshStandardMaterial;
        if (config.color) material.color.set(config.color);
        else material.color.setHex(0xffffff);
        material.roughness = config.roughness;
        material.metalness = config.metalness;
        material.opacity = config.opacity;
        material.alphaTest = 0.05;

        const origMat = Array.isArray(mesh.userData.originalMaterial) ? mesh.userData.originalMaterial[0] : mesh.userData.originalMaterial;

        if (config.url && isUrlSafe(config.url)) {
            if (mesh.userData.currentTextureUrl !== config.url) {
                mesh.userData.currentTextureUrl = config.url; // 立即更新 URL，防止重複觸發載入
                textureLoader.load(config.url, (texture) => {
                    // 確保載入完成時，使用者沒有切換到其他貼圖
                    if (mesh.userData.currentTextureUrl !== config.url) {
                        texture.dispose();
                        return;
                    }
                    
                    texture.flipY = false;
                    texture.colorSpace = THREE.SRGBColorSpace;
                    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                    texture.repeat.set(config.scale, config.scale);
                    texture.offset.set(config.offsetX, config.offsetY);
                    texture.rotation = (config.rotation * Math.PI) / 180;
                    texture.center.set(0.5, 0.5);
                    
                    if (material.map && material.map !== origMat.map) {
                        material.map.dispose();
                    }
                    material.map = texture;
                    material.needsUpdate = true;
                }, undefined, (err) => {
                    console.error("Texture failed:", config.url, err);
                    if (mesh.userData.currentTextureUrl === config.url) {
                        mesh.userData.currentTextureUrl = null;
                    }
                });
            } else if (material.map && material.map !== origMat.map) {
                material.map.repeat.set(config.scale, config.scale);
                material.map.rotation = (config.rotation * Math.PI) / 180;
                material.map.offset.set(config.offsetX, config.offsetY);
            }
        } else {
            const upperName = getNormalizedPartName(mesh.name).toUpperCase();
            const isCategoryB = ['TONGUE', 'MIDSOLE', 'OUTSOLE'].includes(upperName);
            if (isCategoryB) {
                let changed = false;
                if (material.map !== null) { material.map = null; changed = true; }
                if (material.aoMap !== null) { material.aoMap = null; changed = true; }
                if (material.lightMap !== null) { material.lightMap = null; changed = true; }
                if (material.emissiveMap !== null) { material.emissiveMap = null; changed = true; }
                if (material.vertexColors) { material.vertexColors = false; changed = true; }
                if (changed) {
                    mesh.userData.currentTextureUrl = null;
                    material.needsUpdate = true;
                }
            } else {
                if (material.map !== origMat.map) {
                    if (material.map && material.map !== origMat.map) material.map.dispose();
                    material.map = origMat.map;
                    mesh.userData.currentTextureUrl = null;
                    material.needsUpdate = true;
                }
            }
        }

        if (config.normalUrl && isUrlSafe(config.normalUrl)) {
            if (mesh.userData.currentNormalUrl !== config.normalUrl) {
                mesh.userData.currentNormalUrl = config.normalUrl; // 立即更新 URL
                textureLoader.load(config.normalUrl, (normalTexture) => {
                    // 確保載入完成時，使用者沒有切換到其他貼圖
                    if (mesh.userData.currentNormalUrl !== config.normalUrl) {
                        normalTexture.dispose();
                        return;
                    }
                    normalTexture.flipY = false;
                    normalTexture.wrapS = normalTexture.wrapT = THREE.RepeatWrapping;
                    normalTexture.repeat.set(config.scale, config.scale);
                    normalTexture.offset.set(config.offsetX, config.offsetY);
                    normalTexture.rotation = (config.rotation * Math.PI) / 180;
                    normalTexture.center.set(0.5, 0.5);
                    
                    if (material.normalMap && material.normalMap !== origMat.normalMap) {
                        material.normalMap.dispose();
                    }
                    material.normalMap = normalTexture;
                    material.needsUpdate = true;
                }, undefined, (err) => {
                    console.error("Normal map failed:", config.normalUrl, err);
                    if (mesh.userData.currentNormalUrl === config.normalUrl) {
                        mesh.userData.currentNormalUrl = null;
                    }
                });
            } else if (material.normalMap && material.normalMap !== origMat.normalMap) {
                material.normalMap.repeat.set(config.scale, config.scale);
                material.normalMap.rotation = (config.rotation * Math.PI) / 180;
                material.normalMap.offset.set(config.offsetX, config.offsetY);
            }
        } else {
            if (material.normalMap !== origMat.normalMap) {
                if (material.normalMap) material.normalMap.dispose();
                material.normalMap = origMat.normalMap;
                mesh.userData.currentNormalUrl = null;
                material.needsUpdate = true;
            }
        }
      }
    });
  }, [cachedMeshes, textureMap]);

  useFrame((state, delta) => {
    cachedMeshes.forEach(mesh => {
        const material = mesh.material as THREE.MeshStandardMaterial;
        if (material && 'emissive' in material) {
            if (mesh.userData.glowEnergy > 0) {
                mesh.userData.glowEnergy = THREE.MathUtils.lerp(mesh.userData.glowEnergy, 0, delta * 2.0);
                const pulse = Math.sin(mesh.userData.glowEnergy * Math.PI) * 0.1;
                material.emissiveIntensity = pulse;
            } else {
                material.emissiveIntensity = 0;
            }
        }
    });
  });

  return <Primitive 
            object={scene} 
            scale={[modelScale, modelScale, modelScale]} 
            rotation={modelRotation} 
            onPointerDown={(e: any) => {
                pointerDownPos.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerOver={(e: any) => { 
                e.stopPropagation(); 
                if (isPickingColor) {
                    document.body.style.cursor = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><g stroke='rgba(255,255,255,0.8)' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><path d='m2 22 1-1h3l9-9'/><path d='M3 21v-3l9-9'/><path d='m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z'/></g><g stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><polygon points='3,21 3,18 12,9 15,12 6,21' fill='white'/><path d='m2 22 1-1' stroke-width='2'/><path d='m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z' fill='black'/></g></svg>") 0 24, crosshair`;
                    return;
                }
                const interactiveFlag = modelId === 'traveler' ? true : isInteractive(e.object.name);
                if(interactiveFlag) document.body.style.cursor = 'pointer'; 
            }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; }}
            onClick={(e: any) => {
                e.stopPropagation();
                
                // 計算滑鼠按下與放開的距離，如果大於 10 像素則視為拖曳旋轉
                const dist = Math.sqrt(
                    Math.pow(e.clientX - pointerDownPos.current.x, 2) +
                    Math.pow(e.clientY - pointerDownPos.current.y, 2)
                );
                if (!isPickingColor && dist > 10) return;

                const mesh = e.object as THREE.Mesh;
                const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;

                if (isPickingColor && onColorPicked) {
                    let pickedHex = null;
                    const standardMat = mat as THREE.MeshStandardMaterial;
                    const baseHex = '#' + standardMat.color.getHexString();

                    if (baseHex.toLowerCase() !== '#ffffff') {
                        pickedHex = baseHex;
                    } else if (standardMat.map && standardMat.map.image && e.uv) {
                        // 1. 如果有貼圖且未染色，嘗試讀取貼圖的該像素顏色 (未受光影影響的原始色)
                        try {
                            const canvas = document.createElement('canvas');
                            const img = standardMat.map.image;
                            canvas.width = img.width || img.videoWidth || 1024;
                            canvas.height = img.height || img.videoHeight || 1024;
                            const ctx = canvas.getContext('2d', { willReadFrequently: true });
                            if (ctx) {
                                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                
                                // 套用材質的 UV 轉換矩陣 (處理 offset, repeat, rotation)
                                const uv = e.uv.clone();
                                if (standardMat.map.matrixAutoUpdate) {
                                    standardMat.map.updateMatrix();
                                }
                                uv.applyMatrix3(standardMat.map.matrix);
                                
                                let u = uv.x % 1.0;
                                let v = uv.y % 1.0;
                                
                                if (u < 0) u += 1.0;
                                if (v < 0) v += 1.0;
                                
                                const px = Math.floor(u * canvas.width);
                                // 根據貼圖的 flipY 屬性決定 Y 軸方向 (GLTF 預設為 false)
                                const py = Math.floor((standardMat.map.flipY ? (1.0 - v) : v) * canvas.height);
                                
                                const pixel = ctx.getImageData(px, py, 1, 1).data;
                                const toHex = (c: number) => {
                                    const hex = Math.round(c).toString(16).toUpperCase();
                                    return hex.length === 1 ? '0' + hex : hex;
                                };
                                pickedHex = `#${toHex(pixel[0])}${toHex(pixel[1])}${toHex(pixel[2])}`;
                            }
                        } catch(err) {
                            console.warn("Texture pixel read failed, falling back to material color", err);
                        }
                    }

                    // 2. 如果沒有貼圖或讀取失敗，回退讀取材質的 Base Color
                    if (!pickedHex && standardMat.color) {
                        pickedHex = '#' + standardMat.color.getHexString();
                    }

                    if (pickedHex) onColorPicked(pickedHex);
                    document.body.style.cursor = 'auto'; // Reset cursor immediately
                    return;
                }

                const interactiveFlag = modelId === 'traveler' ? true : isInteractive(mesh.name);
                
                if (!interactiveFlag) { onPartSelect(null); return; }
                mesh.userData.glowEnergy = 1.0;
                
                // 使用標準化的部位名稱以更新 UI
                const normalizedPartName = getNormalizedPartName(mesh.name);
                onPartSelect({ name: normalizedPartName, materialName: mat.name, id: mesh.uuid });
            }}
          />;
};

const InnerScene = React.memo(({ url, modelId, modelScale, modelRotation, modelPosition, selectedPart, onPartSelect, textureMap, controls, isPickingColor, onColorPicked }: ModelProps) => {
    const [modelBottom, setModelBottom] = useState(-0.1);
    return (
        <Group position={modelPosition}>
            <Center onCentered={({ height }) => setModelBottom(-height / 2)}>
                <Model 
                    url={url} 
                    modelId={modelId}
                    modelScale={modelScale}
                    modelRotation={modelRotation}
                    modelPosition={modelPosition}
                    selectedPart={selectedPart} 
                    onPartSelect={onPartSelect}
                    textureMap={textureMap}
                    controls={controls}
                    isPickingColor={isPickingColor}
                    onColorPicked={onColorPicked}
                />
            </Center>
            <ContactShadows position={[0, modelBottom - 0.001, 0]} opacity={0.6} scale={1.5} blur={0.8} far={1.0} resolution={256} color="#000000" />
        </Group>
    );
});

interface ModelViewerProps {
  url: string;
  modelId?: string;
  modelScale: number;
  modelRotation: [number, number, number];
  modelPosition: [number, number, number];
  selectedPart: SelectedPart | null;
  onPartSelect: (part: SelectedPart | null) => void;
  textureMap: Record<string, TextureConfig | null>;
  activeTexture?: TextureItem | null; 
  envPreset: string;
  envIntensity: number;
  envRotation: number;
  dirLightRotation: number;
  shadowBlur: number;
  shadowNormalBias: number;
  autoRotate: boolean;
  isPickingColor?: boolean;
  onColorPicked?: (hex: string) => void;
}

const CameraResetter = ({ modelId, controlsRef }: { modelId?: string, controlsRef: any }) => {
    const { camera } = useThree();
    
    useEffect(() => {
        camera.position.set(...DEFAULT_VIEW.pos);
        camera.lookAt(...DEFAULT_VIEW.target);
        camera.updateProjectionMatrix();
        
        if (controlsRef.current) {
            controlsRef.current.target.set(...DEFAULT_VIEW.target);
            controlsRef.current.update();
        }
    }, [modelId, camera, controlsRef]);
    
    return null;
};

const ModelViewer = React.forwardRef<any, ModelViewerProps>(({ 
    url, modelId, modelScale, modelRotation, modelPosition, selectedPart, onPartSelect, textureMap, activeTexture, envPreset, envIntensity, envRotation, dirLightRotation, shadowBlur, shadowNormalBias, autoRotate, isPickingColor, onColorPicked
}, ref) => {
  const controlsRef = useRef<any>(null);
  const screenshotHandlerRef = useRef<any>(null);

  React.useImperativeHandle(ref, () => ({
      captureComposition: () => screenshotHandlerRef.current?.captureComposition() || Promise.resolve('')
  }));

  const rad = (dirLightRotation * Math.PI) / 180;
  const dirLightX = Math.cos(rad) * 6;
  const dirLightZ = Math.sin(rad) * 6;

  return (
    <div className="w-full h-full bg-[#f8f9fa] relative">
      <Canvas shadows dpr={[1, 2]}
          gl={{ 
            preserveDrawingBuffer: true, 
            antialias: false,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping, 
            toneMappingExposure: 1.2
          }}
          onPointerMissed={(e) => { if (e.type === 'click') onPartSelect(null); }}
      >
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        <PerspectiveCamera makeDefault position={DEFAULT_VIEW.pos} fov={DEFAULT_VIEW.fov} near={0.01} />
        <OrbitControls 
            ref={controlsRef}
            makeDefault 
            minPolarAngle={0} 
            maxPolarAngle={Math.PI / 1.5} 
            enableDamping={true}
            dampingFactor={0.05}
            autoRotate={autoRotate}
            autoRotateSpeed={3.0}
            enabled={!isPickingColor}
        />
        <CameraResetter modelId={modelId} controlsRef={controlsRef} />
        <ScreenshotHandler ref={screenshotHandlerRef} />
        <Suspense fallback={<Html center><div className="flex flex-col items-center gap-4"><div className="w-8 h-8 border-2 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Initializing Scene...</p></div></Html>}>
            {/* Fixed key error by ensuring ErrorBoundary is recognized as a standard React component */}
            <ErrorBoundary key={url}>
                <InnerScene 
                    url={url}
                    modelId={modelId}
                    modelScale={modelScale}
                    modelRotation={modelRotation}
                    modelPosition={modelPosition}
                    selectedPart={selectedPart}
                    onPartSelect={onPartSelect}
                    textureMap={textureMap}
                    controls={controlsRef.current}
                    isPickingColor={isPickingColor}
                    onColorPicked={onColorPicked}
                />
                <Suspense fallback={null}>
                  <Environment preset={envPreset as any} environmentIntensity={envIntensity} environmentRotation={[0, (envRotation * Math.PI) / 180, 0]} />
                </Suspense>
                <AmbientLight intensity={0.5} />
                <DirectionalLight 
                    position={[dirLightX, 8, dirLightZ]} 
                    intensity={0.8} 
                    castShadow 
                    shadow-mapSize={[512, 512]} 
                    shadow-bias={-0.001} 
                    shadow-normalBias={shadowNormalBias} 
                />
            </ErrorBoundary>
        </Suspense>
      </Canvas>
      <Loader />
      {selectedPart && (
        <div className={`
            absolute left-1/2 -translate-x-1/2 z-10 
            transition-all duration-500 ease-out animate-in fade-in slide-in-from-top-4
            flex flex-col items-center gap-4 w-full px-8 max-w-xl text-center
            top-[calc(18dvh-5px)] lg:top-32
        `}>
          <div className="flex items-center gap-3 px-6 py-2.5 rounded-full bg-white/70 backdrop-blur-xl border border-white/50 shadow-[0_10px_40px_rgba(0,0,0,0.05)] whitespace-nowrap">
            <span className="w-2.5 h-2.5 shrink-0 rounded-full bg-indigo-500 animate-pulse"></span>
            <span className="text-[10px] lg:text-[11px] font-black tracking-[0.2em] uppercase text-gray-900 leading-none">
              EDITING <span className="text-indigo-600 ml-1">{selectedPart.name}</span>
            </span>
          </div>

          {activeTexture && (
            <div className="flex flex-col items-center gap-2 animate-in fade-in zoom-in-95 duration-700 delay-150">
                <h2 className="text-[18px] lg:text-[24px] font-black tracking-tighter text-gray-900 uppercase">
                    {activeTexture.title || activeTexture.name}
                </h2>
                <p className="text-[11px] lg:text-[13px] text-gray-500 font-medium leading-relaxed max-w-sm">
                    {activeTexture.description}
                </p>
                <a 
                  href={activeTexture.link || "https://www.paiho.com/tw/material-hub/b873383c1623dcffafd786ce755b2786"} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="mt-2 text-[10px] text-indigo-600 font-black uppercase tracking-widest underline underline-offset-8 decoration-indigo-200 hover:decoration-indigo-600 transition-all pointer-events-auto"
                >
                    Read more
                </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default ModelViewer;