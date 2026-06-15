import { DtsBufferWriter } from './buffers';
import type { ExportMesh, ExportModel, ExportObject, Vec3 } from './mesh';

const DTS_VERSION = 24;
const DTS_EXPORTER_VERSION = 0;
const DTS_MESH_TYPE_STANDARD = 0;
const DTS_PRIMITIVE_INDEXED = 0x20000000;
const DTS_MATERIAL_S_WRAP = 0x00000001;
const DTS_MATERIAL_T_WRAP = 0x00000002;
const DTS_MATERIAL_NEVER_ENVMAP = 0x00000040;

type DtsNode = {
  nameIndex: number;
  parentIndex: number;
  firstObject: number;
  firstChild: number;
  nextSibling: number;
};

type DtsObject = {
  nameIndex: number;
  numMeshes: number;
  firstMesh: number;
  nodeIndex: number;
  nextSibling: number;
  firstDecal: number;
};

type DtsSubshape = {
  firstNode: number;
  firstObject: number;
  firstDecal: number;
  numNodes: number;
  numObjects: number;
  numDecals: number;
};

type DtsDetailLevel = {
  nameIndex: number;
  subshape: number;
  objectDetail: number;
  size: number;
  avgError: number;
  maxError: number;
  polyCount: number;
};

type DtsObjectState = {
  vis: number;
  frame: number;
  matFrame: number;
};

type DtsPrimitive = {
  firstElement: number;
  numElements: number;
  type: number;
};

type DtsMaterial = {
  name: string;
  flags: number;
  reflectanceMap: number;
  bumpMap: number;
  detailMap: number;
  detailScale: number;
  reflectance: number;
};

type DtsMesh = {
  bounds: {
    min: Vec3;
    max: Vec3;
  };
  center: Vec3;
  radius: number;
  numFrames: number;
  numMatFrames: number;
  parent: number;
  type: number;
  verts: Vec3[];
  tverts: [number, number][];
  normals: Vec3[];
  enormals: number[];
  primitives: DtsPrimitive[];
  indices: number[];
  mindices: number[];
  vertsPerFrame: number;
  flags: number;
};

function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function length(value: Vec3): number {
  return Math.sqrt(value[0] ** 2 + value[1] ** 2 + value[2] ** 2);
}

function normalize(value: Vec3): Vec3 {
  const valueLength = length(value);
  if (valueLength === 0) {
    return [0, 0, 1];
  }

  return [value[0] / valueLength, value[1] / valueLength, value[2] / valueLength];
}

function computeBounds(vertices: Vec3[]): { min: Vec3; max: Vec3 } {
  if (vertices.length === 0) {
    return {
      min: [0, 0, 0],
      max: [0, 0, 0]
    };
  }

  const min: Vec3 = [...vertices[0]];
  const max: Vec3 = [...vertices[0]];

  for (const [x, y, z] of vertices) {
    min[0] = Math.min(min[0], x);
    min[1] = Math.min(min[1], y);
    min[2] = Math.min(min[2], z);
    max[0] = Math.max(max[0], x);
    max[1] = Math.max(max[1], y);
    max[2] = Math.max(max[2], z);
  }

  return { min, max };
}

function computeCenter(min: Vec3, max: Vec3): Vec3 {
  return [
    (min[0] + max[0]) * 0.5,
    (min[1] + max[1]) * 0.5,
    (min[2] + max[2]) * 0.5
  ];
}

function computeRadius(vertices: Vec3[], center: Vec3): number {
  let radius = 0;

  for (const vertex of vertices) {
    radius = Math.max(radius, length(subtract(vertex, center)));
  }

  return radius;
}

function computeTubeRadius(vertices: Vec3[], center: Vec3): number {
  let radius = 0;

  for (const vertex of vertices) {
    const deltaX = vertex[0] - center[0];
    const deltaY = vertex[1] - center[1];
    radius = Math.max(radius, Math.sqrt(deltaX * deltaX + deltaY * deltaY));
  }

  return radius;
}

function buildFaceNormals(mesh: ExportMesh): Vec3[] {
  const normals: Vec3[] = Array.from({ length: mesh.vertices.length }, () => [0, 0, 1]);

  for (const face of mesh.faces) {
    const v0 = mesh.vertices[face.vertexStart];
    const v1 = mesh.vertices[face.vertexStart + 1];
    const v2 = mesh.vertices[face.vertexStart + 2];
    const normal = normalize(cross(subtract(v1, v0), subtract(v2, v0)));

    for (let offset = 0; offset < face.vertexCount; offset += 1) {
      normals[face.vertexStart + offset] = normal;
    }
  }

  return normals;
}

function toDtsMesh(mesh: ExportMesh): DtsMesh {
  if (mesh.indices.length >= 65536) {
    throw new Error(`Mesh has too many vertex indices for DTS v24 (${mesh.indices.length} >= 65536).`);
  }

  const bounds = computeBounds(mesh.vertices);
  const center = computeCenter(bounds.min, bounds.max);
  const radius = computeRadius(mesh.vertices, center);
  const normals = buildFaceNormals(mesh);
  const primitives: DtsPrimitive[] = mesh.faces.map((face) => ({
    firstElement: face.indexStart,
    numElements: face.indexCount,
    type: face.materialIndex | DTS_PRIMITIVE_INDEXED
  }));

  return {
    bounds,
    center,
    radius,
    numFrames: 1,
    numMatFrames: 1,
    parent: -1,
    type: DTS_MESH_TYPE_STANDARD,
    verts: mesh.vertices,
    tverts: mesh.uvs.map(([u, v]) => [u, 1 - v]),
    normals,
    enormals: mesh.vertices.map(() => 0),
    primitives,
    indices: mesh.indices,
    mindices: [],
    vertsPerFrame: mesh.vertices.length,
    flags: DTS_MESH_TYPE_STANDARD
  };
}

function encodeAsciiBytes(value: string): number[] {
  const bytes: number[] = [];

  for (let index = 0; index < value.length; index += 1) {
    bytes.push(value.charCodeAt(index) & 0xff);
  }

  return bytes;
}

function buildMaterialTable(objects: ExportObject[]): DtsMaterial[] {
  const names = new Set<string>();

  for (const object of objects) {
    for (const name of object.mesh.materialNames) {
      names.add(name);
    }
  }

  if (names.size === 0) {
    names.add('blank');
  }

  return Array.from(names).map((name) => ({
    name,
    flags: DTS_MATERIAL_S_WRAP | DTS_MATERIAL_T_WRAP | DTS_MATERIAL_NEVER_ENVMAP,
    reflectanceMap: -1,
    bumpMap: -1,
    detailMap: -1,
    detailScale: 1,
    reflectance: 0
  }));
}

function rewriteMaterialIndices(mesh: ExportMesh, materialIndexLookup: Map<string, number>): ExportMesh {
  return {
    ...mesh,
    materialNames: Array.from(materialIndexLookup.keys()),
    faces: mesh.faces.map((face) => ({
      ...face,
      materialIndex: materialIndexLookup.get(face.materialName) ?? 0
    }))
  };
}

function writeNode(writer: DtsBufferWriter, node: DtsNode): void {
  writer.writeInt32(node.nameIndex);
  writer.writeInt32(node.parentIndex);
  writer.writeInt32(node.firstObject);
  writer.writeInt32(node.firstChild);
  writer.writeInt32(node.nextSibling);
}

function writeObject(writer: DtsBufferWriter, object: DtsObject): void {
  writer.writeInt32(object.nameIndex);
  writer.writeInt32(object.numMeshes);
  writer.writeInt32(object.firstMesh);
  writer.writeInt32(object.nodeIndex);
  writer.writeInt32(object.nextSibling);
  writer.writeInt32(object.firstDecal);
}

function writeObjectState(writer: DtsBufferWriter, state: DtsObjectState): void {
  writer.writeFloat32(state.vis);
  writer.writeInt32(state.frame);
  writer.writeInt32(state.matFrame);
}

function writeDetailLevel(writer: DtsBufferWriter, detail: DtsDetailLevel): void {
  writer.writeInt32(detail.nameIndex);
  writer.writeInt32(detail.subshape);
  writer.writeInt32(detail.objectDetail);
  writer.writeFloat32(detail.size);
  writer.writeFloat32(detail.avgError);
  writer.writeFloat32(detail.maxError);
  writer.writeInt32(detail.polyCount);
}

function writeMesh(writer: DtsBufferWriter, mesh: DtsMesh): void {
  writer.writeInt32(mesh.type);
  writer.writeGuard();
  writer.writeInt32(mesh.numFrames);
  writer.writeInt32(mesh.numMatFrames);
  writer.writeInt32(mesh.parent);
  writer.writePoint3F(mesh.bounds.min);
  writer.writePoint3F(mesh.bounds.max);
  writer.writePoint3F(mesh.center);
  writer.writeFloat32(mesh.radius);

  writer.writeInt32(mesh.verts.length);
  for (const vertex of mesh.verts) {
    writer.writePoint3F(vertex);
  }

  writer.writeInt32(mesh.tverts.length);
  for (const uv of mesh.tverts) {
    writer.writePoint2F(uv);
  }

  for (const normal of mesh.normals) {
    writer.writePoint3F(normal);
  }

  for (const encodedNormal of mesh.enormals) {
    writer.writeUint8(encodedNormal);
  }

  writer.writeInt32(mesh.primitives.length);
  for (const primitive of mesh.primitives) {
    writer.writeInt16(primitive.firstElement);
    writer.writeInt16(primitive.numElements);
    writer.writeInt32(primitive.type);
  }

  writer.writeInt32(mesh.indices.length);
  for (const index of mesh.indices) {
    writer.writeInt16(index);
  }

  writer.writeInt32(mesh.mindices.length);
  for (const mergeIndex of mesh.mindices) {
    writer.writeInt16(mergeIndex);
  }

  writer.writeInt32(mesh.vertsPerFrame);
  writer.writeInt32(mesh.flags);
  writer.writeGuard();
}

function encodeHeader(target: number[], finalized: ReturnType<DtsBufferWriter['finalize']>): void {
  const header = new DataView(new ArrayBuffer(16));
  header.setInt16(0, DTS_VERSION, true);
  header.setInt16(2, DTS_EXPORTER_VERSION, true);
  header.setInt32(4, finalized.sizeAllDwords, true);
  header.setInt32(8, finalized.start16Dwords, true);
  header.setInt32(12, finalized.start8Dwords, true);
  target.push(...new Uint8Array(header.buffer));
}

function encodeSequenceBlock(target: number[]): void {
  const sequenceCount = new DataView(new ArrayBuffer(4));
  sequenceCount.setInt32(0, 0, true);
  target.push(...new Uint8Array(sequenceCount.buffer));
}

function encodeMaterialBlock(target: number[], materials: DtsMaterial[]): void {
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

export function writeDts(model: ExportModel): ArrayBuffer {
  const sourceObjects = model.shape.objects.filter((object) => object.mesh.vertices.length > 0);
  if (sourceObjects.length === 0) {
    throw new Error('DTS export requires at least one mesh object.');
  }

  const materials = buildMaterialTable(sourceObjects);
  const materialIndexLookup = new Map<string, number>();
  materials.forEach((material, index) => materialIndexLookup.set(material.name, index));

  const detailName = 'detail32';
  const rootNodeName = 'SceneRoot';
  const names = [detailName, rootNodeName];
  const nameIndexLookup = new Map<string, number>([
    [detailName, 0],
    [rootNodeName, 1]
  ]);

  const nameIndexFor = (value: string): number => {
    const existing = nameIndexLookup.get(value);
    if (existing !== undefined) {
      return existing;
    }

    const nextIndex = names.length;
    names.push(value);
    nameIndexLookup.set(value, nextIndex);
    return nextIndex;
  };

  const objects: DtsObject[] = [];
  const meshes: DtsMesh[] = [];

  for (const sourceObject of sourceObjects) {
    const mesh = rewriteMaterialIndices(sourceObject.mesh, materialIndexLookup);

    objects.push({
      nameIndex: nameIndexFor(sourceObject.name),
      numMeshes: 1,
      firstMesh: meshes.length,
      nodeIndex: 0,
      nextSibling: -1,
      firstDecal: -1
    });

    meshes.push(toDtsMesh(mesh));
  }

  for (const material of materials) {
    nameIndexFor(material.name);
  }

  const allVertices = sourceObjects.flatMap((object) => object.mesh.vertices);
  const shapeBounds = computeBounds(allVertices);
  const shapeCenter = computeCenter(shapeBounds.min, shapeBounds.max);
  const shapeRadius = computeRadius(allVertices, shapeCenter);
  const shapeTubeRadius = computeTubeRadius(allVertices, shapeCenter);
  const totalTriangles = sourceObjects.reduce((sum, object) => sum + object.mesh.indices.length / 3, 0);
  const node: DtsNode = {
    nameIndex: nameIndexFor(rootNodeName),
    parentIndex: -1,
    firstObject: -1,
    firstChild: -1,
    nextSibling: -1
  };
  const subshape: DtsSubshape = {
    firstNode: 0,
    firstObject: 0,
    firstDecal: 0,
    numNodes: 1,
    numObjects: objects.length,
    numDecals: 0
  };
  const detail: DtsDetailLevel = {
    nameIndex: nameIndexFor(detailName),
    subshape: 0,
    objectDetail: 0,
    size: 32,
    avgError: -1,
    maxError: -1,
    polyCount: totalTriangles
  };
  const objectStates: DtsObjectState[] = objects.map(() => ({
    vis: 1,
    frame: 0,
    matFrame: 0
  }));

  const writer = new DtsBufferWriter();

  writer.writeInt32(1);
  writer.writeInt32(objects.length);
  writer.writeInt32(0);
  writer.writeInt32(1);
  writer.writeInt32(0);
  writer.writeInt32(0);
  writer.writeInt32(0);
  writer.writeInt32(0);
  writer.writeInt32(0);
  writer.writeInt32(0);
  writer.writeInt32(0);
  writer.writeInt32(objectStates.length);
  writer.writeInt32(0);
  writer.writeInt32(0);
  writer.writeInt32(1);
  writer.writeInt32(meshes.length);
  writer.writeInt32(names.length);
  writer.writeFloat32(detail.size);
  writer.writeInt32(0);
  writer.writeGuard();

  writer.writeFloat32(shapeRadius);
  writer.writeFloat32(shapeTubeRadius);
  writer.writePoint3F(shapeCenter);
  writer.writePoint3F(shapeBounds.min);
  writer.writePoint3F(shapeBounds.max);
  writer.writeGuard();

  writeNode(writer, node);
  writer.writeGuard();

  for (const object of objects) {
    writeObject(writer, object);
  }
  writer.writeGuard();

  writer.writeGuard();
  writer.writeGuard();

  writer.writeInt32(subshape.firstNode);
  writer.writeInt32(subshape.firstObject);
  writer.writeInt32(subshape.firstDecal);
  writer.writeGuard();
  writer.writeInt32(subshape.numNodes);
  writer.writeInt32(subshape.numObjects);
  writer.writeInt32(subshape.numDecals);
  writer.writeGuard();

  writer.writeQuat16Identity();
  writer.writePoint3F([0, 0, 0]);
  writer.writeGuard();

  writer.writeGuard();
  writer.writeGuard();

  for (const state of objectStates) {
    writeObjectState(writer, state);
  }
  writer.writeGuard();

  writer.writeGuard();
  writer.writeGuard();

  writeDetailLevel(writer, detail);
  writer.writeGuard();

  for (const mesh of meshes) {
    writeMesh(writer, mesh);
  }
  writer.writeGuard();

  for (const name of names) {
    writer.writeNullTerminatedString(name);
  }
  writer.writeGuard();

  const finalized = writer.finalize();
  const output: number[] = [];

  encodeHeader(output, finalized);
  output.push(...finalized.buffer32);
  output.push(...finalized.buffer16);
  output.push(...finalized.buffer8);
  encodeSequenceBlock(output);
  encodeMaterialBlock(output, materials);

  return Uint8Array.from(output).buffer;
}
