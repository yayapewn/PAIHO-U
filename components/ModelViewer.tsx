import React, { Component, useEffect, useLayoutEffect, useState, Suspense, useRef, ErrorInfo, useMemo, useDeferredValue, ReactNode } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Html, useProgress, Environment, useEnvironment, PerspectiveCamera, Center, ContactShadows, AdaptiveEvents } from '@react-three/drei';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { ArrowUpRight } from 'lucide-react';
import { SelectedPart, TextureConfig, TextureItem } from '../types';
import { textureCacheManager } from '../services/textureCacheManager';
import {
  getNormalizedPartName,
  getPartStorageKey,
  isPartInteractive,
  isCategoryBPart,
  isSmartColorPart,
  isSmartInsolePart,
  isSmartInvertLabelPart,
  isSmartDarkTextPart,
  isSmartChromaLogoPart,
  isSmartKeepRedOnLightPart,
  getLinkedColorParts,
  getPartFocusPreset
} from '../services/partConfig';

const DEFAULT_VIEW = {
    pos: [0.85, 0, 0] as [number, number, number], 
    target: [0, 0, 0] as [number, number, number],
    fov: 37.8
};

interface CameraFocusState {
    active: boolean;
    target: THREE.Vector3;
    theta: number;
    phi: number;
    radius: number;
    triggerId: number;
}

// 預先配置可重用數學物件，避免點擊或逐幀鏡頭動畫產生 GC 壓力
const _focusMeshBox = new THREE.Box3();
const _focusSceneBox = new THREE.Box3();
const _focusMeshCenter = new THREE.Vector3();
const _focusSceneCenter = new THREE.Vector3();
const _focusSceneSize = new THREE.Vector3();
const _focusWorldNormal = new THREE.Vector3();
const _focusNormalMatrix = new THREE.Matrix3();
const _focusGoalTarget = new THREE.Vector3();
const _focusOffset = new THREE.Vector3();
const _focusSpherical = new THREE.Spherical();
const _focusFallbackDir = new THREE.Vector3();

const TRUSTED_DOMAINS = [
    'raw.githubusercontent.com',
    'huggingface.co',
    'aistudiocdn.com',
    'cdn.jsdelivr.net',
    'dl.polyhaven.org'
];

// R3F 內建元素宣告，避免 TypeScript 在某些環境下的編譯錯誤
const Group = 'group' as any;
const AmbientLight = 'ambientLight' as any;
const HemisphereLight = 'hemisphereLight' as any;
const DirectionalLight = 'directionalLight' as any;
const Primitive = 'primitive' as any;

const isInteractive = (name: string, modelId?: string) => isPartInteractive(name, modelId);

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

const sampleShoeWorldPoints = (shoeRoot: THREE.Object3D): THREE.Vector3[] => {
    shoeRoot.updateWorldMatrix(true, true);
    const points: THREE.Vector3[] = [];
    const tempV = new THREE.Vector3();
    const tempBox = new THREE.Box3();

    shoeRoot.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh || !mesh.visible) return;
        const posAttr = mesh.geometry?.attributes?.position;
        if (!posAttr || (mesh as THREE.SkinnedMesh).isSkinnedMesh) {
            tempBox.setFromObject(mesh);
            if (!tempBox.isEmpty()) {
                const { min, max } = tempBox;
                for (let ix = 0; ix < 2; ix++) {
                    for (let iy = 0; iy < 2; iy++) {
                        for (let iz = 0; iz < 2; iz++) {
                            points.push(new THREE.Vector3(
                                ix ? max.x : min.x,
                                iy ? max.y : min.y,
                                iz ? max.z : min.z
                            ));
                        }
                    }
                }
            }
            return;
        }
        const count = posAttr.count;
        const step = Math.max(1, Math.floor(count / 400));
        for (let i = 0; i < count; i += step) {
            tempV.fromBufferAttribute(posAttr, i).applyMatrix4(mesh.matrixWorld);
            points.push(tempV.clone());
        }
        if (count > 0) {
            tempV.fromBufferAttribute(posAttr, count - 1).applyMatrix4(mesh.matrixWorld);
            points.push(tempV.clone());
        }
    });

    if (points.length === 0) {
        for (const sx of [-0.25, 0.25]) {
            for (const sy of [-0.25, 0.25]) {
                for (const sz of [-0.25, 0.25]) {
                    points.push(new THREE.Vector3(sx, sy, sz));
                }
            }
        }
    }
    return points;
};

const computeShoeCenter = (points: THREE.Vector3[]): THREE.Vector3 => {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
        if (p.z < minZ) minZ = p.z;
        if (p.z > maxZ) maxZ = p.z;
    }

    return new THREE.Vector3(
        (minX + maxX) * 0.5,
        (minY + maxY) * 0.5,
        (minZ + maxZ) * 0.5
    );
};

const computeRequiredCameraDistance = (
    points: THREE.Vector3[],
    center: THREE.Vector3,
    viewDir: THREE.Vector3,
    upHint: THREE.Vector3,
    aspect: number,
    fovDeg: number,
    fillRatio: number
): number => {
    const zAxis = viewDir.clone().normalize();
    const xAxis = new THREE.Vector3().crossVectors(upHint, zAxis).normalize();
    const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize();

    const halfFovRad = THREE.MathUtils.degToRad(fovDeg) * 0.5;
    const tanY = Math.tan(halfFovRad);
    const tanX = Math.max(0.001, tanY * aspect);

    let requiredDist = 0.5;
    const offset = new THREE.Vector3();
    for (let i = 0; i < points.length; i++) {
        offset.subVectors(points[i], center);
        const dx = Math.abs(offset.dot(xAxis));
        const dy = Math.abs(offset.dot(yAxis));
        const dz = offset.dot(zAxis);
        const distForX = dz + dx / (fillRatio * tanX);
        const distForY = dz + dy / (fillRatio * tanY);
        if (distForX > requiredDist) requiredDist = distForX;
        if (distForY > requiredDist) requiredDist = distForY;
    }

    return requiredDist;
};

const hexToSrgbVec3 = (hex: string): THREE.Vector3 => {
    const clean = (hex || '#ffffff').replace('#', '').trim();
    const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
    const num = parseInt(full, 16);
    if (Number.isNaN(num) || full.length !== 6) return new THREE.Vector3(1, 1, 1);
    return new THREE.Vector3(((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255);
};

export interface CaptureCompositionResult {
    sheetUrl: string;
    heroUrl: string;
    partAreas: Record<string, number>;
}

const computePartSurfaceAreas = (shoeRoot: THREE.Object3D, modelId?: string): Record<string, number> => {
    shoeRoot.updateWorldMatrix(true, true);
    const areas: Record<string, number> = {};
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const ab = new THREE.Vector3();
    const ac = new THREE.Vector3();
    const cross = new THREE.Vector3();

    shoeRoot.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh || !mesh.visible) return;
        const posAttr = mesh.geometry?.attributes?.position;
        if (!posAttr) return;

        const normalized = getNormalizedPartName(mesh.name, modelId).toUpperCase();
        const displayKey = normalized === 'OBJECT019' ? 'INSOLE' : normalized === 'OBJECT011' ? 'AGLET' : normalized;

        let meshArea = 0;
        const index = mesh.geometry.index;
        if (index) {
            const count = index.count;
            for (let i = 0; i + 2 < count; i += 3) {
                a.fromBufferAttribute(posAttr, index.getX(i)).applyMatrix4(mesh.matrixWorld);
                b.fromBufferAttribute(posAttr, index.getX(i + 1)).applyMatrix4(mesh.matrixWorld);
                c.fromBufferAttribute(posAttr, index.getX(i + 2)).applyMatrix4(mesh.matrixWorld);
                ab.subVectors(b, a);
                ac.subVectors(c, a);
                cross.crossVectors(ab, ac);
                meshArea += cross.length() * 0.5;
            }
        } else {
            const count = posAttr.count;
            for (let i = 0; i + 2 < count; i += 3) {
                a.fromBufferAttribute(posAttr, i).applyMatrix4(mesh.matrixWorld);
                b.fromBufferAttribute(posAttr, i + 1).applyMatrix4(mesh.matrixWorld);
                c.fromBufferAttribute(posAttr, i + 2).applyMatrix4(mesh.matrixWorld);
                ab.subVectors(b, a);
                ac.subVectors(c, a);
                cross.crossVectors(ab, ac);
                meshArea += cross.length() * 0.5;
            }
        }

        areas[displayKey] = (areas[displayKey] || 0) + meshArea;
    });

    return areas;
};

const ScreenshotHandler = React.forwardRef<any, { contrast: number; sharpness: number; modelId?: string }>(({ contrast, sharpness, modelId }, ref) => {
    const { gl, scene, camera } = useThree();
    React.useImperativeHandle(ref, () => ({
        captureComposition: async (options?: { backdropHex?: string }) => {
            return new Promise<CaptureCompositionResult>((resolve) => {
                const perspCam = camera as THREE.PerspectiveCamera;
                const originalPosition = camera.position.clone();
                const originalRotation = camera.rotation.clone();
                const originalUp = camera.up.clone();
                const originalAspect = perspCam.aspect;
                const originalFov = perspCam.fov;
                const currentRenderTarget = gl.getRenderTarget();

                let composer: EffectComposer | null = null;
                let renderTarget: THREE.WebGLRenderTarget | null = null;
                let byteTarget: THREE.WebGLRenderTarget | null = null;
                let outputPass: OutputPass | null = null;
                let fxPass: ShaderPass | null = null;
                let backdropCompositePass: ShaderPass | null = null;

                try {
                    const bgHex = options?.backdropHex || '#ffffff';
                    const totalWidth = 2560;
                    const halfWidth = totalWidth / 2;
                    const halfHeight = 720;
                    const quarterWidth = halfWidth / 2;
                    const gutter = 20;
                    const slotH = halfHeight - gutter;

                    const isMobile = window.innerWidth < 768;
                    const supersample = isMobile ? 1 : 1.5;

                    let isSoftwareGl = false;
                    try {
                        const glCtx = gl.getContext();
                        const ext = glCtx.getExtension('WEBGL_debug_renderer_info');
                        const gpu = String(glCtx.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : glCtx.RENDERER));
                        isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
                    } catch {
                        isSoftwareGl = false;
                    }

                    const initW = Math.round((halfWidth - gutter) * supersample);
                    const initH = Math.round(slotH * supersample);

                    renderTarget = new THREE.WebGLRenderTarget(initW, initH, {
                        type: THREE.HalfFloatType,
                        samples: gl.capabilities.isWebGL2 && !isSoftwareGl ? 4 : 0,
                    });

                    composer = new EffectComposer(gl, renderTarget);
                    composer.renderToScreen = false;
                    composer.setPixelRatio(1);

                    const renderPass = new RenderPass(scene, camera);
                    renderPass.clear = true;
                    renderPass.clearColor = new THREE.Color(0x000000);
                    renderPass.clearAlpha = 0;

                    outputPass = new OutputPass();
                    fxPass = new ShaderPass(ContrastSharpnessShader);
                    fxPass.uniforms.uContrast.value = contrast;
                    fxPass.uniforms.uSharpness.value = sharpness;

                    composer.addPass(renderPass);
                    composer.addPass(outputPass);
                    composer.addPass(fxPass);

                    backdropCompositePass = new ShaderPass(BackdropCompositeShader);
                    backdropCompositePass.renderToScreen = false;
                    backdropCompositePass.material.blending = THREE.NoBlending;
                    backdropCompositePass.uniforms.uBgColor.value.copy(hexToSrgbVec3(bgHex));

                    byteTarget = new THREE.WebGLRenderTarget(initW, initH, {
                        format: THREE.RGBAFormat,
                        type: THREE.UnsignedByteType,
                    });

                    const shoeRoot = scene.getObjectByName('shoe-bounds-root') || scene;
                    const shoePoints = sampleShoeWorldPoints(shoeRoot);
                    const shoeCenter = computeShoeCenter(shoePoints);
                    const partAreas = computePartSurfaceAreas(shoeRoot, modelId);
                    let heroUrl = '';

                    // 採用長焦棚拍視角（6°）與全視角共用等距比例尺，確保 5 個視角呈真實 1:1 等比且鞋頭/鞋跟高度與地面基準一致
                    const STUDIO_FOV_DEG = 6;
                    const UNIFIED_FILL_RATIO = 0.82;
                    const defaultUp = new THREE.Vector3(0, 1, 0);
                    const topUp = new THREE.Vector3(-1, 0, 0);

                    const views = [
                        // 1. 左上：正側視圖 (Side View)
                        { row: 1 as const, x: 0, w: halfWidth - gutter, h: slotH, viewDir: new THREE.Vector3(1, 0, 0), upHint: defaultUp, captureStandaloneHero: false },
                        // 2. 左下：上視圖 (Top View)
                        { row: 2 as const, x: 0, w: halfWidth - gutter, h: slotH, viewDir: new THREE.Vector3(0, 1, 0), upHint: topUp, captureStandaloneHero: false },
                        // 3. 右上：45度角視圖 (Perspective View)
                        { row: 1 as const, x: halfWidth + gutter, w: halfWidth - gutter, h: slotH, viewDir: new THREE.Vector3(0.55, 0.4, 0.55), upHint: defaultUp, captureStandaloneHero: true },
                        // 4. 右下左：鞋頭視角 (Toe View)
                        { row: 2 as const, x: halfWidth + gutter, w: quarterWidth - gutter, h: slotH, viewDir: new THREE.Vector3(0, 0, 1), upHint: defaultUp, captureStandaloneHero: false },
                        // 5. 右下右：鞋跟視角 (Heel View)
                        { row: 2 as const, x: halfWidth + quarterWidth + gutter, w: quarterWidth - gutter, h: slotH, viewDir: new THREE.Vector3(0, 0, -1), upHint: defaultUp, captureStandaloneHero: false },
                    ];

                    let sharedDist = 1.0;
                    views.forEach((v) => {
                        const d = computeRequiredCameraDistance(
                            shoePoints,
                            shoeCenter,
                            v.viewDir,
                            v.upHint,
                            v.w / v.h,
                            STUDIO_FOV_DEG,
                            UNIFIED_FILL_RATIO
                        );
                        if (d > sharedDist) sharedDist = d;
                    });

                    interface RenderedViewSlot {
                        view: (typeof views)[number];
                        unflippedCanvas: HTMLCanvasElement;
                        renderW: number;
                        renderH: number;
                        minPy: number;
                        maxPy: number;
                    }

                    const projVec = new THREE.Vector3();

                    const renderViewSlot = (view: (typeof views)[number]): RenderedViewSlot | null => {
                        const aspect = view.w / view.h;
                        const camPos = shoeCenter.clone().addScaledVector(view.viewDir.clone().normalize(), sharedDist);

                        camera.up.copy(view.upHint);
                        camera.position.copy(camPos);
                        camera.lookAt(shoeCenter);

                        perspCam.aspect = aspect;
                        perspCam.fov = STUDIO_FOV_DEG;
                        perspCam.updateProjectionMatrix();
                        camera.updateMatrixWorld();

                        let minPy = view.h;
                        let maxPy = 0;
                        for (let i = 0; i < shoePoints.length; i++) {
                            projVec.copy(shoePoints[i]).project(camera);
                            const py = (1 - projVec.y) * 0.5 * view.h;
                            if (py < minPy) minPy = py;
                            if (py > maxPy) maxPy = py;
                        }
                        if (!(minPy < maxPy)) {
                            minPy = 0;
                            maxPy = view.h;
                        }

                        const renderW = Math.round(view.w * supersample);
                        const renderH = Math.round(view.h * supersample);

                        composer!.setSize(renderW, renderH);
                        fxPass!.uniforms.uTexelSize.value.set(1 / renderW, 1 / renderH);
                        composer!.render();

                        byteTarget!.setSize(renderW, renderH);
                        backdropCompositePass!.render(gl, byteTarget!, composer!.readBuffer, 0, false);

                        const buffer = new Uint8Array(renderW * renderH * 4);
                        gl.readRenderTargetPixels(byteTarget!, 0, 0, renderW, renderH, buffer);

                        const imgData = new ImageData(new Uint8ClampedArray(buffer), renderW, renderH);
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = renderW;
                        tempCanvas.height = renderH;
                        const tempCtx = tempCanvas.getContext('2d');
                        if (!tempCtx) return null;
                        tempCtx.putImageData(imgData, 0, 0);

                        const unflippedCanvas = document.createElement('canvas');
                        unflippedCanvas.width = renderW;
                        unflippedCanvas.height = renderH;
                        const unflippedCtx = unflippedCanvas.getContext('2d');
                        if (!unflippedCtx) return null;
                        unflippedCtx.translate(0, renderH);
                        unflippedCtx.scale(1, -1);
                        unflippedCtx.drawImage(tempCanvas, 0, 0);

                        return {
                            view,
                            unflippedCanvas,
                            renderW,
                            renderH,
                            minPy,
                            maxPy,
                        };
                    };

                    gl.shadowMap.needsUpdate = true;

                    const renderedSlots = views
                        .map((v) => renderViewSlot(v))
                        .filter((slot): slot is RenderedViewSlot => slot !== null);

                    const TOP_MARGIN_PX = 24;
                    const BOTTOM_SHADOW_MARGIN_PX = 46;
                    const OUTER_PAD_TOP = 24;
                    const ROW_GAP = 16;
                    const OUTER_PAD_BOTTOM = 16;

                    const row1Slots = renderedSlots.filter((s) => s.view.row === 1);
                    const row2Slots = renderedSlots.filter((s) => s.view.row === 2);

                    const rawRow1Top = (row1Slots.length ? Math.min(...row1Slots.map((s) => s.minPy)) : 0) - TOP_MARGIN_PX;
                    const rawRow1Bottom = (row1Slots.length ? Math.max(...row1Slots.map((s) => s.maxPy)) : slotH) + BOTTOM_SHADOW_MARGIN_PX;
                    const row1Top = Math.max(0, Math.floor(rawRow1Top / 2) * 2);
                    const row1Bottom = Math.min(slotH, Math.ceil(rawRow1Bottom / 2) * 2);
                    const row1H = Math.max(120, row1Bottom - row1Top);

                    const rawRow2Top = (row2Slots.length ? Math.min(...row2Slots.map((s) => s.minPy)) : 0) - TOP_MARGIN_PX;
                    const rawRow2Bottom = (row2Slots.length ? Math.max(...row2Slots.map((s) => s.maxPy)) : slotH) + BOTTOM_SHADOW_MARGIN_PX;
                    const row2Top = Math.max(0, Math.floor(rawRow2Top / 2) * 2);
                    const row2Bottom = Math.min(slotH, Math.ceil(rawRow2Bottom / 2) * 2);
                    const row2H = Math.max(120, row2Bottom - row2Top);

                    const compactTotalHeight = OUTER_PAD_TOP + row1H + ROW_GAP + row2H + OUTER_PAD_BOTTOM;

                    const canvas = document.createElement('canvas');
                    canvas.width = totalWidth;
                    canvas.height = compactTotalHeight;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) { resolve({ sheetUrl: '', heroUrl: '', partAreas: {} }); return; }
                    ctx.fillStyle = bgHex;
                    ctx.fillRect(0, 0, totalWidth, compactTotalHeight);

                    const drawRow = (slots: RenderedViewSlot[], cropTop: number, cropH: number, destY: number) => {
                        const sy = Math.round(cropTop * supersample);
                        const sh = Math.round(cropH * supersample);
                        slots.forEach((slot) => {
                            ctx.drawImage(
                                slot.unflippedCanvas,
                                0,
                                sy,
                                slot.renderW,
                                sh,
                                slot.view.x,
                                destY,
                                slot.view.w,
                                cropH
                            );

                            if (slot.view.captureStandaloneHero) {
                                const heroCanvas = document.createElement('canvas');
                                heroCanvas.width = slot.view.w;
                                heroCanvas.height = cropH;
                                const heroCtx = heroCanvas.getContext('2d');
                                if (heroCtx) {
                                    heroCtx.fillStyle = bgHex;
                                    heroCtx.fillRect(0, 0, slot.view.w, cropH);
                                    heroCtx.drawImage(
                                        slot.unflippedCanvas,
                                        0,
                                        sy,
                                        slot.renderW,
                                        sh,
                                        0,
                                        0,
                                        slot.view.w,
                                        cropH
                                    );
                                    heroUrl = heroCanvas.toDataURL('image/png', 0.92);
                                }
                            }
                        });
                    };

                    drawRow(row1Slots, row1Top, row1H, OUTER_PAD_TOP);
                    drawRow(row2Slots, row2Top, row2H, OUTER_PAD_TOP + row1H + ROW_GAP);

                    resolve({
                        sheetUrl: canvas.toDataURL('image/png', 0.92),
                        heroUrl,
                        partAreas,
                    });
                } catch (error) {
                    console.error("Screenshot error:", error);
                    resolve({ sheetUrl: '', heroUrl: '', partAreas: {} });
                } finally {
                    gl.setRenderTarget(currentRenderTarget);
                    camera.position.copy(originalPosition);
                    camera.rotation.copy(originalRotation);
                    camera.up.copy(originalUp);
                    perspCam.aspect = originalAspect;
                    perspCam.fov = originalFov;
                    perspCam.updateProjectionMatrix();
                    camera.updateMatrixWorld();

                    composer?.dispose();
                    renderTarget?.dispose();
                    byteTarget?.dispose();
                    outputPass?.dispose();
                    fxPass?.dispose();
                    backdropCompositePass?.dispose();
                }
            });
        }
    }));
    return null;
});

interface ErrorBoundaryProps { 
    children?: ReactNode;
    modelUrl?: string;
}

interface ErrorBoundaryState { 
    hasError: boolean; 
    error: any; 
    retryCount: number;
}

// Fixed ErrorBoundary by extending React.Component directly to ensure state, props, and setState are correctly recognized as inherited members.
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: any): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error("Model loading error:", error, errorInfo);
    const { modelUrl } = this.props;
    if (modelUrl && this.state.retryCount < 2) {
      const delay = 900 * (this.state.retryCount + 1);
      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.retryTimer = setTimeout(() => {
        try {
          useGLTF.clear(modelUrl);
        } catch {
          // ignore cache clear error
        }
        this.setState((prev) => ({
          hasError: false,
          error: null,
          retryCount: prev.retryCount + 1,
        }));
      }, delay);
    }
  }

  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  handleManualRetry = () => {
    if (this.props.modelUrl) {
      try {
        useGLTF.clear(this.props.modelUrl);
      } catch {
        // ignore cache clear error
      }
    }
    this.setState({ hasError: false, error: null, retryCount: 0 });
  };

  render() {
    const { hasError, retryCount } = this.state;
    const { children } = this.props;

    if (hasError) {
      if (retryCount < 2) {
        return null;
      }
      return (
        <Html center>
          <div className="bg-white p-6 rounded-2xl shadow-xl border border-gray-100 text-center w-80">
            <div className="text-red-500 font-bold mb-2 text-lg">Loading Failed</div>
            <p className="text-sm text-gray-500 mb-4">Unable to load the 3D model. Please check the URL or your connection.</p>
            <button 
                onClick={this.handleManualRetry} 
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

const CustomLoader = ({ hasWireframe }: { hasWireframe: boolean }) => {
  const { active, progress, item } = useProgress();
  const [show, setShow] = useState(false);
  const [visible, setVisible] = useState(false);
  const mountTime = useRef(Date.now());
  const timeoutRef = useRef<any>(null);

  useEffect(() => {
    if (active) {
        mountTime.current = Date.now();
        setShow(true);
        setVisible(true);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    } else {
        timeoutRef.current = setTimeout(() => {
            setShow(false);
            setTimeout(() => setVisible(false), 500);
        }, 0);
    }
    return () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [active]);

  if (!visible || hasWireframe) return null;

  return (
    <div className={`absolute inset-0 z-50 flex items-center justify-center pointer-events-none transition-opacity duration-500 ${show ? 'opacity-100' : 'opacity-0'} bg-[#0a0a0a]`}>
      <div className="w-72 flex flex-col gap-5">
        {/* Wireframe Hexagon Icon */}
        <div className="w-full flex justify-center mb-4">
          <svg className="w-12 h-12 text-indigo-500/80 animate-[spin_4s_linear_infinite]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"></polygon>
            <line x1="12" y1="22" x2="12" y2="15.5"></line>
            <polyline points="22 8.5 12 15.5 2 8.5"></polyline>
            <polyline points="2 15.5 12 8.5 22 15.5"></polyline>
            <line x1="12" y1="2" x2="12" y2="8.5"></line>
          </svg>
        </div>
        
        {/* Data HUD */}
        <div className="flex justify-between items-end">
          <span className="text-[9px] font-mono tracking-[0.3em] text-gray-500 uppercase">System Ready</span>
          <span className="text-[12px] font-mono tracking-widest text-indigo-400">{Math.round(progress)}%</span>
        </div>
        <div className="h-[1px] w-full bg-gray-900 relative overflow-hidden">
          <div className="absolute top-0 left-0 h-full bg-indigo-500/80 transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
        </div>
        <div className="text-[8px] font-mono tracking-[0.4em] text-gray-600 truncate uppercase">
          {item ? `Building: ${item.split('/').pop()}` : 'Initializing Geometry...'}
        </div>
      </div>
    </div>
  );
};

const animatedModels = new Set<string>();
const loadedModelUrls = new Set<string>();

const LoadingWireframeMesh = ({ url, colorModelUrl, scale, rotation, position, active, onComplete }: { url: string, colorModelUrl?: string, scale: number, rotation: any, position: any, active: boolean, onComplete: () => void }) => {
    const { scene } = useGLTF(url);
    const meshRef = useRef<THREE.Group>(null);
    const progress = useRef(0);
    
    useFrame((state, delta) => {
        if (!meshRef.current) return;
        
        const DURATION = 3.0; // Slowed down by 1x (half speed)
        const safeDelta = Math.min(delta, 0.1); 
        progress.current += safeDelta / DURATION;
        
        const isColorModelReady = !active || (colorModelUrl ? loadedModelUrls.has(colorModelUrl) : false);

        let isDone = false;
        if (progress.current >= 1.0) {
            if (isColorModelReady) {
                isDone = true;
                progress.current = 1.0;
            } else {
                progress.current -= 1.0; // Loop seamlessly until color model is ready
            }
        }
        
        const p = Math.max(0, Math.min(progress.current, 1.0));
        // easeInOutCubic
        const ease = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        
        // 讓原本水平設定的鞋款（Lace / DNA）在線框旋轉中段呈現與第一雙相近的立體傾角，結束時平滑歸零接回正位
        const dynamicTiltX = Math.abs(rotation[0]) < 0.001 ? -0.52 * Math.sin(ease * Math.PI) : 0;
        meshRef.current.rotation.x = rotation[0] + dynamicTiltX;
        meshRef.current.rotation.z = rotation[2];
        
        const targetY = rotation[1];
        const startY = targetY - Math.PI * 2;
        meshRef.current.rotation.y = startY + (Math.PI * 2) * ease;
        
        if (isDone) {
            onComplete();
        }
    });

    useMemo(() => {
        scene.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
                const mesh = child as THREE.Mesh;
                mesh.material = new THREE.MeshStandardMaterial({
                    color: '#818cf8',
                    emissive: '#4f46e5',
                    emissiveIntensity: 0.8,
                    wireframe: true,
                    transparent: true,
                    opacity: 0.3,
                });
            }
        });
    }, [scene]);

    return (
        <group position={position}>
            <group ref={meshRef}>
                <Center>
                    <primitive object={scene} scale={scale} />
                </Center>
            </group>
        </group>
    );
};

const WireframeFallback = ({ onComplete }: { onComplete: () => void }) => {
    useEffect(() => {
        onComplete();
    }, [onComplete]);
    return null;
};

const LoadingWireframeOverlay = ({ url, colorModelUrl, scale, rotation, position, modelId, onComplete }: { url: string, colorModelUrl?: string, scale: number, rotation: any, position: any, modelId: string, onComplete: () => void }) => {
    const { active } = useProgress();
    
    const adjustedScale = modelId === 'traveler' ? scale * 0.98 : scale;
    
    if (!url) return null;
    
    return (
        <Suspense fallback={null}>
            <LoadingWireframeMesh 
                url={url} 
                colorModelUrl={colorModelUrl}
                scale={adjustedScale} 
                rotation={rotation} 
                position={position} 
                active={active} 
                onComplete={() => {
                    animatedModels.add(modelId || '');
                    onComplete();
                }} 
            />
        </Suspense>
    );
};

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
  isOrbitDraggingRef?: React.MutableRefObject<boolean>;
  focusStateRef?: React.MutableRefObject<CameraFocusState>;
}

const Model: React.FC<ModelProps & { interactive?: boolean }> = ({ url, modelId, modelScale, modelRotation, selectedPart, onPartSelect, textureMap, controls, isPickingColor, onColorPicked, isOrbitDraggingRef, focusStateRef, interactive = true }) => {
  const { scene } = useGLTF(url);
  const { gl, camera, size } = useThree();
  
  useEffect(() => {
    if (url) loadedModelUrls.add(url);
  }, [url]);

  // 用於判斷是拖曳旋轉還是點擊部位
  const pointerDownPos = useRef({ x: 0, y: 0 });

  const cachedMeshes = useMemo(() => {
    const interactive: THREE.Mesh[] = [];
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        if (!mesh.userData.hasClonedMaterial) {
            if (Array.isArray(mesh.material)) {
                mesh.material = mesh.material.map(m => m.clone());
            } else {
                mesh.material = (mesh.material as THREE.Material).clone();
            }
            mesh.userData.hasClonedMaterial = true;
        }

        if (!mesh.userData.originalMaterial) {
            mesh.userData.originalMaterial = Array.isArray(mesh.material) 
                ? mesh.material[0].clone() 
                : (mesh.material as THREE.Material).clone();
                
            // 針對鞋墊 (OBJECT019)，從最源頭剝離其光澤度，確保初始與還原時都無光澤
            if (isSmartInsolePart(getNormalizedPartName(mesh.name, modelId), modelId)) {
                mesh.userData.originalMaterial.roughness = 1.0;
                mesh.userData.originalMaterial.roughnessMap = null;
            }
        }
        
        // 使用 isInteractive 來判斷是否為可互動部位 (支援黑白名單與各鞋款獨立機制)
        const interactiveFlag = isInteractive(mesh.name, modelId);

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

                // SMART COLOR LOGIC FOR LOGO RETENTION (依鞋款獨立設定)
                const pName = getNormalizedPartName(mesh.name, modelId);
                const isSmartPart = isSmartColorPart(pName, modelId);

                if (isSmartPart) {
                    // 提升標籤／織帶貼圖各向異性過濾上限，避免拉遠或斜角檢視時小字模糊失真
                    const maxAniso = Math.min(16, gl.capabilities.getMaxAnisotropy());
                    if (newMat.map && newMat.map.anisotropy < maxAniso) {
                        newMat.map.anisotropy = maxAniso;
                        newMat.map.needsUpdate = true;
                    }
                    if (originalMat?.map && originalMat.map.anisotropy < maxAniso) {
                        originalMat.map.anisotropy = maxAniso;
                        originalMat.map.needsUpdate = true;
                    }
                    newMat.userData.shaderUniforms = {
                        uSmartColorEnabled: { value: 0.0 },
                        uIsSmartInsole: { value: isSmartInsolePart(pName, modelId) ? 1.0 : 0.0 },
                        uIsSmartInvertLabel: { value: isSmartInvertLabelPart(pName, modelId) ? 1.0 : 0.0 },
                        uIsSmartDarkText: { value: isSmartDarkTextPart(pName, modelId) ? 1.0 : 0.0 },
                        uIsSmartChromaLogo: { value: isSmartChromaLogoPart(pName, modelId) ? 1.0 : 0.0 },
                        uIsSmartKeepRedOnLight: { value: isSmartKeepRedOnLightPart(pName, modelId) ? 1.0 : 0.0 }
                    };

                    newMat.onBeforeCompile = (shader: any) => {
                        shader.uniforms.uSmartColorEnabled = newMat.userData.shaderUniforms.uSmartColorEnabled;
                        shader.uniforms.uIsSmartInsole = newMat.userData.shaderUniforms.uIsSmartInsole;
                        shader.uniforms.uIsSmartInvertLabel = newMat.userData.shaderUniforms.uIsSmartInvertLabel;
                        shader.uniforms.uIsSmartDarkText = newMat.userData.shaderUniforms.uIsSmartDarkText;
                        shader.uniforms.uIsSmartChromaLogo = newMat.userData.shaderUniforms.uIsSmartChromaLogo;
                        shader.uniforms.uIsSmartKeepRedOnLight = newMat.userData.shaderUniforms.uIsSmartKeepRedOnLight;

                        shader.fragmentShader = `
                            uniform float uSmartColorEnabled;
                            uniform float uIsSmartInsole;
                            uniform float uIsSmartInvertLabel;
                            uniform float uIsSmartDarkText;
                            uniform float uIsSmartChromaLogo;
                            uniform float uIsSmartKeepRedOnLight;
                            ${shader.fragmentShader}
                        `;

                        shader.fragmentShader = shader.fragmentShader.replace(
                            '#include <map_fragment>',
                            `
                            #include <map_fragment>
                            #ifdef USE_MAP
                                if ( uSmartColorEnabled > 0.5 ) {
                                    if ( uIsSmartInvertLabel > 0.5 ) {
                                        // 第 4.2 種：高對比智慧標籤模式（底色改為目標色，文字/Logo 依背景明度自動切換）
                                        vec3 texSrgb = pow(clamp(sampledDiffuseColor.rgb, 0.00001, 1.0), vec3(1.0 / 2.2));
                                        float texSrgbLum = dot(texSrgb, vec3(0.2126, 0.7152, 0.0722));
                                        float texSrgbChroma = max(texSrgb.r, max(texSrgb.g, texSrgb.b)) - min(texSrgb.r, min(texSrgb.g, texSrgb.b));

                                        float bgLinearLum = dot(diffuse, vec3(0.2126, 0.7152, 0.0722));
                                        float bgPerceivedLum = pow(clamp(bgLinearLum, 0.00001, 1.0), 1.0 / 2.2);
                                        float blackTextFactor = smoothstep(0.66, 0.78, bgPerceivedLum);

                                        if ( uIsSmartKeepRedOnLight > 0.5 ) {
                                            // 稍微負向 LOD 偏移取樣以對抗遠距 Mipmap 模糊，讓細小字體拉遠依然清晰
                                            vec4 sharpTex = texture2D( map, vMapUv, -0.85 );
                                            vec3 sharpSrgb = pow(clamp(sharpTex.rgb, 0.00001, 1.0), vec3(1.0 / 2.2));
                                            float sharpSrgbLum = dot(sharpSrgb, vec3(0.2126, 0.7152, 0.0722));

                                            // 淺色底：以負 LOD 增強文字清晰度後進行正片疊底＋保護紅色 Logo，完整保留細字與織紋
                                            vec3 crispBaseColor = mix(sampledDiffuseColor.rgb, sharpTex.rgb, 0.75);
                                            vec3 tintedCanvas = crispBaseColor * diffuse;
                                            float redDominance = crispBaseColor.r - max(crispBaseColor.g, crispBaseColor.b);
                                            float logoAlpha = clamp((redDominance - 0.04) * 1.6, 0.0, 1.0);
                                            vec3 redRestore = vec3(crispBaseColor.r, 0.0, 0.0);
                                            vec3 lightModeColor = tintedCanvas + logoAlpha * redRestore * (vec3(1.0) - diffuse);

                                            // 暗色底：放寬低亮度擷取曲線並套用銳化遮罩，拉遠時細字與紅色標誌皆保持清晰純白
                                            float sharpRedDomSrgb = sharpSrgb.r - max(sharpSrgb.g, sharpSrgb.b);
                                            float redMask = smoothstep(0.06, 0.38, sharpRedDomSrgb);
                                            float darkMaskRaw = clamp((0.80 - sharpSrgbLum) / 0.52, 0.0, 1.0);
                                            float darkMask = pow(darkMaskRaw, 0.72);
                                            float graphicMask = max(darkMask, redMask);
                                            vec3 darkModeColor = mix(diffuse, vec3(1.0), graphicMask);

                                            diffuseColor.rgb = mix(darkModeColor, lightModeColor, blackTextFactor);
                                        } else {
                                            // C: 灰/白底彩色Logo（抓彩度） | B: 淺底黑字（抓低亮度） | A: 黑底白字（抓高亮度）
                                            float textMask = uIsSmartChromaLogo > 0.5
                                                ? smoothstep(0.08, 0.35, texSrgbChroma)
                                                : (uIsSmartDarkText > 0.5
                                                    ? (1.0 - smoothstep(0.18, 0.52, texSrgbLum))
                                                    : smoothstep(0.25, 0.78, texSrgbLum));

                                            vec3 textColor = mix(vec3(1.0), vec3(0.0), blackTextFactor);

                                            diffuseColor.rgb = mix(diffuse, textColor, textMask);
                                        }
                                    } else {
                                        // 1. Multiply blending for the background and black text
                                        // This natively perfectly handles anti-aliasing for black text and gray shadows.
                                        vec3 tintedCanvas = sampledDiffuseColor.rgb * diffuse;
                                        
                                        // 2. Logo Protection Mask (Red Dominance)
                                        // Extract how "red" the pixel is. 1.5 multiplier ensures the core logo is fully protected 
                                        // even if it's a slightly darker red, while smoothstep/clamp handles the anti-aliased edges.
                                        float redDominance = sampledDiffuseColor.r - max(sampledDiffuseColor.g, sampledDiffuseColor.b);
                                        float logoAlpha = clamp(redDominance * 1.5, 0.0, 1.0);
                                        
                                        // 3. Mathematical Un-Premultiply for Red Logo
                                        // We only need to restore the Red channel that might be destroyed by tintedCanvas (e.g. if diffuse is Cyan).
                                        // The G and B channels of the red logo are naturally dark and can safely be multiplied.
                                        vec3 redRestore = vec3(sampledDiffuseColor.r, 0.0, 0.0);
                                        
                                        // Final Color: Tinted Canvas + Restored Red (only where background color suppressed it)
                                        diffuseColor.rgb = tintedCanvas + logoAlpha * redRestore * (vec3(1.0) - diffuse);
                                    }
                                }
                            #endif
                            `
                        );
                    };
                }
                mesh.material = newMat;
                mesh.userData.isCustomMaterial = true;
                mesh.userData.glowEnergy = 0;
            }
        }
      }
    });

    return interactive;
  }, [scene, modelId, gl]);

  useEffect(() => {
    const handlePreviewColor = (e: any) => {
      const { partId, modelId: eventModelId, color } = e.detail;
      if (eventModelId && eventModelId !== modelId) return;

      const clickedMesh = cachedMeshes.find(m => m.uuid === partId);
      
      if (clickedMesh) {
        const targetPartName = getNormalizedPartName(clickedMesh.name, modelId);
        const linkedPartSet = new Set(
          getLinkedColorParts(targetPartName, modelId).map((name) => name.toUpperCase())
        );
        
        cachedMeshes.forEach(mesh => {
            const meshPartName = getNormalizedPartName(mesh.name, modelId);
            if (linkedPartSet.has(meshPartName.toUpperCase())) {
                const material = mesh.material as THREE.MeshStandardMaterial;
                if (material && material.color) {
                    material.color.set(color);

                    if (material.userData.shaderUniforms?.uSmartColorEnabled && !mesh.userData.appliedColorUrl) {
                        material.userData.shaderUniforms.uSmartColorEnabled.value = 1.0;
                    }

                    if (isCategoryBPart(meshPartName, modelId)) {
                        const origMat = Array.isArray(mesh.userData.originalMaterial)
                            ? mesh.userData.originalMaterial[0]
                            : mesh.userData.originalMaterial;
                        let changed = false;
                        if (material.map !== null) {
                            if (origMat && material.map !== origMat.map && !mesh.userData.appliedColorUrl) {
                                material.map.dispose();
                            }
                            material.map = null;
                            changed = true;
                        }
                        if (material.aoMap !== null) { material.aoMap = null; changed = true; }
                        if (material.lightMap !== null) { material.lightMap = null; changed = true; }
                        if (material.emissiveMap !== null) { material.emissiveMap = null; changed = true; }
                        if (material.vertexColors) { material.vertexColors = false; changed = true; }
                        if (changed) material.needsUpdate = true;
                    }
                }
            }
        });
      }
    };
    window.addEventListener('preview-part-color', handlePreviewColor);
    return () => window.removeEventListener('preview-part-color', handlePreviewColor);
  }, [cachedMeshes, modelId]);

  useLayoutEffect(() => {
    const applyResolvedTextures = (
      mesh: THREE.Mesh,
      material: THREE.MeshStandardMaterial,
      origMat: THREE.MeshStandardMaterial,
      config: TextureConfig,
      hasColorMap: boolean,
      hasNormalMap: boolean,
      colorTexture: THREE.Texture | null,
      normalTexture: THREE.Texture | null
    ) => {
      // 釋放先前以此 Mesh 保留的貼圖引用計數
      if (mesh.userData.appliedColorUrl && mesh.userData.appliedColorUrl !== config.url) {
        textureCacheManager.releaseTexture(mesh.userData.appliedColorUrl);
        mesh.userData.appliedColorUrl = null;
      }
      if (mesh.userData.appliedNormalUrl && mesh.userData.appliedNormalUrl !== config.normalUrl) {
        textureCacheManager.releaseTexture(mesh.userData.appliedNormalUrl);
        mesh.userData.appliedNormalUrl = null;
      }

      // 套用 Color 貼圖（使用獨立 clone 以免共用同一貼圖時 UV repeat/offset 互相蓋掉）
      if (mesh.userData.clonedColorTex) {
        mesh.userData.clonedColorTex.dispose();
        mesh.userData.clonedColorTex = null;
      }
      if (hasColorMap && colorTexture) {
        const appliedColorTex = colorTexture.clone();
        appliedColorTex.repeat.set(config.scale, config.scale);
        appliedColorTex.offset.set(config.offsetX, config.offsetY);
        appliedColorTex.rotation = (config.rotation * Math.PI) / 180;
        appliedColorTex.center.set(0.5, 0.5);
        appliedColorTex.needsUpdate = true;

        mesh.userData.clonedColorTex = appliedColorTex;
        material.map = appliedColorTex;
        if (mesh.userData.appliedColorUrl !== config.url) {
          textureCacheManager.retainTexture(config.url);
          mesh.userData.appliedColorUrl = config.url;
        }
      } else if (!hasColorMap) {
        material.map = origMat.map;
      }

      // 套用 Normal 貼圖
      if (mesh.userData.clonedNormalTex) {
        mesh.userData.clonedNormalTex.dispose();
        mesh.userData.clonedNormalTex = null;
      }
      if (hasNormalMap && normalTexture) {
        const appliedNormalTex = normalTexture.clone();
        appliedNormalTex.repeat.set(config.scale, config.scale);
        appliedNormalTex.offset.set(config.offsetX, config.offsetY);
        appliedNormalTex.rotation = (config.rotation * Math.PI) / 180;
        appliedNormalTex.center.set(0.5, 0.5);
        appliedNormalTex.needsUpdate = true;

        mesh.userData.clonedNormalTex = appliedNormalTex;
        material.normalMap = appliedNormalTex;
        if (mesh.userData.appliedNormalUrl !== config.normalUrl) {
          textureCacheManager.retainTexture(config.normalUrl);
          mesh.userData.appliedNormalUrl = config.normalUrl;
        }
      } else if (!hasNormalMap) {
        material.normalMap = origMat.normalMap;
      }

      material.needsUpdate = true;
    };

    cachedMeshes.forEach(mesh => {
      const partName = getNormalizedPartName(mesh.name, modelId);
      const partKey = getPartStorageKey(modelId, partName);
      const config = textureMap[partKey];
      if (config) {
        const material = mesh.material as THREE.MeshStandardMaterial;
        if (config.color) material.color.set(config.color);
        else material.color.setHex(0xffffff);

        const origMat = Array.isArray(mesh.userData.originalMaterial) ? mesh.userData.originalMaterial[0] : mesh.userData.originalMaterial;

        if (config.url && isUrlSafe(config.url)) {
            material.roughness = config.roughness;
            if (material.roughnessMap !== null) { material.roughnessMap = null; material.needsUpdate = true; }
            if (material.metalnessMap !== null) { material.metalnessMap = null; material.needsUpdate = true; }
        } else {
            material.roughness = origMat.roughness;
            if (material.roughnessMap !== origMat.roughnessMap) { material.roughnessMap = origMat.roughnessMap; material.needsUpdate = true; }
            if (material.metalnessMap !== origMat.metalnessMap) { material.metalnessMap = origMat.metalnessMap; material.needsUpdate = true; }
        }
        material.metalness = config.metalness !== undefined ? config.metalness : origMat.metalness;
        material.opacity = config.opacity;
        material.alphaTest = 0.05;
        
        const hasColorMap = Boolean(config.url && isUrlSafe(config.url));
        const hasNormalMap = Boolean(config.normalUrl && isUrlSafe(config.normalUrl));

        if (material.userData.shaderUniforms) {
            material.userData.shaderUniforms.uSmartColorEnabled.value = hasColorMap ? 0.0 : 1.0;
        }

        // 定義材質組合 Key 以辨識是否有貼圖變更
        const textureComboKey = `${config.url || ''}|${config.normalUrl || ''}`;

        if (hasColorMap || hasNormalMap) {
            if (mesh.userData.currentTextureComboKey !== textureComboKey) {
                mesh.userData.currentTextureComboKey = textureComboKey;

                // 產生請求版本號以徹底防止 Race Condition
                const currentToken = (mesh.userData.selectionToken || 0) + 1;
                mesh.userData.selectionToken = currentToken;

                // 若貼圖已在快取中，直接於繪製前同步套用，徹底消除切換鞋款時的閃爍
                const syncColorTex = hasColorMap && config.url ? textureCacheManager.getCachedTexture(config.url) : null;
                const syncNormalTex = hasNormalMap && config.normalUrl ? textureCacheManager.getCachedTexture(config.normalUrl) : null;
                if ((!hasColorMap || syncColorTex) && (!hasNormalMap || syncNormalTex)) {
                    applyResolvedTextures(mesh, material, origMat, config, hasColorMap, hasNormalMap, syncColorTex, syncNormalTex);
                } else {
                    // 若該貼圖在預載佇列中，立即將優先度升至最高
                    if (config.url) textureCacheManager.boostPriority(config.url);
                    if (config.normalUrl) textureCacheManager.boostPriority(config.normalUrl);

                    const loadPromises: Promise<{ type: 'color' | 'normal'; texture: THREE.Texture | null }>[] = [];

                    if (hasColorMap && config.url) {
                        loadPromises.push(
                            textureCacheManager.loadTexture(config.url, false)
                                .then(texture => ({ type: 'color' as const, texture }))
                                .catch(() => ({ type: 'color' as const, texture: null }))
                        );
                    }

                    if (hasNormalMap && config.normalUrl) {
                        loadPromises.push(
                            textureCacheManager.loadTexture(config.normalUrl, true)
                                .then(texture => ({ type: 'normal' as const, texture }))
                                .catch(() => ({ type: 'normal' as const, texture: null }))
                        );
                    }

                    Promise.all(loadPromises).then((results) => {
                        // 若在非同步載入期間使用者已點選其他材質，直接捨棄此過時回應
                        if (mesh.userData.selectionToken !== currentToken) {
                            return;
                        }

                        let colorTexture: THREE.Texture | null = null;
                        let normalTexture: THREE.Texture | null = null;

                        results.forEach(res => {
                            if (res.type === 'color') colorTexture = res.texture;
                            if (res.type === 'normal') normalTexture = res.texture;
                        });

                        applyResolvedTextures(mesh, material, origMat, config, hasColorMap, hasNormalMap, colorTexture, normalTexture);
                    });
                }
            } else {
                // 若為同一套材質，僅即時更新 UV 變形 (Scale, Offset, Rotation)
                if (material.map && material.map !== origMat.map) {
                    material.map.repeat.set(config.scale, config.scale);
                    material.map.rotation = (config.rotation * Math.PI) / 180;
                    material.map.offset.set(config.offsetX, config.offsetY);
                }
                if (material.normalMap && material.normalMap !== origMat.normalMap) {
                    material.normalMap.repeat.set(config.scale, config.scale);
                    material.normalMap.rotation = (config.rotation * Math.PI) / 180;
                    material.normalMap.offset.set(config.offsetX, config.offsetY);
                }
            }
        } else {
            // 無貼圖要求：釋放已套用的貼圖引用與獨立 clone
            if (mesh.userData.clonedColorTex) {
                mesh.userData.clonedColorTex.dispose();
                mesh.userData.clonedColorTex = null;
            }
            if (mesh.userData.clonedNormalTex) {
                mesh.userData.clonedNormalTex.dispose();
                mesh.userData.clonedNormalTex = null;
            }
            if (mesh.userData.appliedColorUrl) {
                textureCacheManager.releaseTexture(mesh.userData.appliedColorUrl);
                mesh.userData.appliedColorUrl = null;
            }
            if (mesh.userData.appliedNormalUrl) {
                textureCacheManager.releaseTexture(mesh.userData.appliedNormalUrl);
                mesh.userData.appliedNormalUrl = null;
            }
            mesh.userData.currentTextureComboKey = null;
            
            const normalizedPartName = getNormalizedPartName(mesh.name, modelId);
            const isCategoryB = isCategoryBPart(normalizedPartName, modelId);
            
            if (isCategoryB) {
                let changed = false;
                if (material.map !== null) { material.map = null; changed = true; }
                if (material.aoMap !== null) { material.aoMap = null; changed = true; }
                if (material.lightMap !== null) { material.lightMap = null; changed = true; }
                if (material.emissiveMap !== null) { material.emissiveMap = null; changed = true; }
                if (material.vertexColors) { material.vertexColors = false; changed = true; }
                if (changed) {
                    material.needsUpdate = true;
                }
            } else {
                let changed = false;
                if (material.map !== origMat.map) {
                    material.map = origMat.map;
                    changed = true;
                }
                if (material.aoMap !== origMat.aoMap) {
                    material.aoMap = origMat.aoMap;
                    changed = true;
                }
                if (material.lightMap !== origMat.lightMap) {
                    material.lightMap = origMat.lightMap;
                    changed = true;
                }
                if (material.emissiveMap !== origMat.emissiveMap) {
                    material.emissiveMap = origMat.emissiveMap;
                    changed = true;
                }
                if (material.vertexColors !== origMat.vertexColors) {
                    material.vertexColors = origMat.vertexColors;
                    changed = true;
                }
                
                if (material.normalMap !== origMat.normalMap) {
                    material.normalMap = origMat.normalMap;
                    changed = true;
                }

                if (changed) {
                    material.needsUpdate = true;
                }
            }
        }
      } else {
        // config 為空：釋放先前可能引用的貼圖與獨立 clone
        if (mesh.userData.clonedColorTex) {
            mesh.userData.clonedColorTex.dispose();
            mesh.userData.clonedColorTex = null;
        }
        if (mesh.userData.clonedNormalTex) {
            mesh.userData.clonedNormalTex.dispose();
            mesh.userData.clonedNormalTex = null;
        }
        if (mesh.userData.appliedColorUrl) {
            textureCacheManager.releaseTexture(mesh.userData.appliedColorUrl);
            mesh.userData.appliedColorUrl = null;
        }
        if (mesh.userData.appliedNormalUrl) {
            textureCacheManager.releaseTexture(mesh.userData.appliedNormalUrl);
            mesh.userData.appliedNormalUrl = null;
        }
        mesh.userData.currentTextureComboKey = null;

        const origMat = Array.isArray(mesh.userData.originalMaterial) ? mesh.userData.originalMaterial[0] : mesh.userData.originalMaterial;
        if (!origMat) return;
        const material = mesh.material as THREE.MeshStandardMaterial;
        
        let changed = false;
        
        if (!material.color.equals(origMat.color)) {
            material.color.copy(origMat.color);
            changed = true;
        }
        if (material.roughness !== origMat.roughness) {
            material.roughness = origMat.roughness;
            changed = true;
        }
        if (material.metalness !== origMat.metalness) {
            material.metalness = origMat.metalness;
            changed = true;
        }
        
        if (material.map !== origMat.map) {
            material.map = origMat.map;
            mesh.userData.currentTextureUrl = null;
            changed = true;
        }
        if (material.normalMap !== origMat.normalMap) {
            material.normalMap = origMat.normalMap;
            mesh.userData.currentNormalUrl = null;
            changed = true;
        }
        if (material.roughnessMap !== origMat.roughnessMap) {
            material.roughnessMap = origMat.roughnessMap;
            changed = true;
        }
        if (material.metalnessMap !== origMat.metalnessMap) {
            material.metalnessMap = origMat.metalnessMap;
            changed = true;
        }
        if (material.aoMap !== origMat.aoMap) {
            material.aoMap = origMat.aoMap;
            changed = true;
        }
        if (material.lightMap !== origMat.lightMap) {
            material.lightMap = origMat.lightMap;
            changed = true;
        }
        if (material.emissiveMap !== origMat.emissiveMap) {
            material.emissiveMap = origMat.emissiveMap;
            changed = true;
        }
        if (material.vertexColors !== origMat.vertexColors) {
            material.vertexColors = origMat.vertexColors;
            changed = true;
        }
        
        if (material.userData.shaderUniforms && material.userData.shaderUniforms.uSmartColorEnabled) {
            if (material.userData.shaderUniforms.uSmartColorEnabled.value !== 0.0) {
                material.userData.shaderUniforms.uSmartColorEnabled.value = 0.0;
            }
        }
        
        if (changed) {
            material.needsUpdate = true;
        }
      }
    });
  }, [cachedMeshes, textureMap, modelId]);

  // 僅於卸載或切換鞋款時釋放獨立克隆貼圖與清除 combo key，確保切回先前鞋型時可完整重建套用貼圖
  useLayoutEffect(() => {
    return () => {
      cachedMeshes.forEach(mesh => {
        mesh.userData.selectionToken = (mesh.userData.selectionToken || 0) + 1;
        mesh.userData.currentTextureComboKey = null;
        const material = mesh.material as THREE.MeshStandardMaterial;
        const origMat = Array.isArray(mesh.userData.originalMaterial)
          ? mesh.userData.originalMaterial[0]
          : mesh.userData.originalMaterial;
        if (mesh.userData.clonedColorTex) {
          if (material && material.map === mesh.userData.clonedColorTex) {
            material.map = origMat?.map ?? null;
          }
          mesh.userData.clonedColorTex.dispose();
          mesh.userData.clonedColorTex = null;
        }
        if (mesh.userData.clonedNormalTex) {
          if (material && material.normalMap === mesh.userData.clonedNormalTex) {
            material.normalMap = origMat?.normalMap ?? null;
          }
          mesh.userData.clonedNormalTex.dispose();
          mesh.userData.clonedNormalTex = null;
        }
        if (mesh.userData.appliedColorUrl) {
          textureCacheManager.releaseTexture(mesh.userData.appliedColorUrl);
          mesh.userData.appliedColorUrl = null;
        }
        if (mesh.userData.appliedNormalUrl) {
          textureCacheManager.releaseTexture(mesh.userData.appliedNormalUrl);
          mesh.userData.appliedNormalUrl = null;
        }
      });
    };
  }, [cachedMeshes, modelId]);

  useFrame((state, delta) => {
    for (let i = 0; i < cachedMeshes.length; i++) {
        const mesh = cachedMeshes[i];
        const energy = mesh.userData.glowEnergy;
        if (!energy || energy <= 0) continue;

        const material = mesh.material as THREE.MeshStandardMaterial;
        if (material && 'emissive' in material) {
            const nextEnergy = THREE.MathUtils.lerp(energy, 0, Math.min(1, delta * 2.0));
            if (nextEnergy <= 0.001) {
                mesh.userData.glowEnergy = 0;
                material.emissiveIntensity = 0;
            } else {
                mesh.userData.glowEnergy = nextEnergy;
                material.emissiveIntensity = Math.sin(nextEnergy * Math.PI) * 0.1;
            }
        } else {
            mesh.userData.glowEnergy = 0;
        }
    }
  });

  return <Primitive 
            object={scene} 
            scale={[modelScale, modelScale, modelScale]} 
            rotation={modelRotation} 
            onPointerDown={(e: any) => {
                if (!interactive) return;
                pointerDownPos.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerOver={(e: any) => { 
                if (!interactive || isOrbitDraggingRef?.current) return;
                e.stopPropagation(); 
                if (isPickingColor) {
                    document.body.style.cursor = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'><g stroke='rgba(255,255,255,0.8)' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'><path d='m2 22 1-1h3l9-9'/><path d='M3 21v-3l9-9'/><path d='m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z'/></g><g stroke='black' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'><polygon points='3,21 3,18 12,9 15,12 6,21' fill='white'/><path d='m2 22 1-1' stroke-width='2'/><path d='m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z' fill='black'/></g></svg>") 0 24, crosshair`;
                    return;
                }
                const interactiveFlag = isInteractive(e.object.name, modelId);
                if(interactiveFlag) document.body.style.cursor = 'pointer'; 
            }}
            onPointerOut={() => { if (!interactive || isOrbitDraggingRef?.current) return; document.body.style.cursor = 'auto'; }}
            onClick={(e: any) => {
                if (!interactive) return;
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
                            const img = standardMat.map.image as HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap;
                            canvas.width = ('videoWidth' in img ? img.videoWidth : img.width) || 1024;
                            canvas.height = ('videoHeight' in img ? img.videoHeight : img.height) || 1024;
                            const ctx = canvas.getContext('2d', { willReadFrequently: true });
                            if (ctx) {
                                ctx.drawImage(img as CanvasImageSource, 0, 0, canvas.width, canvas.height);
                                
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

                const interactiveFlag = isInteractive(mesh.name, modelId);
                
                if (!interactiveFlag) { onPartSelect(null); return; }
                
                // 使用標準化的部位名稱以更新 UI（依鞋款獨立解析）
                const normalizedPartName = getNormalizedPartName(mesh.name, modelId);
                const linkedPartSet = new Set(
                    getLinkedColorParts(normalizedPartName, modelId).map((name) => name.toUpperCase())
                );

                // 使同鞋款所有同名及連動部位一起發光
                cachedMeshes.forEach(m => {
                    if (linkedPartSet.has(getNormalizedPartName(m.name, modelId).toUpperCase())) {
                        m.userData.glowEnergy = 1.0;
                    }
                });

                // 計算點擊部位的最佳對焦視角與距離，觸發平滑鏡頭轉動
                if (focusStateRef?.current) {
                    mesh.updateWorldMatrix(true, false);
                    scene.updateWorldMatrix(true, true);

                    _focusMeshBox.setFromObject(mesh);
                    _focusMeshBox.getCenter(_focusMeshCenter);

                    _focusSceneBox.setFromObject(scene);
                    _focusSceneBox.getCenter(_focusSceneCenter);
                    _focusSceneBox.getSize(_focusSceneSize);

                    const shoeMaxDim = Math.max(_focusSceneSize.x, _focusSceneSize.y, _focusSceneSize.z, 0.1);
                    const isMobileViewport = size.width < 768;
                    const isTabletViewport = size.width >= 768 && size.width < 1024;
                    const distanceScale = isMobileViewport ? 0.60 : (isTabletViewport ? 1.05 : 1.0);

                    const relHitX = e.point
                        ? (e.point.x - _focusSceneCenter.x)
                        : (_focusMeshCenter.x - _focusSceneCenter.x);

                    let hasWorldNormal = false;
                    if (e.face?.normal) {
                        _focusNormalMatrix.getNormalMatrix(mesh.matrixWorld);
                        _focusWorldNormal.copy(e.face.normal).applyMatrix3(_focusNormalMatrix).normalize();
                        hasWorldNormal = true;
                    }

                    const sideThreshold = shoeMaxDim * 0.05;
                    let clickSide = 1;
                    if (Math.abs(relHitX) > sideThreshold) {
                        clickSide = relHitX >= 0 ? 1 : -1;
                    } else if (hasWorldNormal && Math.abs(_focusWorldNormal.x) > 0.25) {
                        clickSide = _focusWorldNormal.x >= 0 ? 1 : -1;
                    } else {
                        const camRefX = controls?.target?.x ?? _focusSceneCenter.x;
                        clickSide = (camera.position.x - camRefX) >= -0.01 ? 1 : -1;
                    }

                    const preset = getPartFocusPreset(normalizedPartName, modelId);
                    let goalTheta = 0;
                    let goalPhi = Math.PI / 2;
                    let goalRadius = 0.72 * distanceScale;
                    const isExactCenter = Boolean(preset?.exactCenter);

                    if (preset) {
                        const signedAzimuthDeg = preset.sideMode === 'fixed'
                            ? preset.azimuthDeg
                            : Math.abs(preset.azimuthDeg) * clickSide;
                        goalTheta = THREE.MathUtils.degToRad(signedAzimuthDeg);
                        goalPhi = THREE.MathUtils.clamp(THREE.MathUtils.degToRad(preset.polarDeg), 0.2, Math.PI * 0.85);
                        goalRadius = THREE.MathUtils.clamp(preset.distance * distanceScale, 0.18, 1.8);

                        const targetWeight = preset.targetWeight ?? 0.6;
                        if (isExactCenter && e.point) {
                            // 結合網格中心與實際點擊可見表面座標，確保標籤與標誌精準置中於畫面中央
                            _focusFallbackDir.copy(_focusMeshCenter).lerp(e.point, 0.45);
                            _focusGoalTarget.copy(_focusSceneCenter).lerp(_focusFallbackDir, targetWeight);
                        } else {
                            _focusGoalTarget.copy(_focusSceneCenter).lerp(_focusMeshCenter, targetWeight);
                        }
                    } else {
                        _focusFallbackDir.copy(_focusMeshCenter).sub(_focusSceneCenter);
                        if (hasWorldNormal) {
                            _focusFallbackDir.addScaledVector(_focusWorldNormal, shoeMaxDim * 0.6);
                        }
                        if (_focusFallbackDir.lengthSq() < 1e-6) {
                            _focusFallbackDir.set(clickSide, 0.35, 0.35);
                        }
                        _focusFallbackDir.normalize();
                        _focusSpherical.setFromVector3(_focusFallbackDir);
                        goalTheta = _focusSpherical.theta;
                        goalPhi = THREE.MathUtils.clamp(_focusSpherical.phi, 0.28, Math.PI * 0.82);
                        goalRadius = THREE.MathUtils.clamp(0.68 * distanceScale, 0.18, 1.8);
                        _focusGoalTarget.copy(_focusSceneCenter).lerp(_focusMeshCenter, 0.65);
                    }

                    // 限制注視點不偏離鞋體範圍，維持手動旋轉中心穩定
                    _focusFallbackDir.copy(_focusGoalTarget).sub(_focusSceneCenter);
                    const maxTargetOffset = shoeMaxDim * (isExactCenter ? 0.85 : 0.52);
                    if (_focusFallbackDir.length() > maxTargetOffset) {
                        _focusFallbackDir.setLength(maxTargetOffset);
                        _focusGoalTarget.copy(_focusSceneCenter).add(_focusFallbackDir);
                    }

                    // 依桌機右側面板與手機底部面板空間微調構圖；exactCenter 特寫則嚴格置中於畫面中央
                    if (isMobileViewport) {
                        _focusGoalTarget.y -= shoeMaxDim * (isExactCenter ? 0.03 : 0.08);
                    } else if (!isExactCenter) {
                        const rightShift = shoeMaxDim * 0.04;
                        _focusGoalTarget.x += Math.cos(goalTheta) * rightShift;
                        _focusGoalTarget.z -= Math.sin(goalTheta) * rightShift;
                    }

                    focusStateRef.current.active = true;
                    focusStateRef.current.target.copy(_focusGoalTarget);
                    focusStateRef.current.theta = goalTheta;
                    focusStateRef.current.phi = goalPhi;
                    focusStateRef.current.radius = goalRadius;
                    focusStateRef.current.triggerId += 1;
                }

                onPartSelect({ name: normalizedPartName, materialName: mat.name, id: mesh.uuid });
            }}
          />;
};

const InnerScene = React.memo(({ visible = true, url, modelId, modelScale, modelRotation, modelPosition, selectedPart, onPartSelect, textureMap, controls, isPickingColor, onColorPicked, isOrbitDraggingRef, focusStateRef }: ModelProps & { visible?: boolean }) => {
    const [modelBottom, setModelBottom] = useState(-0.1);
    const { gl } = useThree();

    useEffect(() => {
        if (!visible) return;
        gl.shadowMap.needsUpdate = true;
        const rafId = requestAnimationFrame(() => {
            gl.shadowMap.needsUpdate = true;
        });
        return () => cancelAnimationFrame(rafId);
    }, [gl, visible, modelBottom, url, modelScale, modelRotation]);

    return (
        <group position={modelPosition} visible={visible}>
            <Center onCentered={({ height }) => setModelBottom(-height / 2)}>
                <group name="shoe-bounds-root">
                    <Model 
                        interactive={visible}
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
                        isOrbitDraggingRef={isOrbitDraggingRef}
                        focusStateRef={focusStateRef}
                    />
                </group>
            </Center>
            {/* 第一層：外圈柔和擴散環境陰影（過渡自然、不生硬） */}
            <ContactShadows
                key={`${url}_${modelScale}_${modelBottom.toFixed(4)}_outer`}
                position={[0, modelBottom - 0.0018, 0]}
                opacity={0.26}
                scale={1.85}
                blur={2.8}
                far={0.65}
                resolution={512}
                frames={1}
                color="#1f2937"
            />
            {/* 第二層：鞋底貼地柔焦接觸暗部（保留接地層次感） */}
            <ContactShadows
                key={`${url}_${modelScale}_${modelBottom.toFixed(4)}_inner`}
                position={[0, modelBottom - 0.0008, 0]}
                opacity={0.42}
                scale={1.18}
                blur={1.9}
                far={0.22}
                resolution={512}
                frames={1}
                color="#111827"
            />
            {/* 第三層：極柔和的主燈方向性地面投射影 */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, modelBottom - 0.0022, 0]} receiveShadow>
                <planeGeometry args={[2.6, 2.6]} />
                <shadowMaterial transparent opacity={0.07} color="#000000" />
            </mesh>
        </group>
    );
});

class EnvErrorBoundary extends React.Component<{ fallback: ReactNode; children?: ReactNode }, { hasError: boolean }> {
  constructor(props: { fallback: ReactNode; children?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

const MonochromeEnvSphere: React.FC<{ files: string }> = ({ files }) => {
  const texture = useEnvironment({ files });
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uMap: { value: texture },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        varying vec2 vUv;
        void main() {
          vec3 rgb = texture2D(uMap, vUv).rgb;
          // 強制轉為 100% 無色偏中性灰階亮度，徹底排除冷暖色溫干擾鞋面材質原色
          float lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
          gl_FragColor = vec4(vec3(lum), 1.0);
        }
      `,
    });
  }, [texture]);

  useEffect(() => {
    return () => {
      material.dispose();
    };
  }, [material]);

  return (
    <mesh material={material}>
      <sphereGeometry args={[10, 64, 32]} />
    </mesh>
  );
};

const StudioEnvironment: React.FC<{ envFiles?: string; envPreset: string; envIntensity: number; envRotation: number }> = ({
  envFiles,
  envPreset,
  envIntensity,
  envRotation,
}) => {
  const deferredFiles = useDeferredValue(envFiles);
  const rotation: [number, number, number] = [0, (envRotation * Math.PI) / 180, 0];

  return (
    <EnvErrorBoundary
      fallback={
        <Environment frames={1} resolution={256} environmentIntensity={envIntensity} environmentRotation={rotation}>
          <color attach="background" args={['#202020']} />
          <mesh position={[0, 5, 3]} rotation={[Math.PI / 3, 0, 0]}>
            <planeGeometry args={[10, 5]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        </Environment>
      }
    >
      <Suspense fallback={null}>
        {deferredFiles ? (
          <Environment
            key={deferredFiles}
            frames={1}
            resolution={256}
            environmentIntensity={envIntensity}
            environmentRotation={rotation}
          >
            <MonochromeEnvSphere files={deferredFiles} />
          </Environment>
        ) : (
          <Environment preset={envPreset as any} environmentIntensity={envIntensity} environmentRotation={rotation} />
        )}
      </Suspense>
    </EnvErrorBoundary>
  );
};

const ContrastSharpnessShader = {
  uniforms: {
    tDiffuse: { value: null },
    uContrast: { value: 1.0 },
    uSharpness: { value: 0.0 },
    uTexelSize: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uContrast;
    uniform float uSharpness;
    uniform vec2 uTexelSize;
    varying vec2 vUv;

    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (c.a <= 0.001) {
        gl_FragColor = vec4(0.0);
        return;
      }

      vec3 straight = clamp(c.rgb / c.a, 0.0, 1.0);

      // 3x3 Unsharp Mask（僅對實心模型內部銳化，避免輪廓外緣白邊與破壞地面柔影）
      vec4 t = texture2D(tDiffuse, vUv + vec2(0.0, uTexelSize.y));
      vec4 b = texture2D(tDiffuse, vUv - vec2(0.0, uTexelSize.y));
      vec4 l = texture2D(tDiffuse, vUv - vec2(uTexelSize.x, 0.0));
      vec4 r = texture2D(tDiffuse, vUv + vec2(uTexelSize.x, 0.0));

      vec3 tS = t.a > 0.85 ? clamp(t.rgb / t.a, 0.0, 1.0) : straight;
      vec3 bS = b.a > 0.85 ? clamp(b.rgb / b.a, 0.0, 1.0) : straight;
      vec3 lS = l.a > 0.85 ? clamp(l.rgb / l.a, 0.0, 1.0) : straight;
      vec3 rS = r.a > 0.85 ? clamp(r.rgb / r.a, 0.0, 1.0) : straight;

      vec3 avg = 0.25 * (tS + bS + lS + rS);
      float shoeMask = smoothstep(0.85, 0.99, c.a);
      vec3 sharpened = clamp(straight + (straight - avg) * (uSharpness * 1.4 * shoeMask), 0.0, 1.0);

      // 中性灰階基準對比度調整（不改變色相與冷暖色溫，且保留柔和地面陰影漸層）
      vec3 contrasted = clamp((sharpened - 0.5) * uContrast + 0.5, 0.0, 1.0);
      vec3 finalRgb = mix(sharpened, contrasted, shoeMask);

      gl_FragColor = vec4(finalRgb * c.a, c.a);
    }
  `,
};

const BackdropCompositeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uBgColor: { value: new THREE.Vector3(1.0, 1.0, 1.0) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec3 uBgColor;
    varying vec2 vUv;

    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 composited = clamp(c.rgb + uBgColor * (1.0 - c.a), 0.0, 1.0);
      gl_FragColor = vec4(composited, 1.0);
    }
  `,
};

const WireframeOutputShader = {
  uniforms: {
    tDiffuse: { value: null },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;

    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      if (c.a <= 0.001) {
        gl_FragColor = vec4(0.0);
        return;
      }

      // 先於線性空間解除預乘 Alpha，再進行色調映射與 sRGB 轉換，避免半透明線框被錯誤提亮白化
      vec3 straightLinear = c.rgb / c.a;
      gl_FragColor = vec4(straightLinear, c.a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      gl_FragColor.rgb *= gl_FragColor.a;
    }
  `,
};

const ContrastSharpnessComposer: React.FC<{ contrast: number; sharpness: number; isWireframeLoading: boolean }> = ({ contrast, sharpness, isWireframeLoading }) => {
  const { gl, scene, camera, size, viewport } = useThree();

  const { composer, outputPass, fxPass, wireframePass, renderTarget } = useMemo(() => {
    let isSoftwareGl = false;
    try {
      const ctx = gl.getContext();
      const ext = ctx.getExtension('WEBGL_debug_renderer_info');
      const gpu = String(ctx.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : ctx.RENDERER));
      isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    } catch {
      isSoftwareGl = false;
    }

    const dpr = gl.getPixelRatio() || 1;
    const rt = new THREE.WebGLRenderTarget(
      Math.max(1, Math.floor(size.width * dpr)),
      Math.max(1, Math.floor(size.height * dpr)),
      {
        type: THREE.HalfFloatType,
        samples: gl.capabilities.isWebGL2 && !isSoftwareGl ? 4 : 0,
      }
    );

    const comp = new EffectComposer(gl, rt);
    const renderPass = new RenderPass(scene, camera);
    renderPass.clear = true;
    renderPass.clearColor = new THREE.Color(0x000000);
    renderPass.clearAlpha = 0;

    const outPass = new OutputPass();
    const shaderPass = new ShaderPass(ContrastSharpnessShader);
    const wirePass = new ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(WireframeOutputShader.uniforms),
        vertexShader: WireframeOutputShader.vertexShader,
        fragmentShader: WireframeOutputShader.fragmentShader,
        toneMapped: true,
      })
    );

    comp.addPass(renderPass);
    comp.addPass(outPass);
    comp.addPass(shaderPass);
    comp.addPass(wirePass);

    return { composer: comp, outputPass: outPass, fxPass: shaderPass, wireframePass: wirePass, renderTarget: rt };
  }, [gl, scene, camera]);

  useEffect(() => {
    outputPass.enabled = !isWireframeLoading;
    fxPass.enabled = !isWireframeLoading;
    wireframePass.enabled = isWireframeLoading;
  }, [outputPass, fxPass, wireframePass, isWireframeLoading]);

  useEffect(() => {
    const dpr = viewport.dpr || gl.getPixelRatio() || 1;
    composer.setPixelRatio(dpr);
    composer.setSize(size.width, size.height);
    fxPass.uniforms.uTexelSize.value.set(
      1 / Math.max(1, size.width * dpr),
      1 / Math.max(1, size.height * dpr)
    );
  }, [composer, fxPass, gl, size.width, size.height, viewport.dpr]);

  useEffect(() => {
    fxPass.uniforms.uContrast.value = contrast;
    fxPass.uniforms.uSharpness.value = sharpness;
  }, [fxPass, contrast, sharpness]);

  useEffect(() => {
    return () => {
      composer.dispose();
      renderTarget.dispose();
    };
  }, [composer, renderTarget]);

  useFrame(() => {
    composer.render();
  }, 1);

  return null;
};

interface ModelViewerProps {
  url: string;
  wireframeUrl?: string | null;
  modelId?: string;
  modelScale: number;
  modelRotation: [number, number, number];
  modelPosition: [number, number, number];
  selectedPart: SelectedPart | null;
  onPartSelect: (part: SelectedPart | null) => void;
  textureMap: Record<string, TextureConfig | null>;
  activeTexture?: TextureItem | null; 
  envFiles?: string;
  envPreset: string;
  envIntensity: number;
  envRotation: number;
  contrast?: number;
  sharpness?: number;
  dirLightRotation: number;
  shadowBlur: number;
  shadowNormalBias: number;
  autoRotate: boolean;
  isPickingColor?: boolean;
  onColorPicked?: (hex: string) => void;
  onModelReady?: () => void;
  onRotateStart?: () => void;
  needsDemoRotation?: boolean;
  onUserRotated?: () => void;
}

const DemoRotationController = ({ controlsRef, needsDemoRotation, transitionState, onUserRotated, modelId, focusStateRef }: any) => {
    const demoState = useRef({ active: false, time: 0, startAngle: 0, completed: false });
    const interactionStartAngle = useRef<number | null>(null);

    const listenersAttached = useRef(false);
    const handleStartRef = useRef<any>(null);
    const handleChangeRef = useRef<any>(null);
    const handleEndRef = useRef<any>(null);

    useEffect(() => {
        demoState.current.completed = false;
        demoState.current.active = false;
        listenersAttached.current = false;
    }, [modelId]);

    useEffect(() => {
        if (transitionState === 'complete' && needsDemoRotation && !demoState.current.completed) {
            demoState.current = { active: true, time: 0, startAngle: controlsRef.current?.getAzimuthalAngle() || 0, completed: true };
        }
    }, [transitionState, needsDemoRotation, controlsRef, modelId]);

    useEffect(() => {
        return () => {
            if (controlsRef.current && listenersAttached.current) {
                controlsRef.current.removeEventListener('start', handleStartRef.current);
                controlsRef.current.removeEventListener('change', handleChangeRef.current);
                controlsRef.current.removeEventListener('end', handleEndRef.current);
            }
        };
    }, [controlsRef]);

    useFrame((state, delta) => {
        const controls = controlsRef.current;
        
        if (controls && !listenersAttached.current) {
            // 清除可能殘留的舊監聽器
            if (handleStartRef.current) controls.removeEventListener('start', handleStartRef.current);
            if (handleChangeRef.current) controls.removeEventListener('change', handleChangeRef.current);
            if (handleEndRef.current) controls.removeEventListener('end', handleEndRef.current);

            listenersAttached.current = true;
            
            handleStartRef.current = () => {
                demoState.current.active = false; 
                interactionStartAngle.current = controls.getAzimuthalAngle();
            };
            
            handleChangeRef.current = () => {
                if (interactionStartAngle.current !== null && onUserRotated) {
                    const currentAngle = controls.getAzimuthalAngle();
                    if (Math.abs(currentAngle - interactionStartAngle.current) > 0.05) { // ~2.8 degrees
                        onUserRotated();
                        interactionStartAngle.current = null;
                    }
                }
            };
            
            handleEndRef.current = () => {
                interactionStartAngle.current = null;
            };

            controls.addEventListener('start', handleStartRef.current);
            controls.addEventListener('change', handleChangeRef.current);
            controls.addEventListener('end', handleEndRef.current);
        }

        if (focusStateRef?.current?.active) {
            demoState.current.active = false;
            return;
        }

        if (demoState.current.active && controls) {
            demoState.current.time += delta;
            const t = demoState.current.time;
            if (t < 2.5) {
                const angleOffset = Math.sin(t * Math.PI / 1.25) * 0.17; // ~10 degrees
                controls.setAzimuthalAngle(demoState.current.startAngle + angleOffset);
                controls.update();
            } else {
                demoState.current.active = false;
            }
        }
    });

    return null;
}

const CameraFocusController: React.FC<{
    controlsRef: React.RefObject<any>;
    focusStateRef: React.MutableRefObject<CameraFocusState>;
    modelId?: string;
}> = ({ controlsRef, focusStateRef, modelId }) => {
    const { camera } = useThree();
    const attachedControlsRef = useRef<any>(null);
    const cancelHandlerRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        focusStateRef.current.active = false;
    }, [modelId, focusStateRef]);

    useEffect(() => {
        cancelHandlerRef.current = () => {
            focusStateRef.current.active = false;
        };
        return () => {
            if (attachedControlsRef.current && cancelHandlerRef.current) {
                attachedControlsRef.current.removeEventListener('start', cancelHandlerRef.current);
            }
            attachedControlsRef.current = null;
        };
    }, [focusStateRef]);

    useFrame((_, delta) => {
        const controls = controlsRef.current;
        if (!controls) return;

        if (attachedControlsRef.current !== controls) {
            if (attachedControlsRef.current && cancelHandlerRef.current) {
                attachedControlsRef.current.removeEventListener('start', cancelHandlerRef.current);
            }
            if (cancelHandlerRef.current) {
                controls.addEventListener('start', cancelHandlerRef.current);
            }
            attachedControlsRef.current = controls;
        }

        const goal = focusStateRef.current;
        if (!goal.active) return;

        _focusOffset.copy(camera.position).sub(controls.target);
        if (_focusOffset.lengthSq() < 1e-8) {
            _focusOffset.set(0.85, 0, 0);
        }
        _focusSpherical.setFromVector3(_focusOffset);

        const deltaTheta = Math.atan2(
            Math.sin(goal.theta - _focusSpherical.theta),
            Math.cos(goal.theta - _focusSpherical.theta)
        );
        const deltaPhi = goal.phi - _focusSpherical.phi;
        const deltaRadius = goal.radius - _focusSpherical.radius;
        const targetDistSq = controls.target.distanceToSquared(goal.target);

        const prevDamping = controls.enableDamping;

        if (
            Math.abs(deltaTheta) < 0.0025 &&
            Math.abs(deltaPhi) < 0.0025 &&
            Math.abs(deltaRadius) < 0.002 &&
            targetDistSq < 0.000004
        ) {
            controls.target.copy(goal.target);
            _focusSpherical.set(goal.radius, goal.phi, goal.theta);
            _focusOffset.setFromSpherical(_focusSpherical);
            camera.position.copy(controls.target).add(_focusOffset);
            controls.enableDamping = false;
            controls.update();
            controls.enableDamping = prevDamping;
            goal.active = false;
            return;
        }

        const step = 1 - Math.exp(-6.5 * Math.min(delta, 0.05));
        controls.target.lerp(goal.target, step);

        const nextTheta = _focusSpherical.theta + deltaTheta * step;
        const nextPhi = THREE.MathUtils.lerp(_focusSpherical.phi, goal.phi, step);
        const nextRadius = THREE.MathUtils.lerp(_focusSpherical.radius, goal.radius, step);

        _focusSpherical.set(nextRadius, nextPhi, nextTheta);
        _focusOffset.setFromSpherical(_focusSpherical);
        camera.position.copy(controls.target).add(_focusOffset);

        controls.enableDamping = false;
        controls.update();
        controls.enableDamping = prevDamping;
    });

    return null;
};

const CameraResetter = ({ modelId, controlsRef, focusStateRef }: { modelId?: string, controlsRef: any, focusStateRef?: React.MutableRefObject<CameraFocusState> }) => {
    const { camera } = useThree();
    
    useEffect(() => {
        if (focusStateRef?.current) {
            focusStateRef.current.active = false;
        }
        camera.position.set(...DEFAULT_VIEW.pos);
        camera.lookAt(...DEFAULT_VIEW.target);
        camera.updateProjectionMatrix();
        
        if (controlsRef.current) {
            controlsRef.current.target.set(...DEFAULT_VIEW.target);
            controlsRef.current.update();
        }
    }, [modelId, camera, controlsRef, focusStateRef]);
    
    return null;
};

// 監聽 WebGL Context Lost，及時釋放非釘選貼圖保護 GPU
const WebGLContextWatcher: React.FC = () => {
    const { gl } = useThree();
    useEffect(() => {
        const handleContextLost = (e: Event) => {
            e.preventDefault();
            console.warn('[ModelViewer] WebGL Context Lost detected. Releasing unpinned textures and cooling down GPU.');
            textureCacheManager.onModelSwitch();
        };
        const handleContextRestored = () => {
            console.info('[ModelViewer] WebGL Context Restored.');
        };
        const canvas = gl.domElement;
        canvas.addEventListener('webglcontextlost', handleContextLost, false);
        canvas.addEventListener('webglcontextrestored', handleContextRestored, false);
        return () => {
            canvas.removeEventListener('webglcontextlost', handleContextLost);
            canvas.removeEventListener('webglcontextrestored', handleContextRestored);
        };
    }, [gl]);
    return null;
};

// 靜態光源與模型情境下烘焙 VSM 陰影貼圖，避免每次旋轉鏡頭重算陰影
const ShadowBakeController: React.FC<{ depsKey: string }> = ({ depsKey }) => {
    const { gl } = useThree();

    useEffect(() => {
        gl.shadowMap.autoUpdate = false;
        return () => {
            gl.shadowMap.autoUpdate = true;
        };
    }, [gl]);

    useEffect(() => {
        gl.shadowMap.autoUpdate = false;
        gl.shadowMap.needsUpdate = true;
        const rafId = requestAnimationFrame(() => {
            gl.shadowMap.needsUpdate = true;
        });
        return () => cancelAnimationFrame(rafId);
    }, [gl, depsKey]);

    return null;
};

// 拖曳旋轉鏡頭時暫停對大型網格的逐幀 R3F 射線檢測，放開後立即恢復點擊選取
const OrbitDragOptimizer: React.FC<{
    controlsRef: React.RefObject<any>;
    isOrbitDraggingRef: React.MutableRefObject<boolean>;
    enabled: boolean;
}> = ({ controlsRef, isOrbitDraggingRef, enabled }) => {
    const { gl, setEvents } = useThree();

    useEffect(() => {
        if (!enabled) {
            isOrbitDraggingRef.current = false;
            setEvents({ enabled: true });
            return;
        }

        const domElement = gl.domElement;
        let isPointerDown = false;
        let downX = 0;
        let downY = 0;
        let restoreTimer: ReturnType<typeof setTimeout> | null = null;

        const disableHoverRaycast = () => {
            if (!isOrbitDraggingRef.current) {
                isOrbitDraggingRef.current = true;
                setEvents({ enabled: false });
                if (document.body.style.cursor !== 'auto') {
                    document.body.style.cursor = 'auto';
                }
            }
        };

        const restoreHoverRaycast = () => {
            isPointerDown = false;
            if (restoreTimer) clearTimeout(restoreTimer);
            restoreTimer = setTimeout(() => {
                isOrbitDraggingRef.current = false;
                setEvents({ enabled: true });
            }, 0);
        };

        const onPointerDown = (e: PointerEvent) => {
            if (restoreTimer) {
                clearTimeout(restoreTimer);
                restoreTimer = null;
            }
            isPointerDown = true;
            isOrbitDraggingRef.current = false;
            downX = e.clientX;
            downY = e.clientY;
        };

        const onPointerMove = (e: PointerEvent) => {
            if (!isPointerDown || isOrbitDraggingRef.current) return;
            const dx = e.clientX - downX;
            const dy = e.clientY - downY;
            if (dx * dx + dy * dy > 36) {
                disableHoverRaycast();
            }
        };

        const controls = controlsRef.current;
        domElement.addEventListener('pointerdown', onPointerDown, { passive: true });
        window.addEventListener('pointermove', onPointerMove, { passive: true });
        window.addEventListener('pointerup', restoreHoverRaycast, { passive: true });
        window.addEventListener('pointercancel', restoreHoverRaycast, { passive: true });
        controls?.addEventListener?.('end', restoreHoverRaycast);

        return () => {
            if (restoreTimer) clearTimeout(restoreTimer);
            domElement.removeEventListener('pointerdown', onPointerDown);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', restoreHoverRaycast);
            window.removeEventListener('pointercancel', restoreHoverRaycast);
            controls?.removeEventListener?.('end', restoreHoverRaycast);
            isOrbitDraggingRef.current = false;
            setEvents({ enabled: true });
        };
    }, [gl, setEvents, controlsRef, isOrbitDraggingRef, enabled]);

    return null;
};

const ModelViewer = React.forwardRef<any, ModelViewerProps>(({ 
    url, wireframeUrl, modelId, modelScale, modelRotation, modelPosition, selectedPart, onPartSelect, textureMap, activeTexture, envFiles, envPreset, envIntensity, envRotation, contrast = 1.08, sharpness = 0.35, dirLightRotation, shadowBlur, shadowNormalBias, autoRotate, isPickingColor, onColorPicked, onModelReady, needsDemoRotation, onUserRotated
}, ref) => {
  const controlsRef = useRef<any>(null);
  const screenshotHandlerRef = useRef<any>(null);
  const isOrbitDraggingRef = useRef<boolean>(false);
  const canvasPointerDownRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const focusStateRef = useRef<CameraFocusState>({
    active: false,
    target: new THREE.Vector3(0, 0, 0),
    theta: Math.PI / 2,
    phi: Math.PI / 2,
    radius: 0.85,
    triggerId: 0
  });
  const [transitionState, setTransitionState] = useState<'loading' | 'complete'>('loading');
  const [prevModelId, setPrevModelId] = useState(modelId);

  if (modelId !== prevModelId) {
      setPrevModelId(modelId);
      // 模型切換時保留各鞋型已套用貼圖，僅釋放未被引用的預載快取
      const keepUrls = new Set<string>();
      Object.values(textureMap).forEach((cfg) => {
          if (cfg?.url) keepUrls.add(cfg.url);
          if (cfg?.normalUrl) keepUrls.add(cfg.normalUrl);
      });
      textureCacheManager.onModelSwitch(keepUrls);
      if (modelId && animatedModels.has(modelId)) {
          setTransitionState('complete');
      } else if (!wireframeUrl) {
          setTransitionState('complete');
      } else {
          setTransitionState('loading');
      }
  }

  useEffect(() => {
      if (transitionState === 'complete' && onModelReady) {
          onModelReady();
      }
  }, [transitionState, onModelReady, modelId]);

  React.useImperativeHandle(ref, () => ({
      captureComposition: (options?: { backdropHex?: string }) =>
        screenshotHandlerRef.current?.captureComposition(options) || Promise.resolve({ sheetUrl: '', heroUrl: '', partAreas: {} })
  }));

  const rad = (dirLightRotation * Math.PI) / 180;
  const dirLightX = Math.cos(rad) * 4.5;
  const dirLightZ = Math.sin(rad) * 4.5;

  return (
    <div
      className="w-full h-full bg-[#f8f9fa] relative"
      onPointerDown={(e) => {
        canvasPointerDownRef.current = { x: e.clientX, y: e.clientY };
      }}
    >
      <Canvas shadows={{ type: THREE.VSMShadowMap }} dpr={[1, 1.5]}
          gl={{ 
            preserveDrawingBuffer: true, 
            antialias: false,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping, 
            toneMappingExposure: 1.0
          }}
          onPointerMissed={(e) => {
            if (e.type !== 'click' || isPickingColor) return;
            const dist = Math.hypot(
              e.clientX - canvasPointerDownRef.current.x,
              e.clientY - canvasPointerDownRef.current.y
            );
            if (dist > 8) return;
            onPartSelect(null);
            if (transitionState === 'complete') {
              focusStateRef.current.active = true;
              focusStateRef.current.target.set(...DEFAULT_VIEW.target);
              focusStateRef.current.theta = Math.PI / 2;
              focusStateRef.current.phi = Math.PI / 2;
              focusStateRef.current.radius = 0.85;
              focusStateRef.current.triggerId += 1;
            }
          }}
      >
        <AdaptiveEvents />
        <WebGLContextWatcher />
        <ShadowBakeController
          depsKey={`${url}|${modelId}|${transitionState}|${modelScale}|${modelRotation.join(',')}|${modelPosition.join(',')}|${dirLightRotation}|${shadowBlur}|${shadowNormalBias}`}
        />
        <OrbitDragOptimizer
          controlsRef={controlsRef}
          isOrbitDraggingRef={isOrbitDraggingRef}
          enabled={!isPickingColor}
        />
        <PerspectiveCamera makeDefault position={DEFAULT_VIEW.pos} fov={DEFAULT_VIEW.fov} near={0.01} />
        <CameraResetter modelId={modelId} controlsRef={controlsRef} focusStateRef={focusStateRef} />
        <CameraFocusController controlsRef={controlsRef} focusStateRef={focusStateRef} modelId={modelId} />
        <DemoRotationController 
            key={modelId}
            controlsRef={controlsRef} 
            needsDemoRotation={needsDemoRotation} 
            transitionState={transitionState} 
            onUserRotated={onUserRotated} 
            modelId={modelId}
            focusStateRef={focusStateRef}
        />
        <OrbitControls 
            ref={controlsRef}
            makeDefault 
            minPolarAngle={0} 
            maxPolarAngle={Math.PI * 0.88}
            minDistance={0.14}
            maxDistance={2.5}
            enableDamping={true}
            dampingFactor={0.11}
            autoRotate={autoRotate}
            autoRotateSpeed={3.0}
            enabled={!isPickingColor}
        />
        <ScreenshotHandler ref={screenshotHandlerRef} contrast={contrast} sharpness={sharpness} modelId={modelId} />
        {wireframeUrl && transitionState === 'loading' && (
            <EnvErrorBoundary fallback={<WireframeFallback onComplete={() => setTransitionState('complete')} />}>
                <LoadingWireframeOverlay 
                    url={wireframeUrl} 
                    colorModelUrl={url}
                    scale={modelScale} 
                    rotation={modelRotation} 
                    position={modelPosition} 
                    modelId={modelId || ''}
                    onComplete={() => setTransitionState('complete')}
                />
            </EnvErrorBoundary>
        )}
        <Suspense fallback={null}>
            {/* Fixed key error by ensuring ErrorBoundary is recognized as a standard React component */}
            <ErrorBoundary key={url} modelUrl={url}>
                <InnerScene 
                    visible={!wireframeUrl || transitionState === 'complete'}
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
                    isOrbitDraggingRef={isOrbitDraggingRef}
                    focusStateRef={focusStateRef}
                />
                <StudioEnvironment
                  envFiles={envFiles}
                  envPreset={envPreset}
                  envIntensity={envIntensity}
                  envRotation={envRotation}
                />
                {/* 純白無色偏中性光源：避免冷暖色溫干擾材質原色，同時保留柔和漸層陰影 */}
                <AmbientLight intensity={0.14} color="#ffffff" />
                <HemisphereLight args={['#ffffff', '#d8d8d8', 0.28]} />
                {/* 主光源：VSM 高斯柔化自陰影，徹底消除鞋帶與斜紋面上的鋸齒階梯 */}
                <DirectionalLight 
                    position={[dirLightX, 6.5, dirLightZ]} 
                    intensity={0.95}
                    color="#ffffff"
                    castShadow 
                    shadow-mapSize={[2048, 2048]}
                    shadow-camera-near={1}
                    shadow-camera-far={16}
                    shadow-camera-left={-0.9}
                    shadow-camera-right={0.9}
                    shadow-camera-top={0.9}
                    shadow-camera-bottom={-0.9}
                    shadow-bias={-0.0002} 
                    shadow-normalBias={shadowNormalBias}
                    shadow-radius={shadowBlur}
                    shadow-blurSamples={16}
                />
                {/* 側逆輪廓光：純白中性邊緣補光，區隔模型與背景並柔和暗部 */}
                <DirectionalLight
                    position={[-dirLightX * 0.9, 3.2, -dirLightZ * 0.9]}
                    intensity={0.55}
                    color="#ffffff"
                />
            </ErrorBoundary>
        </Suspense>
        <ContrastSharpnessComposer
          contrast={contrast}
          sharpness={sharpness}
          isWireframeLoading={Boolean(wireframeUrl && transitionState === 'loading')}
        />
      </Canvas>
      <CustomLoader hasWireframe={!!wireframeUrl} />
      {selectedPart && (
        <div className={`
            absolute left-1/2 -translate-x-1/2 z-10 
            transition-all duration-500 ease-out animate-in fade-in slide-in-from-top-4
            flex flex-col items-center gap-4 w-full px-8 max-w-xl text-center
            top-[85px] lg:top-32
        `}>
          <div className="flex items-center gap-3 px-6 py-2.5 rounded-full bg-white/95 border border-gray-200/80 shadow-[0_10px_40px_rgba(0,0,0,0.05)] whitespace-nowrap">
            <span className="w-2.5 h-2.5 shrink-0 rounded-full bg-indigo-500 animate-pulse"></span>
            <span className="text-[10px] lg:text-[11px] font-black tracking-[0.2em] uppercase text-gray-900 leading-none">
              EDITING <span className="text-indigo-600 ml-1">{selectedPart.name.toUpperCase() === 'OBJECT019' ? 'INSOLE' : selectedPart.name.toUpperCase() === 'OBJECT011' ? 'AGLET' : selectedPart.name}</span>
            </span>
          </div>

          {activeTexture && (
            <div className="flex flex-col items-center gap-1.5 animate-in fade-in zoom-in-95 duration-700 delay-150 w-full md:hidden">
                <h2 className="text-[15px] lg:text-[18px] font-black tracking-tighter text-gray-900 uppercase">
                    {activeTexture.title || activeTexture.name}
                </h2>
                <div className="text-center text-[11px] lg:text-[13px] text-gray-500 font-medium w-full max-w-xs px-2">
                    <span className="whitespace-normal break-words leading-relaxed">
                        {activeTexture.description}
                    </span>
                    <a
                       href={activeTexture.link || "https://www.paiho.com/tw/material-hub/b873383c1623dcffafd786ce755b2786"}
                       target="_blank"
                       rel="noopener noreferrer"
                       className="ml-1 inline-flex items-center align-middle text-indigo-600 hover:text-indigo-800 transition-colors pointer-events-auto"
                      title="Read more"
                    >
                        <ArrowUpRight size={14} strokeWidth={3} />
                    </a>
                </div>
            </div>
          )}


        </div>
      )}
    </div>
  );
});

export default ModelViewer;