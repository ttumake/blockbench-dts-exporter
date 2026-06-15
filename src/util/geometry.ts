import type { ExportMesh, Vec3 } from '../dts/mesh';

/**
 * Defines a type for a 3D vector represented as an array of three numbers (x, y, z).
 * 
 * @param vector
 * @returns A Vec3 object containing the x, y, and z components of the input vector.
 */
export function toVec3(vector: ArrayVector3): Vec3 {
  return [vector[0], vector[1], vector[2]];
}

/**
 * Creates an empty mesh with no vertices, uvs, indices, material names, or faces.
 * 
 * @returns An empty ExportMesh object.
 */
export function createEmptyMesh(): ExportMesh {
  return {
    vertices: [],
    uvs: [],
    indices: [],
    materialNames: [],
    faces: []
  };
}

/**
 * Computes the axis-aligned bounding box (AABB) for a given array of vertices. 
 * The AABB is defined by its minimum and maximum corners, which are returned as Vec3 objects.
 * 
 * @param vertices 
 * @returns An object containing the minimum and maximum corners of the bounding box, each represented as a Vec3.
 */
export function computeBounds(vertices: Vec3[]): { min: Vec3; max: Vec3 } {
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
