import type { ExportConfig } from '../export/config';
import { DtsBufferWriter } from './buffers';
import type { ExportMesh, ExportModel, ExportObject } from '../model/types';
import {
  DTS_EXPORTER_VERSION,
  DTS_MATERIAL_MIP_MAP_ZERO_BORDER,
  DTS_MATERIAL_NEVER_ENVMAP,
  DTS_MATERIAL_NO_MIP_MAP,
  DTS_MATERIAL_SELF_ILLUMINATING,
  DTS_MATERIAL_S_WRAP,
  DTS_MATERIAL_T_WRAP,
  DTS_VERSION,
  type BlocklandNodeSource,
  type DtsDetailLevel,
  type DtsMaterial,
  type DtsNode,
  type DtsObject,
  type DtsObjectState
} from './writer-types';

function encodeAsciiBytes(value: string): number[] {
  const bytes: number[] = [];

  for (let index = 0; index < value.length; index += 1) {
    bytes.push(value.charCodeAt(index) & 0xff);
  }

  return bytes;
}

export function buildMaterialTable(objects: ExportObject[], config: ExportConfig): DtsMaterial[] {
  const names = new Set<string>();

  for (const object of objects) {
    for (const name of object.mesh.materialNames) {
      names.add(name);
    }
  }

  if (names.size === 0) {
    names.add('blank');
  }

  let materialFlags = 0;
  if (config.materialFlags.sWrap) materialFlags |= DTS_MATERIAL_S_WRAP;
  if (config.materialFlags.tWrap) materialFlags |= DTS_MATERIAL_T_WRAP;
  if (config.materialFlags.neverEnvMap) materialFlags |= DTS_MATERIAL_NEVER_ENVMAP;
  if (config.materialFlags.noMipMap) materialFlags |= DTS_MATERIAL_NO_MIP_MAP;
  if (config.materialFlags.mipMapZeroBorder) materialFlags |= DTS_MATERIAL_MIP_MAP_ZERO_BORDER;

  return Array.from(names).map((name) => {
    let flags = materialFlags;
    if (config.materialOverrides[name]?.selfIlluminating) {
      flags |= DTS_MATERIAL_SELF_ILLUMINATING;
    }

    return {
      name,
      flags,
      reflectanceMap: -1,
      bumpMap: -1,
      detailMap: -1,
      detailScale: 1,
      reflectance: 0
    };
  });
}

export function rewriteMaterialIndices(mesh: ExportMesh, materialIndexLookup: Map<string, number>): ExportMesh {
  return {
    ...mesh,
    materialNames: Array.from(materialIndexLookup.keys()),
    faces: mesh.faces.map((face) => ({
      ...face,
      materialIndex: materialIndexLookup.get(face.materialName) ?? 0
    }))
  };
}

export function writeNode(writer: DtsBufferWriter, node: DtsNode): void {
  writer.writeInt32(node.nameIndex);
  writer.writeInt32(node.parentIndex);
  writer.writeInt32(node.firstObject);
  writer.writeInt32(node.firstChild);
  writer.writeInt32(node.nextSibling);
}

export function writeObject(writer: DtsBufferWriter, object: DtsObject): void {
  writer.writeInt32(object.nameIndex);
  writer.writeInt32(object.numMeshes);
  writer.writeInt32(object.firstMesh);
  writer.writeInt32(object.nodeIndex);
  writer.writeInt32(object.nextSibling);
  writer.writeInt32(object.firstDecal);
}

export function writeObjectState(writer: DtsBufferWriter, state: DtsObjectState): void {
  writer.writeFloat32(state.vis);
  writer.writeInt32(state.frame);
  writer.writeInt32(state.matFrame);
}

export function writeDetailLevel(writer: DtsBufferWriter, detail: DtsDetailLevel): void {
  writer.writeInt32(detail.nameIndex);
  writer.writeInt32(detail.subshape);
  writer.writeInt32(detail.objectDetail);
  writer.writeFloat32(detail.size);
  writer.writeFloat32(detail.avgError);
  writer.writeFloat32(detail.maxError);
  writer.writeInt32(detail.polyCount);
}

export function synthesizeBlocklandNodes(model: ExportModel, sourceObjects: ExportObject[]): BlocklandNodeSource[] {
  const referencedSequenceNodeNames = new Set(
    model.sequences.flatMap((sequence) => sequence.tracks.map((track) => track.targetName))
  );
  const sourceNodeMap = new Map(model.shape.nodes.map((node) => [node.id, node]));
  const nodes: BlocklandNodeSource[] = [
    {
      id: '__main__',
      name: 'main',
      parentId: null,
      objectIds: [],
      localTransform: { origin: [0, 0, 0] }
    },
    {
      id: '__start__',
      name: 'start',
      parentId: '__main__',
      objectIds: [],
      localTransform: { origin: [0, 0, 0] }
    },
    {
      id: '__render__',
      name: 'stock100',
      parentId: '__start__',
      objectIds: [],
      localTransform: { origin: [0, 0, 0] }
    }
  ];

  for (const shapeNode of model.shape.nodes) {
    if (shapeNode.id === '__root__' || shapeNode.name === 'pistol') {
      continue;
    }

    const hasObjects = shapeNode.objectIds.some((objectId) => sourceObjects.some((object) => object.id === objectId));
    const isAnimated = referencedSequenceNodeNames.has(shapeNode.name);
    const isHelper = shapeNode.objectIds.length === 0;

    if (!hasObjects && !isAnimated && !isHelper) {
      continue;
    }

    const parentShapeNode = shapeNode.parentId ? sourceNodeMap.get(shapeNode.parentId) : undefined;
    const parentIsPistolLike = !parentShapeNode || parentShapeNode.id === '__root__' || parentShapeNode.name === 'pistol';
    const parentId = parentIsPistolLike ? '__start__' : shapeNode.parentId ?? '__start__';

    nodes.push({
      id: shapeNode.id,
      name: shapeNode.name,
      parentId,
      objectIds: hasObjects
        ? shapeNode.objectIds.filter((objectId) => sourceObjects.some((object) => object.id === objectId))
        : [],
      localTransform: {
        origin: shapeNode.localTransform.origin
      }
    });
  }

  if (nodes.some((node) => node.id === '__render__' && node.objectIds.length === 0)) {
    const bodyObject = sourceObjects.find((object) => object.name === 'body');
    if (bodyObject) {
      const renderNode = nodes.find((node) => node.id === '__render__');
      if (renderNode) {
        renderNode.objectIds = [bodyObject.id];
      }
    }
  }

  return nodes;
}

export function encodeHeader(target: number[], finalized: ReturnType<DtsBufferWriter['finalize']>): void {
  const header = new DataView(new ArrayBuffer(16));
  header.setInt16(0, DTS_VERSION, true);
  header.setInt16(2, DTS_EXPORTER_VERSION, true);
  header.setInt32(4, finalized.sizeAllDwords, true);
  header.setInt32(8, finalized.start16Dwords, true);
  header.setInt32(12, finalized.start8Dwords, true);
  target.push(...new Uint8Array(header.buffer));
}

export function encodeSequenceBlock(target: number[]): void {
  const sequenceCount = new DataView(new ArrayBuffer(4));
  sequenceCount.setInt32(0, 0, true);
  target.push(...new Uint8Array(sequenceCount.buffer));
}

export function encodeMaterialBlock(target: number[], materials: DtsMaterial[]): void {
  target.push(0x01);

  const countField = new DataView(new ArrayBuffer(4));
  countField.setInt32(0, materials.length, true);
  target.push(...new Uint8Array(countField.buffer));

  for (const material of materials) {
    const encoded = encodeAsciiBytes(material.name);
    target.push(encoded.length & 0xff);
    target.push(...encoded);
  }

  for (const material of materials) {
    const field = new DataView(new ArrayBuffer(4));
    field.setUint32(0, material.flags >>> 0, true);
    target.push(...new Uint8Array(field.buffer));
  }

  for (const material of materials) {
    const field = new DataView(new ArrayBuffer(4));
    field.setInt32(0, material.reflectanceMap, true);
    target.push(...new Uint8Array(field.buffer));
  }

  for (const material of materials) {
    const field = new DataView(new ArrayBuffer(4));
    field.setInt32(0, material.bumpMap, true);
    target.push(...new Uint8Array(field.buffer));
  }

  for (const material of materials) {
    const field = new DataView(new ArrayBuffer(4));
    field.setInt32(0, material.detailMap, true);
    target.push(...new Uint8Array(field.buffer));
  }

  for (const material of materials) {
    const field = new DataView(new ArrayBuffer(4));
    field.setFloat32(0, material.detailScale, true);
    target.push(...new Uint8Array(field.buffer));
  }

  for (const material of materials) {
    const field = new DataView(new ArrayBuffer(4));
    field.setFloat32(0, material.reflectance, true);
    target.push(...new Uint8Array(field.buffer));
  }
}
