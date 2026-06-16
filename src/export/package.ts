import { collectModel } from '../blockbench/collect-model';
import { writeDts } from '../dts/writer';
import { transformModelOrientation, transformModelScale } from '../model/transform';
import type { ExportTextureAsset } from '../util/materials';
import { createAtlasTextureExport, transformModelToBlocklandColors } from '../util/materials';
import type { ExportConfig } from './config';

export type BuiltExportPackage = {
  content: ArrayBuffer;
  textures: ExportTextureAsset[];
  materialNames: string[];
  textureCount: number;
  mode: ExportConfig['mode'];
};

function normalizeMaterialOverrides(
  materialNames: string[],
  overrides: ExportConfig['materialOverrides']
): ExportConfig['materialOverrides'] {
  const normalized: ExportConfig['materialOverrides'] = {};

  for (const name of materialNames) {
    normalized[name] = { ...(overrides[name] ?? {}) };
  }

  return normalized;
}

export function buildExportPackage(projectName: string, config: ExportConfig): BuiltExportPackage {
  const collectedModel = transformModelScale(
    transformModelOrientation(collectModel(projectName), config.orientation),
    config.scale
  );
  const transformed =
    config.mode === 'blockland_colors'
      ? transformModelToBlocklandColors(collectedModel)
      : createAtlasTextureExport(collectedModel);
  const materialNames = transformed.textures.map((texture) => texture.materialName);
  const normalizedConfig: ExportConfig = {
    ...config,
    materialOverrides: normalizeMaterialOverrides(materialNames, config.materialOverrides)
  };

  return {
    content: writeDts(transformed.model, normalizedConfig),
    textures: transformed.textures,
    materialNames,
    textureCount: transformed.textures.length,
    mode: config.mode
  };
}
