import { TextureItem } from './types';

export const UNIFORM_LINK = "https://www.paiho.com/tw/material-hub/b873383c1623dcffafd786ce755b2786";

export const DEFAULT_HDRI_URL = "https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_kontrast_03_1k.hdr";

export const MODELS = [
  { 
    id: 'traveler', 
    name: 'Traveler-shoe', 
    url: 'https://huggingface.co/yayapewn/huggingface/resolve/main/Traveler-shoe.glb',
    wireframeUrl: 'https://huggingface.co/yayapewn/huggingface/resolve/main/Traveler-shoe-wire_compressed.glb',
    scale: 1.53, 
    rotation: [-0.3, Math.PI * 2.5, 0] as [number, number, number], 
    position: [0, 0.03, 0] as [number, number, number], 
    initialEnvIntensity: 0.50,
    initialEnvRotation: 202,
    contrast: 1.14,
    sharpness: 0.50,
    shareFillRatio: 0.78,
    shareSlotHeight: 820
  },
  { 
    id: 'lace', 
    name: 'Lace-shoe', 
    url: 'https://huggingface.co/yayapewn/huggingface/resolve/main/lace-shoe.glb',
    wireframeUrl: 'https://huggingface.co/yayapewn/huggingface/resolve/main/lace-shoe-wire_compressed.glb',
    scale: 2,
    rotation: [0, Math.PI, 0] as [number, number, number],
    position: [0, 0, 0] as [number, number, number],
    initialEnvIntensity: 1.05,
    initialEnvRotation: 280,
    contrast: 1.16,
    sharpness: 0.30,
    shareFillRatio: 0.68,
    shareSlotHeight: 720
  },
  { 
    id: 'dna', 
    name: 'DNA-shoe', 
    url: 'https://huggingface.co/yayapewn/huggingface/resolve/main/DNA_shoe.glb?v=20261116_01',
    wireframeUrl: 'https://huggingface.co/yayapewn/huggingface/resolve/main/DNA_shoe-wire_compressed.glb?v=20261116_01',
    scale: 1.8,
    rotation: [0, Math.PI, 0] as [number, number, number],
    position: [0, 0.035, 0] as [number, number, number],
    initialEnvIntensity: 0.60,
    initialEnvRotation: 207,
    contrast: 1.14,
    sharpness: 0.65,
    shareFillRatio: 0.76,
    shareSlotHeight: 860
  }
];

export const TRAVELER_VAMP_TEXTURES: TextureItem[] = [
  { 
    id: 'traveler_vamp_01', 
    name: 'Vamp 01', 
    url: 'https://cdn.jsdelivr.net/gh/yayapewn/PAIHO-U-textures@main/traveler_vamp_color_01.jpg', 
    normalUrl: 'https://cdn.jsdelivr.net/gh/yayapewn/PAIHO-U-textures@main/traveler_vamp_normal_01.jpg',
    title: 'PERFORMANCE JACQUARD 01',
    description: 'High-density engineered jacquard weave delivering dynamic stability and dimensional micro-texture.',
    link: UNIFORM_LINK
  },
  { 
    id: 'traveler_vamp_02', 
    name: 'Vamp 02', 
    url: 'https://cdn.jsdelivr.net/gh/yayapewn/PAIHO-U-textures@main/traveler_vamp_color_02.jpg', 
    normalUrl: 'https://cdn.jsdelivr.net/gh/yayapewn/PAIHO-U-textures@main/traveler_vamp_normal_02.jpg',
    title: 'AERO-KNIT FLEX 02',
    description: 'Ultralight stretch yarn knit for adaptive foot contouring and superior breathability during movement.',
    link: UNIFORM_LINK
  },
  { 
    id: 'traveler_vamp_03', 
    name: 'Vamp 03', 
    url: 'https://cdn.jsdelivr.net/gh/yayapewn/PAIHO-U-textures@main/traveler_vamp_color_03.jpg', 
    normalUrl: 'https://cdn.jsdelivr.net/gh/yayapewn/PAIHO-U-textures@main/traveler_vamp_normal_03.jpg',
    title: 'BIO-CELLULAR MESH 03',
    description: 'Hexagonal open-pore cell matrix engineered for optimal thermal regulation and rapid moisture dispersal.',
    link: UNIFORM_LINK
  },
  { 
    id: 'traveler_vamp_04', 
    name: 'Vamp 04', 
    url: 'https://cdn.jsdelivr.net/gh/yayapewn/PAIHO-U-textures@main/traveler_vamp_color_04.jpg', 
    normalUrl: 'https://cdn.jsdelivr.net/gh/yayapewn/PAIHO-U-textures@main/traveler_vamp_normal_04.jpg',
    title: 'TACTICAL REINFORCED RIPSTOP 04',
    description: 'Abrasion-resistant technical composite weave reinforced with high-tenacity filament threads.',
    link: UNIFORM_LINK
  },
  { 
    id: 'traveler_vamp_05', 
    name: 'Vamp 05', 
    url: 'https://cdn.jsdelivr.net/gh/yayapewn/PAIHO-U-textures@main/traveler_vamp_color_05.jpg', 
    normalUrl: 'https://cdn.jsdelivr.net/gh/yayapewn/PAIHO-U-textures@main/traveler_vamp_normal_05.jpg',
    title: 'ECO-RECYCLE WOVEN 05',
    description: 'Sustainable post-consumer polymer fabric offering plush tactile finish and resilient tensile strength.',
    link: UNIFORM_LINK
  },
  { 
    id: 'traveler_vamp_06', 
    name: 'Vamp 06', 
    url: 'https://cdn.jsdelivr.net/gh/yayapewn/PAIHO-U-textures@main/traveler_vamp_color_06.jpg', 
    normalUrl: 'https://cdn.jsdelivr.net/gh/yayapewn/PAIHO-U-textures@main/traveler_vamp_normal_06.jpg',
    title: 'FUTURISTIC 3D RELIEF 06',
    description: 'Precision micro-embossed surface topography engineered for tactile depth and optical motion effects.',
    link: UNIFORM_LINK
  },
];

