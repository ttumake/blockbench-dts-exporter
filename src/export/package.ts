import { collectModel } from '../blockbench/collect-model';
import { writeDts } from '../dts/writer';
import { buildLodPlan } from '../dts/writer-lod';
import { transformModelOrientation, transformModelScale } from '../model/transform';
import type { ExportTextureAsset } from '../util/materials';
import {
  createAtlasTextureExport,
  createHybridTextureExport,
  transformModelToBlocklandColors
} from '../util/materials';
import type { ExportConfig } from './config';

export type BuiltExportMaterialInfo = {
  name: string;
  fileName: string;
  previewDataUrl: string;
};

export type BuiltExportSourceMaterialInfo = {
  name: string;
  fileName: string;
  previewDataUrl: string;
  exportPolicy: NonNullable<ExportConfig['materialOverrides'][string]['exportPolicy']>;
};

export type BuiltExportLodInfo = {
  name: string;
  size: number;
  objectCount: number;
  objectNames: string[];
};

export type BuiltExportSequenceTrackInfo = {
  targetName: string;
  channel: string;
  keyframeCount: number;
};

export type BuiltExportSequenceInfo = {
  name: string;
  length: number;
  loop: 'once' | 'hold' | 'loop';
  snapping: number;
  markerCount: number;
  markers: Array<{
    name: string;
    time: number;
  }>;
  trackCount: number;
  tracks: BuiltExportSequenceTrackInfo[];
};

export type BuiltExportPackageAnalysis = {
  projectName: string;
  nodeCount: number;
  objectCount: number;
  sequenceCount: number;
  animationTrackCount: number;
  sequences: BuiltExportSequenceInfo[];
  textureCount: number;
  materialCount: number;
  sourceMaterials: BuiltExportSourceMaterialInfo[];
  materials: BuiltExportMaterialInfo[];
  lod: {
    enabled: boolean;
    levelCount: number;
    levels: BuiltExportLodInfo[];
    modeDescription: string;
  };
};

export type BuiltExportPackage = {
  content: ArrayBuffer;
  textures: ExportTextureAsset[];
  materialNames: string[];
  textureCount: number;
  mode: ExportConfig['mode'];
  analysis: BuiltExportPackageAnalysis;
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
  const lodPlan = buildLodPlan(collectedModel);
  const sourceTextures = createAtlasTextureExport(collectedModel).textures;
  const transformed =
    config.mode === 'blockland_colors'
      ? transformModelToBlocklandColors(collectedModel)
      : config.mode === 'hybrid_textures'
        ? createHybridTextureExport(collectedModel, config.materialOverrides)
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
    mode: config.mode,
    analysis: {
      projectName,
      nodeCount: transformed.model.shape.nodes.length,
      objectCount: transformed.model.shape.objects.length,
      sequenceCount: transformed.model.sequences.length,
      animationTrackCount: transformed.model.sequences.reduce((sum, sequence) => sum + sequence.tracks.length, 0),
      sequences: transformed.model.sequences.map((sequence) => ({
        name: sequence.name,
        length: sequence.length,
        loop: sequence.loop,
        snapping: sequence.snapping,
        markerCount: sequence.markers.length,
        markers: sequence.markers.map((marker) => ({
          name: marker.name,
          time: marker.time
        })),
        trackCount: sequence.tracks.length,
        tracks: sequence.tracks.map((track) => ({
          targetName: track.targetName,
          channel: track.channel,
          keyframeCount: track.keyframeCount
        }))
      })),
      textureCount: transformed.textures.length,
      materialCount: materialNames.length,
      sourceMaterials: sourceTextures.map((texture) => ({
        name: texture.materialName,
        fileName: texture.fileName,
        previewDataUrl: texture.dataUrl,
        exportPolicy: config.materialOverrides[texture.materialName]?.exportPolicy ?? 'auto'
      })),
      materials: transformed.textures.map((texture) => ({
        name: texture.materialName,
        fileName: texture.fileName,
        previewDataUrl: texture.dataUrl
      })),
      lod: {
        enabled: lodPlan.isLodExport,
        levelCount: lodPlan.detailLevels.length,
        levels: lodPlan.detailLevels.map((detailLevel) => ({
          name: detailLevel.name,
          size: detailLevel.size,
          objectCount: detailLevel.variantsByBaseName.size,
          objectNames: Array.from(detailLevel.variantsByBaseName.keys()).sort()
        })),
        modeDescription: lodPlan.isLodExport
          ? 'Using explicit detailNN groups.'
          : 'No detailNN groups found. Exporting a single default detail level.'
      }
    }
  };
}
