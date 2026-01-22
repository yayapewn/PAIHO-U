
import React, { Component, useEffect, useState, Suspense, useRef, ErrorInfo, ReactNode, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html, Loader, Environment, PerspectiveCamera, Center, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { SelectedPart, TextureConfig } from '../types';

const DEFAULT_MODEL_URL = "https://huggingface.co/yayapewn/huggingface/resolve/main/lace-sneaker-9-part.glb";
const INTERACTIVE_KEYWORDS = ['Shape027', 'Line040', 'Shape026'];

const DEFAULT_VIEW = {
    pos: [0.85, 0.2, 0] as [number, number, number],
    target: [0, 0, 0] as [number, number, number],
    fov: 37.8
};

const TRUSTED_DOMAINS = [
    'raw.githubusercontent.com',
    'huggingface.co',
    'aistudiocdn.com'
];

const Group = 'group' as any;
const AmbientLight = 'ambientLight' as any;
const DirectionalLight = 'directionalLight' as any;
const Primitive = 'primitive' as any;

const isInteractive = (name: string) => {
    return INTERACTIVE_KEYWORDS.some(keyword => name && name.includes(keyword));
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

// Added types for ScreenshotHandler props and ref to ensure type safety during capture
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
                const leftWidth = Math.floor(totalWidth * (2/3));
                const rightWidth = totalWidth - leftWidth;
                const rowHeight = totalHeight / 3;
                const canvas = document.createElement('canvas');
                canvas.width = totalWidth;
                canvas.height = totalHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) { resolve(''); return; }
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, totalWidth, totalHeight);
                const renderAndDraw = (x: number, y: number, w: number, h: number, camPos: THREE.Vector3, lookAt: THREE.Vector3) => {
                     camera.position.copy(camPos);
                     camera.lookAt(lookAt);
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
                         let drawW, drawH, drawX, drawY;
                         if (srcAspect > destAspect) {
                             drawW = w; drawH = w / srcAspect; drawX = x; drawY = y + (h - drawH) / 2;
                         } else {
                             drawH = h; drawW = h * srcAspect; drawY = y; drawX = x + (w - drawW) / 2;
                         }
                         ctx.drawImage(tempCanvas, drawX, drawY, drawW, drawH);
                     }
                };
                const lookAtCenter = new THREE.Vector3(0, 0, 0);
                renderAndDraw(0, 0, leftWidth, totalHeight, originalPosition, lookAtCenter);
                renderAndDraw(leftWidth, 0, rightWidth, rowHeight, new THREE.Vector3(0, 0.5, 0), lookAtCenter);
                renderAndDraw(leftWidth, rowHeight, rightWidth, rowHeight, new THREE.Vector3(0.5, 0, 0), lookAtCenter);
                renderAndDraw(leftWidth, rowHeight * 2, rightWidth, rowHeight, new THREE.Vector3(0, 0, -0.5), lookAtCenter);
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
    // Explicitly add key to props to resolve Type '{ key: any; }' is not assignable to type 'ErrorBoundaryProps'
    key?: React.Key;
}

interface ErrorBoundaryState { 
    hasError: boolean; 
    error: any; 
}

// Fix: Explicitly use React.Component to ensure TypeScript correctly resolves inherited properties like state, props, and setState.
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
    if (this.state.hasError) {
      return (
        <Html center>
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 text-center w-80">
            <div className="text-red-500 font-bold mb-2 text-lg">Loading Failed</div>
            <p className="text-sm text-gray-500 mb-4">Unable to load the 3D model. Please check the URL or your connection.</p>
            <button onClick={() => this.setState({ hasError: false, error: null })} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm hover:bg-indigo-700 transition">Retry</button>
          </div>
        </Html>
      );
    }
    return this.props.children;
  }
}

interface ModelProps {
  url: string;
  selectedPart: SelectedPart | null;
  onPartSelect: (part: SelectedPart | null) => void;
  textureMap: Record<string, TextureConfig | null>;
  controls: any;
}

const Model: React.FC<ModelProps> = ({ url, selectedPart, onPartSelect, textureMap, controls }) => {
  const { scene } = useGLTF(url);
  const textureLoader = useRef(new THREE.TextureLoader());

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
        if (isInteractive(mesh.name)) {
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
  }, [scene]);

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

        if (config.url && isUrlSafe(config.url)) {
            if (mesh.userData.currentTextureUrl !== config.url) {
                textureLoader.current.load(config.url, (texture) => {
                    texture.flipY = false;
                    texture.colorSpace = THREE.SRGBColorSpace;
                    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
                    texture.repeat.set(config.scale, config.scale);
                    texture.offset.set(config.offsetX, config.offsetY);
                    texture.rotation = (config.rotation * Math.PI) / 180;
                    texture.center.set(0.5, 0.5);
                    material.map = texture;
                    material.needsUpdate = true;
                    mesh.userData.currentTextureUrl = config.url;
                }, undefined, (err) => console.error("Texture failed:", config.url, err));
            } else if (material.map) {
                material.map.repeat.set(config.scale, config.scale);
                material.map.rotation = (config.rotation * Math.PI) / 180;
                material.map.offset.set(config.offsetX, config.offsetY);
            }
        } else if (config.url) {
            console.warn("Unsafe URL blocked:", config.url);
        } else {
            material.map = null;
            mesh.userData.currentTextureUrl = null;
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
            scale={[2, 2, 2]} 
            rotation={[0, Math.PI, 0]} 
            onPointerOver={(e: any) => { e.stopPropagation(); if(isInteractive(e.object.name)) document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { document.body.style.cursor = 'auto'; }}
            onClick={(e: any) => {
                e.stopPropagation();
                const mesh = e.object as THREE.Mesh;
                if (!isInteractive(mesh.name)) { onPartSelect(null); return; }
                mesh.userData.glowEnergy = 1.0;
                const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
                onPartSelect({ name: mesh.name, materialName: mat.name, id: mesh.uuid });
            }}
          />;
};

const InnerScene = React.memo(({ url, selectedPart, onPartSelect, textureMap, controls }: ModelProps) => {
    const [modelBottom, setModelBottom] = useState(-0.1);
    return (
        <Group>
            <Center onCentered={({ height }) => setModelBottom(-height / 2)}>
                <Model 
                    url={url} 
                    selectedPart={selectedPart} 
                    onPartSelect={onPartSelect}
                    textureMap={textureMap}
                    controls={controls}
                />
            </Center>
            <ContactShadows position={[0, modelBottom - 0.001, 0]} opacity={0.7} scale={1.5} blur={0.6} far={1.0} resolution={512} color="#000000" />
        </Group>
    );
});

interface ModelViewerProps {
  modelFile: File | null;
  selectedPart: SelectedPart | null;
  onPartSelect: (part: SelectedPart | null) => void;
  textureMap: Record<string, TextureConfig | null>;
  envPreset: string;
  envIntensity: number;
  envRotation: number;
  dirLightRotation: number;
  shadowBlur: number;
  shadowNormalBias: number;
  autoRotate: boolean;
}

const ModelViewer = React.forwardRef<any, ModelViewerProps>(({ 
    modelFile, selectedPart, onPartSelect, textureMap, envPreset, envIntensity, envRotation, dirLightRotation, shadowBlur, shadowNormalBias, autoRotate
}, ref) => {
  const [modelUrl, setModelUrl] = useState<string>(DEFAULT_MODEL_URL);
  const controlsRef = useRef<any>(null);
  const screenshotHandlerRef = useRef<any>(null);

  React.useImperativeHandle(ref, () => ({
      captureComposition: () => screenshotHandlerRef.current?.captureComposition() || Promise.resolve('')
  }));

  useEffect(() => {
    if (modelFile) {
      const url = URL.createObjectURL(modelFile);
      setModelUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setModelUrl(DEFAULT_MODEL_URL);
    }
  }, [modelFile]);

  const rad = (dirLightRotation * Math.PI) / 180;
  const dirLightX = Math.cos(rad) * 6;
  const dirLightZ = Math.sin(rad) * 6;

  return (
    <div className="w-full h-full bg-[#f8f9fa] relative">
      <Canvas shadows dpr={[1, 1.5]}
          gl={{ 
            preserveDrawingBuffer: true, antialias: true, powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2, shadowMapType: THREE.PCFShadowMap
          }}
          onPointerMissed={(e) => { if (e.type === 'click') onPartSelect(null); }}
      >
        <PerspectiveCamera makeDefault position={DEFAULT_VIEW.pos} fov={DEFAULT_VIEW.fov} near={0.01} />
        <OrbitControls 
            ref={controlsRef}
            makeDefault 
            minPolarAngle={0} 
            maxPolarAngle={Math.PI / 1.5} 
            enableDamping={true}
            dampingFactor={0.05}
            autoRotate={autoRotate}
            autoRotateSpeed={2.0}
        />
        <ScreenshotHandler ref={screenshotHandlerRef} />
        <Suspense fallback={<Html center><div className="flex flex-col items-center gap-4"><div className="w-8 h-8 border-2 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Initializing Scene...</p></div></Html>}>
            <ErrorBoundary key={modelUrl}>
                <InnerScene 
                    url={modelUrl}
                    selectedPart={selectedPart}
                    onPartSelect={onPartSelect}
                    textureMap={textureMap}
                    controls={controlsRef.current}
                />
                <Suspense fallback={null}>
                  <Environment preset={envPreset as any} environmentIntensity={envIntensity} environmentRotation={[0, (envRotation * Math.PI) / 180, 0]} />
                </Suspense>
                <AmbientLight intensity={0.4} />
                <DirectionalLight position={[dirLightX, 8, dirLightZ]} intensity={1.0} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0005} shadow-normalBias={shadowNormalBias} />
            </ErrorBoundary>
        </Suspense>
      </Canvas>
      <Loader />
      {selectedPart && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-md text-gray-900 px-5 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase shadow-sm z-10 flex items-center gap-3 border border-gray-100 transition-all">
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
          EDITING <span className="text-indigo-600">{selectedPart.name}</span>
        </div>
      )}
    </div>
  );
});

export default ModelViewer;
