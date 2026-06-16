import { computeBounds, computeCenter } from '../model/transform';
import { DtsBufferWriter } from './buffers';
import type { ExportMesh, Vec3 } from '../model/types';
import {
  DTS_MESH_TYPE_NULL,
  DTS_MESH_TYPE_STANDARD,
  DTS_PRIMITIVE_INDEXED,
  type DtsMesh,
  type DtsPrimitive
} from './writer-types';

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

export function computeRadius(vertices: Vec3[], center: Vec3): number {
  let radius = 0;

  for (const vertex of vertices) {
    radius = Math.max(radius, length(subtract(vertex, center)));
  }

  return radius;
}

export function computeTubeRadius(vertices: Vec3[], center: Vec3): number {
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

export function toDtsMesh(mesh: ExportMesh): DtsMesh {
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

export function createNullMesh(): DtsMesh {
  return {
    bounds: {
      min: [0, 0, 0],
      max: [0, 0, 0]
    },
    center: [0, 0, 0],
    radius: 0,
    numFrames: 0,
    numMatFrames: 0,
    parent: -1,
    type: DTS_MESH_TYPE_NULL,
    verts: [],
    tverts: [],
    normals: [],
    enormals: [],
    primitives: [],
    indices: [],
    mindices: [],
    vertsPerFrame: 0,
    flags: DTS_MESH_TYPE_NULL
  };
}

export function writeMesh(writer: DtsBufferWriter, mesh: DtsMesh): void {
  writer.writeInt32(mesh.type);
  if (mesh.type === DTS_MESH_TYPE_NULL) {
    return;
  }

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
