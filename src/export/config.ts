export type ExportMode = 'blockland_colors' | 'atlas_textures' | 'hybrid_textures';
export type DtsFormatVersion = 24 | 25;
export type ExportOrientation =
  | 'none'
  | 'blockland_swap_yz_flip_xz';

export type MaterialExportPolicy = 'auto' | 'color' | 'texture';

export type DtsMaterialExportFlags = {
  sWrap: boolean;
  tWrap: boolean;
  noMipMap: boolean;
  mipMapZeroBorder: boolean;
  neverEnvMap: boolean;
};

export type DtsMaterialOverride = {
  selfIlluminating?: boolean;
  exportPolicy?: MaterialExportPolicy;
  textureProcessing?: Partial<TextureProcessingConfig>;
};

export type TextureProcessingConfig = {
  bleedPasses: number;
  upscaleTargetSize: number;
};

export type ExportConfig = {
  dtsVersion: DtsFormatVersion;
  mode: ExportMode;
  exportAnimations: boolean;
  enabledSequences: Record<string, boolean>;
  orientation: ExportOrientation;
  scale: number;
  textureProcessing: TextureProcessingConfig;
  materialFlags: DtsMaterialExportFlags;
  materialOverrides: Record<string, DtsMaterialOverride>;
};

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  dtsVersion: 24,
  mode: 'hybrid_textures',
  exportAnimations: true,
  enabledSequences: {},
  orientation: 'blockland_swap_yz_flip_xz',
  scale: 1 / 16,
  textureProcessing: {
    bleedPasses: 4,
    upscaleTargetSize: 64
  },
  materialFlags: {
    sWrap: true,
    tWrap: true,
    noMipMap: true,
    mipMapZeroBorder: true,
    neverEnvMap: true
  },
  materialOverrides: {}
};
