import type { Vec2, Vec3 } from '../model/types';
import { toVec3 } from '../model/transform';
import { getMaterialNameFromTextureReference, getTextureByReference } from './materials';

type FaceTextureRef = string | false | Texture | undefined;

function getTextureSize(reference: FaceTextureRef): { width: number; height: number } {
  const texture = getTextureByReference(reference);

  return {
    width: texture?.width ?? Project?.texture_width ?? 16,
    height: texture?.height ?? Project?.texture_height ?? 16
  };
}

export function normalizeUv(uv: [number, number], reference: FaceTextureRef): Vec2 {
  const size = getTextureSize(reference);
  return [uv[0] / size.width, uv[1] / size.height];
}

export function getCubeFaceUv(face: CubeFace): Vec2[] {
  const uv = face.uv ?? [0, 0, 0, 0];
  const [u0, v0, u1, v1] = uv;

  return [
    normalizeUv([u0, v0], face.texture),
    normalizeUv([u1, v0], face.texture),
    normalizeUv([u1, v1], face.texture),
    normalizeUv([u0, v1], face.texture)
  ];
}

export function getMeshFaceVertexKeys(face: MeshFace): string[] {
  return face.vertices.slice();
}

export function getMeshFaceUv(face: MeshFace, vertexKeys: string[]): Vec2[] {
  return vertexKeys.map((vertexKey) => {
    const uv = face.uv[vertexKey] ?? [0, 0];
    const [u, v] = normalizeUv([uv[0], uv[1]], face.texture);
    // Mesh UVs from imported geometry already behave like bottom-left-origin data.
    // DTS export flips V later for all tverts, so cancel that here for meshes.
    return [u, 1 - v];
  });
}

export function getMaterialName(face: CubeFace | MeshFace): string {
  return getMaterialNameFromTextureReference(face.texture);
}

export function isExportableCubeFace(face: CubeFace | undefined): face is CubeFace {
  return Boolean(face && face.enabled !== false);
}

export function isExportableMeshFace(face: MeshFace | undefined): face is MeshFace {
  return Boolean(face && face.vertices.length >= 3 && face.texture !== false);
}

export function getCubeWorldVertices(cube: Cube): Vec3[] {
  return cube.getGlobalVertexPositions().map((vertex) => toVec3(vertex));
}

export function getMeshWorldVertex(mesh: Mesh, vertexKey: string): Vec3 {
  return toVec3(Vertexsnap.getGlobalVertexPos(mesh, vertexKey).toArray());
}
