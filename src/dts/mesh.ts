export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export type ExportTransform = {
  origin: Vec3;
  rotation: Vec3;
};

export type ExportFace = {
  elementId: string;
  elementName: string;
  elementType: 'cube' | 'mesh';
  faceKey: string;
  materialIndex: number;
  materialName: string;
  vertexStart: number;
  vertexCount: number;
  indexStart: number;
  indexCount: number;
};

export type ExportMesh = {
  vertices: Vec3[];
  uvs: Vec2[];
  indices: number[];
  materialNames: string[];
  faces: ExportFace[];
};

export type ExportNode = {
  id: string;
  name: string;
  parentId: string | null;
  childNodeIds: string[];
  objectIds: string[];
  localTransform: ExportTransform;
};

export type ExportObject = {
  id: string;
  name: string;
  parentNodeId: string;
  localTransform: ExportTransform;
  worldBounds: {
    min: Vec3;
    max: Vec3;
  };
  mesh: ExportMesh;
};

export type ExportShape = {
  nodes: ExportNode[];
  objects: ExportObject[];
  names: string[];
  bounds: {
    min: Vec3;
    max: Vec3;
  };
};

export type ExportModel = {
  project: string;
  shape: ExportShape;
  summary: {
    nodeCount: number;
    objectCount: number;
    cubeCount: number;
    meshCount: number;
    vertexCount: number;
    indexCount: number;
    triangleCount: number;
    materialCount: number;
  };
};
