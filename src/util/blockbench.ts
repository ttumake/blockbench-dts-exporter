import type { Vec2, Vec3 } from '../dts/mesh';
import { toVec3 } from './geometry';

/**
 * Retrieves the UV coordinates for a given cube face. 
 * If the face has UV coordinates defined, it returns them as an array of Vec2 objects representing the four corners of the face. 
 * If the face does not have UV coordinates defined, it defaults to returning UVs that cover the entire texture (0,0 to 1,1).
 * 
 * @param face 
 * @returns An array of Vec2 objects representing the UV coordinates for the corners of the face.
 */
export function getFaceUv(face: CubeFace): Vec2[] {
  const uv = face.uv ?? [0, 0, 0, 0];
  const [u0, v0, u1, v1] = uv;

  return [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1]
  ];
}

/**
 * Retrieves the material name associated with a given cube face. 
 * If the face has a texture defined as a string, it looks up the texture in the global Texture registry to find its name. 
 * If the texture is not found, it returns the texture string itself. 
 * If the face does not have a texture or if the texture is not a string, it returns 'untextured'.
 * 
 * @param face 
 * @returns The name of the material associated with the face, or 'untextured' if no texture is defined.
 */
export function getMaterialName(face: CubeFace): string {
  if (typeof face.texture === 'string') {
    const texture = Texture.all.find((entry) => entry.uuid === face.texture);
    return texture?.name ?? face.texture;
  }

  return 'untextured';
}

/**
 * Determines whether a given cube face is exportable based on its enabled state.
 * 
 * @param face 
 * @returns True if the face is defined and its enabled property is not explicitly set to false; otherwise, false.
 */
export function isExportableFace(face: CubeFace | undefined): face is CubeFace {
  return Boolean(face && face.enabled !== false);
}

/**
 * Retrieves the world vertex positions of a given cube and converts them to Vec3 format.
 * 
 * @param cube 
 * @returns An array of Vec3 objects representing the world vertex positions of the cube.
 */
export function getCubeWorldVertices(cube: Cube): Vec3[] {
  return cube.getGlobalVertexPositions().map((vertex) => toVec3(vertex));
}
