export type ShoeModelId = 'traveler' | 'lace' | 'dna' | string;

export interface ModelPartRule {
  interactiveMode: 'blacklist' | 'whitelist';
  blacklist?: string[];
  whitelist?: string[];
  staticLockedParts: string[];
  libraryDisabledParts: string[];
  categoryBParts: string[];
  smartParts: string[];
  smartInsoleParts: string[];
  smartInvertLabelParts: string[];
  smartDarkTextParts?: string[];
  smartChromaLogoParts?: string[];
  linkedColorGroups?: string[][];
}

// DNA 最新模型 (DNA_shoe-33-L.obj) 明確定義的 23 個部位名稱對照表
const DNA_EXACT_PART_MAP: Record<string, string> = {
  MEDIAL_REINFORCEMENT: 'Medial Reinforcement',
  EYELET: 'Eyelet',
  VAMP_STRAP: 'Vamp Strap',
  VAMP_REINFORCEMENT: 'Vamp Reinforcement',
  QUARTER_REINFORCEMENT: 'Quarter Reinforcement',
  HEEL_COUNTER: 'Heel Counter',
  OUTSOLE: 'Outsole',
  FOREFOOT_REINFORCEMENT: 'Forefoot Reinforcement',
  INNER: 'Inner',
  SOCKLINER: 'Sockliner',
  LATERAL_LOOP: 'Lateral Loop',
  MIDSOLE: 'Midsole',
  PULL_TAB: 'Pull Tab',
  SHANK: 'Shank',
  TONGUE_REINFORCEMENT1: 'Tongue Reinforcement 1',
  TONGUE_REINFORCEMENT2: 'Tongue Reinforcement 2',
  TONGUE: 'Tongue',
  CORD_STOPPER: 'Cord Stopper',
  QUARTER: 'Quarter',
  HEEL_STRAP: 'Heel Strap',
  STRAP_TAB: 'Strap Tab',
  LABEL: 'Label',
  SHOELACE: 'Shoelace',
};

// 未給名稱或 3D 軟體自動產生的預設幾何物件名稱特徵（一律視為未命名部位）
const UNNAMED_MESH_PATTERN = /^(PART[_\s]*\d*|OBJECT[_\s]*\d*|MESH[_\s]*\d*|BOX[_\s]*\d*|SPHERE[_\s]*\d*|CYLINDER[_\s]*\d*|PLANE[_\s]*\d*|SHAPE[_\s]*\d*|LINE[_\s]*\d*|GROUP[_\s]*\d*|NODE[_\s]*\d*|DEFAULT|UNTITLED|POLY[_\s]*SURFACE\d*)$/i;

/**
 * 各鞋款完全獨立的部位規則配置表
 * 確保即使不同鞋款擁有相同名稱的部位（如 Tongue、Midsole、Outsole），規則與狀態仍完全隔離
 */
export const MODEL_PART_RULES: Record<string, ModelPartRule> = {
  traveler: {
    interactiveMode: 'blacklist',
    blacklist: ['OBJECT021', 'OBJECT022', 'OBJECT001'],
    staticLockedParts: ['OBJECT021', 'OBJECT022', 'OBJECT001'],
    libraryDisabledParts: [
      'OBJECT011',
      'MIDSOLE',
      'LINE048',
      'OBJECT019',
      'TONGUE LABEL',
      'QUARTER LABEL',
      'TONGUE REINFORCEMENT',
      'HEEL COLLAR REINFORCEMENT',
      'EYELET',
      'HEEL STRAP',
      'QUARTER OVERLAY',
      'OUTSOLE',
    ],
    categoryBParts: [
      'OBJECT011',
      'MIDSOLE',
      'LINE048',
      'TONGUE REINFORCEMENT',
      'HEEL COLLAR REINFORCEMENT',
      'EYELET',
      'HEEL STRAP',
      'QUARTER OVERLAY',
    ],
    smartParts: ['OBJECT019', 'TONGUE LABEL', 'QUARTER LABEL', 'OUTSOLE'],
    smartInsoleParts: ['OBJECT019'],
    smartInvertLabelParts: [],
    linkedColorGroups: [
      ['Tongue Reinforcement', 'Heel Collar Reinforcement'],
    ],
  },
  lace: {
    interactiveMode: 'whitelist',
    whitelist: [
      'WELT',
      'VAMP',
      'MIDSOLE',
      'HEEL_COUNTER',
      'HEEL COUNTER',
      'OUTSOLE',
      'LINE048',
      'TONGUE',
      'COLLAR',
      'PULL_TAB',
      'PULL TAB',
    ],
    staticLockedParts: [],
    libraryDisabledParts: [
      'TONGUE',
      'OBJECT011',
      'MIDSOLE',
      'LINE048',
      'OBJECT019',
      'TONGUE LABEL',
      'QUARTER LABEL',
      'TONGUE REINFORCEMENT',
      'HEEL COLLAR REINFORCEMENT',
      'EYELET',
      'HEEL STRAP',
      'QUARTER OVERLAY',
      'OUTSOLE',
    ],
    categoryBParts: [
      'TONGUE',
      'OBJECT011',
      'MIDSOLE',
      'LINE048',
      'TONGUE REINFORCEMENT',
      'HEEL COLLAR REINFORCEMENT',
      'EYELET',
      'HEEL STRAP',
      'QUARTER OVERLAY',
    ],
    smartParts: ['OUTSOLE'],
    smartInsoleParts: [],
    smartInvertLabelParts: [],
  },
  dna: {
    interactiveMode: 'whitelist',
    whitelist: [
      ...Object.keys(DNA_EXACT_PART_MAP),
      ...Object.values(DNA_EXACT_PART_MAP).map((name) => name.toUpperCase()),
    ],
    // 第 3 種：靜態鎖定（未列入白名單或未命名部位一律自動鎖定）
    staticLockedParts: [],
    // 第 2、4、4.1、4.2 種皆禁用圖庫貼圖
    libraryDisabledParts: [
      'VAMP REINFORCEMENT',
      'FOREFOOT REINFORCEMENT',
      'MEDIAL REINFORCEMENT',
      'QUARTER REINFORCEMENT',
      'HEEL COUNTER',
      'STRAP TAB',
      'TONGUE REINFORCEMENT 1',
      'TONGUE REINFORCEMENT 2',
      'EYELET',
      'LATERAL LOOP',
      'CORD STOPPER',
      'LABEL',
      'INNER',
      'SOCKLINER',
      'MIDSOLE',
      'SHANK',
      'OUTSOLE',
    ],
    // 第 2 種：純色覆蓋模式（12 個）
    categoryBParts: [
      'VAMP REINFORCEMENT',
      'MEDIAL REINFORCEMENT',
      'QUARTER REINFORCEMENT',
      'HEEL COUNTER',
      'STRAP TAB',
      'TONGUE REINFORCEMENT 1',
      'EYELET',
      'LATERAL LOOP',
      'CORD STOPPER',
      'INNER',
      'MIDSOLE',
      'OUTSOLE',
    ],
    // 第 4 / 4.1 / 4.2 種：智慧去背系列（5 個）
    smartParts: [
      'FOREFOOT REINFORCEMENT',
      'TONGUE REINFORCEMENT 2',
      'LABEL',
      'SOCKLINER',
      'SHANK',
    ],
    // 第 4.1 種：智慧去背「無黑色免疫」特化版（1 個）
    smartInsoleParts: ['SOCKLINER'],
    // 第 4.2 種：智慧去背反轉標籤模式（底色改為目標色，文字/Logo 僅在黑/白間依背景明度自動切換）（3 個）
    smartInvertLabelParts: ['LABEL', 'FOREFOOT REINFORCEMENT', 'TONGUE REINFORCEMENT 2'],
    // 其中原圖為「淺底黑字」的部位，需反轉亮度遮罩方向以正確鎖定文字為黑/白
    smartDarkTextParts: ['FOREFOOT REINFORCEMENT'],
    // 其中原圖為「中性灰底＋彩色 Logo（高彩度黃綠標誌）」的部位，改以彩度分離 Logo
    smartChromaLogoParts: ['TONGUE REINFORCEMENT 2'],
    // 連動改色群組：點選並調整其中任一部位顏色時，同群組其餘部位同步換色
    linkedColorGroups: [
      [
        'Vamp Reinforcement',
        'Heel Counter',
        'Quarter Reinforcement',
        'Tongue Reinforcement 1',
        'Strap Tab',
      ],
    ],
  },
};

const DEFAULT_PART_RULE: ModelPartRule = MODEL_PART_RULES.traveler;

export const getModelPartRule = (modelId?: ShoeModelId): ModelPartRule => {
  if (!modelId) return DEFAULT_PART_RULE;
  return MODEL_PART_RULES[modelId] || DEFAULT_PART_RULE;
};

/**
 * 統一產生鞋款與部位的獨立儲存鍵值（確保不同鞋款的同名部位狀態絕對不互相覆蓋）
 */
export const getPartStorageKey = (modelId: ShoeModelId | undefined, partName: string): string => {
  return `${modelId || 'default'}_${partName}`;
};

/**
 * 統一三雙鞋的部位名稱標準化邏輯
 * - DNA：精準比對 23 個部位，避免字根重疊誤合併（如 Vamp_Strap 與 Vamp_Reinforcement），且保留獨立編號
 * - Traveler / Lace：維持完全相容的部位名稱規範
 */
export const getNormalizedPartName = (meshName: string, modelId?: ShoeModelId): string => {
  const trimmed = (meshName || '').trim();
  if (!trimmed) return 'Unnamed';

  const upperName = trimmed.toUpperCase();

  // DNA 鞋款：採用精準獨立映射，並相容 Three.js GLTFLoader 同名父子節點產生的 _1/_2 去重後綴
  if (modelId === 'dna') {
    const normalizedKey = upperName.replace(/[\s-]+/g, '_');
    const dedupedKey = normalizedKey.replace(/_\d+$/, '');
    if (DNA_EXACT_PART_MAP[normalizedKey]) {
      return DNA_EXACT_PART_MAP[normalizedKey];
    }
    if (!UNNAMED_MESH_PATTERN.test(trimmed) && DNA_EXACT_PART_MAP[dedupedKey]) {
      return DNA_EXACT_PART_MAP[dedupedKey];
    }

    // 未在明確命名表中的部位（含自動編號/未命名物件）維持獨立命名格式，並由 isPartInteractive 鎖定為靜態模式
    const clean = trimmed
      .replace(/_+/g, ' ')
      .replace(/(\D)(\d+)$/, '$1 $2')
      .trim();

    return clean
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => (/^\d+$/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
      .join(' ');
  }

  // Traveler & Lace 專屬部位名稱對照（先比對長詞組，再比對短詞）
  if (upperName.includes('TONGUE_PULL_TAB')) return 'Tongue Pull Tab';
  if (upperName.includes('TONGUE_LABEL')) return 'Tongue Label';
  if (upperName.includes('TONGUE_REINFORCEMENT')) return 'Tongue Reinforcement';
  if (upperName.includes('TONGUE')) return 'Tongue';

  if (upperName.includes('HEEL_PULL_TAB')) return 'Heel Pull Tab';
  if (
    upperName.includes('HEEL_COLLAR_REINFORCEMENT') ||
    upperName.includes('HEEL COLLAR REINFORCEMENT') ||
    upperName.includes('OBJECT018')
  ) {
    return 'Heel Collar Reinforcement';
  }
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
  if (upperName.includes('LINE048')) return 'Line048';

  const clean = trimmed
    .replace(/_+/g, ' ')
    .replace(/\d+$/, '')
    .trim();

  return (clean || trimmed)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * 判斷部位是否可點擊互動
 * - DNA：未給名稱或未列入白名單的部位，一律回傳 false（靜態鎖定模式）
 */
export const isPartInteractive = (meshName: string, modelId?: ShoeModelId): boolean => {
  const trimmed = (meshName || '').trim();
  if (!trimmed) return false;

  const upperRaw = trimmed.toUpperCase();
  const normalizedUpper = getNormalizedPartName(trimmed, modelId).toUpperCase();
  const rule = getModelPartRule(modelId);

  // 靜態鎖定清單（含額外指定鎖定部位）
  if (
    rule.staticLockedParts.some(
      (locked) => upperRaw === locked || normalizedUpper === locked
    )
  ) {
    return false;
  }

  if (modelId === 'dna') {
    // 沒有給正式名稱（空白或預設幾何名稱）一律靜態鎖定
    if (UNNAMED_MESH_PATTERN.test(trimmed)) {
      return false;
    }
    const whitelist = rule.whitelist || [];
    const normalizedKey = upperRaw.replace(/[\s-]+/g, '_');
    return whitelist.includes(upperRaw) || whitelist.includes(normalizedKey) || whitelist.includes(normalizedUpper);
  }

  if (rule.interactiveMode === 'blacklist') {
    const blacklist = rule.blacklist || [];
    return !blacklist.some((bl) => upperRaw.includes(bl));
  }

  const whitelist = rule.whitelist || [];
  return whitelist.some(
    (keyword) => upperRaw.includes(keyword.toUpperCase()) || normalizedUpper === keyword.toUpperCase()
  );
};

/**
 * 判斷該鞋款的指定部位是否開放材質貼圖庫 (Library)
 */
export const isPartLibrarySupported = (partName: string, modelId?: ShoeModelId): boolean => {
  if (!partName) return false;
  const upperName = partName.toUpperCase();
  const rule = getModelPartRule(modelId);
  return !rule.libraryDisabledParts.includes(upperName);
};

/**
 * 判斷該鞋款的指定部位是否屬於 B 類（純色覆蓋模式：改色時清除原貼圖）
 */
export const isCategoryBPart = (partName: string, modelId?: ShoeModelId): boolean => {
  if (!partName) return false;
  const upperName = partName.toUpperCase();
  const rule = getModelPartRule(modelId);
  return rule.categoryBParts.includes(upperName);
};

/**
 * 判斷該鞋款的指定部位是否屬於 Smart Part（保留紅色 Logo 與文字抗鋸齒染色，含 4 / 4.1 / 4.2）
 */
export const isSmartColorPart = (partName: string, modelId?: ShoeModelId): boolean => {
  if (!partName) return false;
  const upperName = partName.toUpperCase();
  const rule = getModelPartRule(modelId);
  return rule.smartParts.includes(upperName) || rule.smartInvertLabelParts.includes(upperName);
};

/**
 * 判斷是否為 Smart Insole 鞋墊部位（第 4.1 種）
 */
export const isSmartInsolePart = (partName: string, modelId?: ShoeModelId): boolean => {
  if (!partName) return false;
  const upperName = partName.toUpperCase();
  const rule = getModelPartRule(modelId);
  return rule.smartInsoleParts.includes(upperName);
};

/**
 * 判斷是否為 Smart Invert Label 部位（第 4.2 種：底色改色，文字僅於黑/白間依明度切換）
 */
export const isSmartInvertLabelPart = (partName: string, modelId?: ShoeModelId): boolean => {
  if (!partName) return false;
  const upperName = partName.toUpperCase();
  const rule = getModelPartRule(modelId);
  return rule.smartInvertLabelParts.includes(upperName);
};

/**
 * 判斷第 4.2 種部位的原圖是否為「淺底深字」（例如 Forefoot Reinforcement 的 RUNNING CONCEPT）
 */
export const isSmartDarkTextPart = (partName: string, modelId?: ShoeModelId): boolean => {
  if (!partName) return false;
  const upperName = partName.toUpperCase();
  const rule = getModelPartRule(modelId);
  return (rule.smartDarkTextParts || []).includes(upperName);
};

/**
 * 判斷第 4.2 種部位的原圖是否為「中性灰/白底＋高彩度彩色 Logo」（例如 Tongue Reinforcement 2）
 */
export const isSmartChromaLogoPart = (partName: string, modelId?: ShoeModelId): boolean => {
  if (!partName) return false;
  const upperName = partName.toUpperCase();
  const rule = getModelPartRule(modelId);
  return (rule.smartChromaLogoParts || []).includes(upperName);
};

/**
 * 取得與指定部位連動改色的所有標準化部位名稱清單（若無連動則僅回傳自身）
 */
export const getLinkedColorParts = (partName: string, modelId?: ShoeModelId): string[] => {
  if (!partName) return [];
  const upperName = partName.toUpperCase();
  const rule = getModelPartRule(modelId);
  const matchedGroup = (rule.linkedColorGroups || []).find((group) =>
    group.some((item) => item.toUpperCase() === upperName)
  );
  return matchedGroup ? [...matchedGroup] : [partName];
};
