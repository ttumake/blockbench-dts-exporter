import type {
  ExportFace,
  ExportMesh,
  ExportModel,
  ExportNode,
  ExportObject,
  ExportShape,
  Vec3
} from '../dts/mesh';
import {
  getCubeWorldVertices,
  getFaceUv,
  getMaterialName,
  isExportableFace
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

function getCubeLocalTransform(cube: Cube): ExportObject['localTransform'] {
  return {
    origin: toVec3(cube.origin),
    rotation: toVec3(cube.rotation)
  };
}

function appendFace(
  mesh: ExportMesh,
  cube: Cube,
  faceName: CubeFaceKey,
  face: CubeFace,
  cubeVertices: Vec3[]
): void {
  const faceVertexIndices = face.getVertexIndices();
  const materialName = getMaterialName(face);
  let materialIndex = mesh.materialNames.indexOf(materialName);

  if (materialIndex === -1) {
    materialIndex = mesh.materialNames.push(materialName) - 1;
  }

  const vertexStart = mesh.vertices.length;
  const indexStart = mesh.indices.length;
  const uvs = getFaceUv(face);

  for (const vertexIndex of faceVertexIndices) {
    mesh.vertices.push(cubeVertices[vertexIndex]);
  }

  mesh.uvs.push(...uvs);
  mesh.indices.push(
    vertexStart,
    vertexStart + 1,
    vertexStart + 2,
    vertexStart,
    vertexStart + 2,
    vertexStart + 3
  );

  const exportFace: ExportFace = {
    cubeName: cube.name,
    face: faceName,
    materialIndex,
    materialName,
    vertexStart,
    vertexCount: 4,
    indexStart,
    indexCount: 6
  };

  mesh.faces.push(exportFace);
}

function createObjectFromCube(cube: Cube, parentNodeId: string): ExportObject {
  const mesh = createEmptyMesh();
  const cubeVertices = getCubeWorldVertices(cube);

  for (const faceName of FACE_KEYS) {
    const face = cube.faces[faceName];
    if (!isExportableFace(face)) {
      continue;
    }

    appendFace(mesh, cube, faceName, face, cubeVertices);
  }

  return {
    id: cube.uuid,
    name: cube.name,
    parentNodeId,
    localTransform: getCubeLocalTransform(cube),
    worldBounds: computeBounds(mesh.vertices),
    mesh
  };
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

    if (child instanceof Cube) {
      const object = createObjectFromCube(child, sourceNode.uuid);
      objects.push(object);
      exportNode.objectIds.push(object.id);
    }
  }
}

function collectRootLevelCubes(rootNode: ExportNode, objects: ExportObject[]): void {
  for (const node of Outliner.root) {
    if (!(node instanceof Cube)) {
      continue;
    }

    const object = createObjectFromCube(node, ROOT_NODE_ID);
    objects.push(object);
    rootNode.objectIds.push(object.id);
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

  collectRootLevelCubes(rootNode, objects);

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
      vertexCount: totalVertexCount,
      indexCount: totalIndexCount,
      triangleCount: totalIndexCount / 3,
      materialCount: materialNames.size
    }
  };
}
