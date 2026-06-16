import type { ExportMesh, ExportModel, ExportNode, ExportObject, ExportSequence, ExportSequenceTrack, Vec3 } from '../dts/mesh';
import type { ExportOrientation } from '../export/config';

/**
 * Defines a type for a 3D vector represented as an array of three numbers (x, y, z).
 * 
 * @param vector
 * @returns A Vec3 object containing the x, y, and z components of the input vector.
 */
export function toVec3(vector: ArrayVector3): Vec3 {
  return [vector[0], vector[1], vector[2]];
}

export function transformVec3(vec: Vec3, orientation: ExportOrientation): Vec3 {
  switch (orientation) {
    case 'blockland_swap_yz_flip_xz':
      return [vec[0], -vec[2], vec[1]];
    case 'none':
    default:
      return [...vec];
  }
}

export function scaleVec3(vec: Vec3, scale: number): Vec3 {
  return [vec[0] * scale, vec[1] * scale, vec[2] * scale];
}

function triangulateFaceIndices(vertexStart: number, vertexCount: number): number[] {
  const indices: number[] = [];

  for (let offset = 1; offset < vertexCount - 1; offset += 1) {
    indices.push(vertexStart, vertexStart + offset, vertexStart + offset + 1);
  }

  return indices;
}

function orientationFlipsWinding(orientation: ExportOrientation): boolean {
  return false;
}

function flipMeshWinding(mesh: ExportMesh): ExportMesh {
  const vertices = mesh.vertices.slice();
  const uvs = mesh.uvs.slice();
  const indices: number[] = [];
  const faces = mesh.faces.map((face) => {
    const faceVertices = vertices.slice(face.vertexStart, face.vertexStart + face.vertexCount).reverse();
    const faceUvs = uvs.slice(face.vertexStart, face.vertexStart + face.vertexCount).reverse();

    for (let offset = 0; offset < face.vertexCount; offset += 1) {
      vertices[face.vertexStart + offset] = faceVertices[offset];
      uvs[face.vertexStart + offset] = faceUvs[offset];
    }

    const indexStart = indices.length;
    indices.push(...triangulateFaceIndices(face.vertexStart, face.vertexCount));

    return {
      ...face,
      indexStart,
      indexCount: indices.length - indexStart
    };
  });

  return {
    ...mesh,
    vertices,
    uvs,
    indices,
    faces
  };
}

function transformObject(object: ExportObject, orientation: ExportOrientation): ExportObject {
  const transformedMesh = orientationFlipsWinding(orientation)
    ? flipMeshWinding(object.mesh)
    : object.mesh;
  const vertices = transformedMesh.vertices.map((vertex) => transformVec3(vertex, orientation));

  return {
    ...object,
    worldBounds: computeBounds(vertices),
    mesh: {
      ...transformedMesh,
      vertices
    }
  };
}

function transformNode(node: ExportNode, orientation: ExportOrientation): ExportNode {
  return {
    ...node,
    localTransform: {
      ...node.localTransform,
      origin: transformVec3(node.localTransform.origin, orientation),
      rotation: [...node.localTransform.rotation]
    }
  };
}

function transformSequenceTrack(track: ExportSequenceTrack, orientation: ExportOrientation): ExportSequenceTrack {
  if (track.channel !== 'position') {
    return track;
  }

  return {
    ...track,
    keyframeValues: track.keyframeValues.map((value) => transformVec3(value, orientation))
  };
}

function transformSequence(sequence: ExportSequence, orientation: ExportOrientation): ExportSequence {
  return {
    ...sequence,
    tracks: sequence.tracks.map((track) => transformSequenceTrack(track, orientation))
  };
}

export function transformModelOrientation(model: ExportModel, orientation: ExportOrientation): ExportModel {
  if (orientation === 'none') {
    return model;
  }

  const objects = model.shape.objects.map((object) => transformObject(object, orientation));
  const allVertices = objects.flatMap((object) => object.mesh.vertices);

  return {
    ...model,
    shape: {
      ...model.shape,
      nodes: model.shape.nodes.map((node) => transformNode(node, orientation)),
      objects,
      bounds: computeBounds(allVertices)
    },
    sequences: model.sequences.map((sequence) => transformSequence(sequence, orientation))
  };
}

function scaleObject(object: ExportObject, scale: number): ExportObject {
  const vertices = object.mesh.vertices.map((vertex) => scaleVec3(vertex, scale));

  return {
    ...object,
    localTransform: {
      ...object.localTransform,
      origin: scaleVec3(object.localTransform.origin, scale)
    },
    worldBounds: computeBounds(vertices),
    mesh: {
      ...object.mesh,
      vertices
    }
  };
}

function scaleNode(node: ExportNode, scale: number): ExportNode {
  return {
    ...node,
    localTransform: {
      ...node.localTransform,
      origin: scaleVec3(node.localTransform.origin, scale)
    }
  };
}

function scaleSequenceTrack(track: ExportSequenceTrack, scale: number): ExportSequenceTrack {
  if (track.channel !== 'position') {
    return track;
  }

  return {
    ...track,
    keyframeValues: track.keyframeValues.map((value) => scaleVec3(value, scale))
  };
}

function scaleSequence(sequence: ExportSequence, scale: number): ExportSequence {
  return {
    ...sequence,
    tracks: sequence.tracks.map((track) => scaleSequenceTrack(track, scale))
  };
}

export function transformModelScale(model: ExportModel, scale: number): ExportModel {
  if (scale === 1) {
    return model;
  }

  const objects = model.shape.objects.map((object) => scaleObject(object, scale));
  const allVertices = objects.flatMap((object) => object.mesh.vertices);

  return {
    ...model,
    shape: {
      ...model.shape,
      nodes: model.shape.nodes.map((node) => scaleNode(node, scale)),
      objects,
      bounds: computeBounds(allVertices)
    },
    sequences: model.sequences.map((sequence) => scaleSequence(sequence, scale))
  };
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

export function computeCenter(min: Vec3, max: Vec3): Vec3 {
  return [
    (min[0] + max[0]) * 0.5,
    (min[1] + max[1]) * 0.5,
    (min[2] + max[2]) * 0.5
  ];
}
