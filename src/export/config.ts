export type ExportMode = 'blockland_colors' | 'atlas_textures';
export type ExportOrientation =
  | 'none'
  | 'blockland_swap_yz_flip_xz';

export type DtsMaterialExportFlags = {
  sWrap: boolean;
  tWrap: boolean;
  noMipMap: boolean;
  mipMapZeroBorder: boolean;
  neverEnvMap: boolean;
};

export type DtsMaterialOverride = {
  selfIlluminating?: boolean;
};

export type ExportConfig = {
  mode: ExportMode;
  orientation: ExportOrientation;
  materialFlags: DtsMaterialExportFlags;
  materialOverrides: Record<string, DtsMaterialOverride>;
};

export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  mode: 'blockland_colors',
  orientation: 'blockland_swap_yz_flip_xz',
  materialFlags: {
    sWrap: true,
    tWrap: true,
    noMipMap: true,
    mipMapZeroBorder: true,
    neverEnvMap: true
  },
  materialOverrides: {}
};
