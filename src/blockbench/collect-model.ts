import type {
  ExportFace,
  ExportMesh,
  ExportModel,
  ExportNode,
  ExportObject,
  ExportShape,
  Vec2,
  Vec3
} from '../dts/mesh';
import {
  getCubeFaceUv,
  getCubeWorldVertices,
  getMaterialName,
  getMeshFaceUv,
  getMeshFaceVertexKeys,
  getMeshWorldVertex,
  isExportableCubeFace,
  isExportableMeshFace
} from '../util/blockbench';
import { computeBounds, createEmptyMesh, toVec3 } from '../util/geometry';

type CubeFaceKey = 'north' | 'east' | 'south' | 'west' | 'up' | 'down';

const FACE_KEYS: CubeFaceKey[] = ['north', 'east', 'south', 'west', 'up', 'down'];
const ROOT_NODE_ID = '__root__';

function getNodeLocalTransform(node: Group): ExportNode['localTransform'] {
  return {
    origin: toVec3(node.origin),
    rotation: toVec3(node.rotation)
  };
}

function getElementLocalTransform(element: Cube | Mesh): ExportObject['localTransform'] {
  return {
    origin: toVec3(element.origin),
    rotation: toVec3(element.rotation)
  };
}

function triangulateFaceIndices(vertexStart: number, vertexCount: number): number[] {
  const indices: number[] = [];

  for (let offset = 1; offset < vertexCount - 1; offset += 1) {
    indices.push(vertexStart, vertexStart + offset, vertexStart + offset + 1);
  }

  return indices;
}

function appendFace(
  mesh: ExportMesh,
  source: {
    elementId: string;
    elementName: string;
    elementType: 'cube' | 'mesh';
    faceKey: string;
  },
  vertices: Vec3[],
  uvs: Vec2[],
  materialName: string
): void {
  if (vertices.length < 3 || vertices.length !== uvs.length) {
    return;
  }

  let materialIndex = mesh.materialNames.indexOf(materialName);

  if (materialIndex === -1) {
    materialIndex = mesh.materialNames.push(materialName) - 1;
  }

  const vertexStart = mesh.vertices.length;
  const indexStart = mesh.indices.length;

  mesh.vertices.push(...vertices);
  mesh.uvs.push(...uvs);
  mesh.indices.push(...triangulateFaceIndices(vertexStart, vertices.length));

  const exportFace: ExportFace = {
    ...source,
    materialIndex,
    materialName,
    vertexStart,
    vertexCount: vertices.length,
    indexStart,
    indexCount: mesh.indices.length - indexStart
  };

  mesh.faces.push(exportFace);
}

function appendCubeFace(
  mesh: ExportMesh,
  cube: Cube,
  faceKey: CubeFaceKey,
  face: CubeFace,
  cubeVertices: Vec3[]
): void {
  const faceVertexIndices = face.getVertexIndices();

  appendFace(
    mesh,
    {
      elementId: cube.uuid,
      elementName: cube.name,
      elementType: 'cube',
      faceKey
    },
    faceVertexIndices.map((vertexIndex) => cubeVertices[vertexIndex]),
    getCubeFaceUv(face),
    getMaterialName(face)
  );
}

function appendMeshFace(mesh: ExportMesh, sourceMesh: Mesh, face: MeshFace, faceKey: string): void {
  const vertexKeys = getMeshFaceVertexKeys(face).slice().reverse();

  appendFace(
    mesh,
    {
      elementId: sourceMesh.uuid,
      elementName: sourceMesh.name,
      elementType: 'mesh',
      faceKey
    },
    vertexKeys.map((vertexKey) => getMeshWorldVertex(sourceMesh, vertexKey)),
    getMeshFaceUv(face, vertexKeys),
    getMaterialName(face)
  );
}

function createObjectFromCube(cube: Cube, parentNodeId: string): ExportObject {
  const mesh = createEmptyMesh();
  const cubeVertices = getCubeWorldVertices(cube);

  for (const faceKey of FACE_KEYS) {
    const face = cube.faces[faceKey];
    if (!isExportableCubeFace(face)) {
      continue;
    }

    appendCubeFace(mesh, cube, faceKey, face, cubeVertices);
  }

  return {
    id: cube.uuid,
    name: cube.name,
    parentNodeId,
    localTransform: getElementLocalTransform(cube),
    worldBounds: computeBounds(mesh.vertices),
    mesh
  };
}

function createObjectFromMesh(sourceMesh: Mesh, parentNodeId: string): ExportObject {
  const mesh = createEmptyMesh();

  sourceMesh.forAllFaces((face, faceKey) => {
    if (!isExportableMeshFace(face)) {
      return;
    }

    appendMeshFace(mesh, sourceMesh, face, faceKey);
  });

  return {
    id: sourceMesh.uuid,
    name: sourceMesh.name,
    parentNodeId,
    localTransform: getElementLocalTransform(sourceMesh),
    worldBounds: computeBounds(mesh.vertices),
    mesh
  };
}

function appendExportObject(
  element: Cube | Mesh,
  parentNodeId: string,
  objects: ExportObject[],
  objectIds: string[]
): void {
  const object = element instanceof Cube
    ? createObjectFromCube(element, parentNodeId)
    : createObjectFromMesh(element, parentNodeId);

  if (object.mesh.vertices.length === 0) {
    return;
  }

  objects.push(object);
  objectIds.push(object.id);
}

function collectNodeRecursive(
  sourceNode: Group,
  parentId: string,
  nodes: ExportNode[],
  objects: ExportObject[]
): void {
  const exportNode: ExportNode = {
    id: sourceNode.uuid,
    name: sourceNode.name,
    parentId,
    childNodeIds: [],
    objectIds: [],
    localTransform: getNodeLocalTransform(sourceNode)
  };

  nodes.push(exportNode);

  for (const child of sourceNode.children) {
    if (child instanceof Group) {
      exportNode.childNodeIds.push(child.uuid);
      collectNodeRecursive(child, sourceNode.uuid, nodes, objects);
      continue;
    }

    if (child instanceof Cube || child instanceof Mesh) {
      appendExportObject(child, sourceNode.uuid, objects, exportNode.objectIds);
    }
  }
}

function collectRootLevelElements(rootNode: ExportNode, objects: ExportObject[]): void {
  for (const node of Outliner.root) {
    if (!(node instanceof Cube || node instanceof Mesh)) {
      continue;
    }

    appendExportObject(node, ROOT_NODE_ID, objects, rootNode.objectIds);
  }
}

function buildShape(): ExportShape {
  const nodes: ExportNode[] = [
    {
      id: ROOT_NODE_ID,
      name: 'SceneRoot',
      parentId: null,
      childNodeIds: [],
      objectIds: [],
      localTransform: {
        origin: [0, 0, 0],
        rotation: [0, 0, 0]
      }
    }
  ];
  const objects: ExportObject[] = [];
  const rootNode = nodes[0];

  for (const node of Outliner.root) {
    if (node instanceof Group) {
      rootNode.childNodeIds.push(node.uuid);
      collectNodeRecursive(node, ROOT_NODE_ID, nodes, objects);
    }
  }

  collectRootLevelElements(rootNode, objects);

  const names = Array.from(
    new Set([
      ...nodes.map((node) => node.name),
      ...objects.map((object) => object.name),
      ...objects.flatMap((object) => object.mesh.materialNames)
    ])
  );

  const allVertices = objects.flatMap((object) => object.mesh.vertices);

  return {
    nodes,
    objects,
    names,
    bounds: computeBounds(allVertices)
  };
}

export function collectModel(projectName: string): ExportModel {
  const shape = buildShape();
  const totalVertexCount = shape.objects.reduce((sum, object) => sum + object.mesh.vertices.length, 0);
  const totalIndexCount = shape.objects.reduce((sum, object) => sum + object.mesh.indices.length, 0);
  const materialNames = new Set(shape.objects.flatMap((object) => object.mesh.materialNames));

  return {
    project: projectName,
    shape,
    summary: {
      nodeCount: shape.nodes.length,
      objectCount: shape.objects.length,
      cubeCount: Cube.all.length,
      meshCount: Mesh.all.length,
      vertexCount: totalVertexCount,
      indexCount: totalIndexCount,
      triangleCount: totalIndexCount / 3,
      materialCount: materialNames.size
    }
  };
}
