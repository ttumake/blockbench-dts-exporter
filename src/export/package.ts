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
import type { Vec2 } from '../model/types';

export type BuiltExportUvPolygon = Vec2[];

export type BuiltExportMaterialInfo = {
  name: string;
  fileName: string;
  previewDataUrl: string;
  isTextureAsset: boolean;
  sourceWidth: number;
  sourceHeight: number;
  uvPolygons: BuiltExportUvPolygon[];
};

export type BuiltExportSourceMaterialInfo = {
  name: string;
  fileName: string;
  previewDataUrl: string;
  isTextureAsset: boolean;
  exportPolicy: NonNullable<ExportConfig['materialOverrides'][string]['exportPolicy']>;
  effectivePolicy: 'color' | 'texture';
  sourceWidth: number;
  sourceHeight: number;
  uvPolygons: BuiltExportUvPolygon[];
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
  id: string;
  name: string;
  enabled: boolean;
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
    normalized[name] = {
      ...(overrides[name] ?? {}),
      textureProcessing: overrides[name]?.textureProcessing ? { ...overrides[name]?.textureProcessing } : undefined
    };
  }

  return normalized;
}

function collectMaterialUvPolygons(model: ReturnType<typeof collectModel>): Map<string, BuiltExportUvPolygon[]> {
  const polygons = new Map<string, BuiltExportUvPolygon[]>();

  for (const object of model.shape.objects) {
    for (const face of object.mesh.faces) {
      const key = face.sourceMaterialName || face.materialName;
      const polygon = object.mesh.uvs
        .slice(face.vertexStart, face.vertexStart + face.vertexCount)
        .map((uv) => [uv[0], uv[1]] as Vec2);

      const list = polygons.get(key) ?? [];
      list.push(polygon);
      polygons.set(key, list);
    }
  }

  return polygons;
}

export function buildExportPackage(projectName: string, config: ExportConfig): BuiltExportPackage {
  const collectedModel = transformModelScale(
    transformModelOrientation(collectModel(projectName), config.orientation),
    config.scale
  );
  const materialUvPolygons = collectMaterialUvPolygons(collectedModel);
  const lodPlan = buildLodPlan(collectedModel);
  const sourceTextures = createAtlasTextureExport(collectedModel, config.textureProcessing, config.materialOverrides).textures;
  const transformed =
    config.mode === 'blockland_colors'
      ? transformModelToBlocklandColors(collectedModel)
      : config.mode === 'hybrid_textures'
        ? createHybridTextureExport(collectedModel, config.materialOverrides, config.textureProcessing)
        : createAtlasTextureExport(collectedModel, config.textureProcessing, config.materialOverrides);
  const materialNames = transformed.textures.map((texture) => texture.materialName);
  const normalizedConfig: ExportConfig = {
    ...config,
    materialOverrides: normalizeMaterialOverrides(materialNames, config.materialOverrides)
  };
  const enabledSequences = transformed.model.sequences.filter((sequence) => (
    config.enabledSequences[sequence.id] ?? true
  ));
  const exportModel = config.exportAnimations
    ? transformed.model
    : {
      ...transformed.model,
      sequences: [],
      summary: {
        ...transformed.model.summary,
        sequenceCount: 0,
        animationTrackCount: 0
      }
    };
  const exportModelWithSelection = config.exportAnimations
    ? {
      ...transformed.model,
      sequences: enabledSequences,
      summary: {
        ...transformed.model.summary,
        sequenceCount: enabledSequences.length,
        animationTrackCount: enabledSequences.reduce((sum, sequence) => sum + sequence.tracks.length, 0)
      }
    }
    : exportModel;

  return {
    content: writeDts(exportModelWithSelection, normalizedConfig),
    textures: transformed.textures,
    materialNames,
    textureCount: transformed.textures.length,
    mode: config.mode,
    analysis: {
      projectName,
      nodeCount: transformed.model.shape.nodes.length,
      objectCount: transformed.model.shape.objects.length,
      sequenceCount: exportModelWithSelection.sequences.length,
      animationTrackCount: exportModelWithSelection.sequences.reduce((sum, sequence) => sum + sequence.tracks.length, 0),
      sequences: transformed.model.sequences.map((sequence) => ({
        id: sequence.id,
        name: sequence.name,
        enabled: config.exportAnimations && (config.enabledSequences[sequence.id] ?? true),
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
        isTextureAsset: true,
        exportPolicy: config.materialOverrides[texture.materialName]?.exportPolicy ?? 'auto',
        effectivePolicy: transformed.textures.some((entry) => entry.materialName === texture.materialName) ? 'texture' : 'color',
        sourceWidth: texture.sourceWidth,
        sourceHeight: texture.sourceHeight,
        uvPolygons: materialUvPolygons.get(texture.materialName) ?? []
      })),
      materials: transformed.textures.map((texture) => ({
        name: texture.materialName,
        fileName: texture.fileName,
        previewDataUrl: texture.dataUrl,
        isTextureAsset: sourceTextures.some((sourceTexture) => sourceTexture.materialName === texture.materialName),
        sourceWidth: texture.sourceWidth,
        sourceHeight: texture.sourceHeight,
        uvPolygons: materialUvPolygons.get(texture.materialName) ?? []
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
