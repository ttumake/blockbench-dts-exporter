import type { Vec3 } from '../model/types';

export const DTS_EXPORTER_VERSION = 0;
export const DTS_MESH_TYPE_STANDARD = 0;
export const DTS_MESH_TYPE_NULL = 4;
export const DTS_PRIMITIVE_INDEXED = 0x20000000;
export const DTS_MATERIAL_S_WRAP = 0x00000001;
export const DTS_MATERIAL_T_WRAP = 0x00000002;
export const DTS_MATERIAL_SELF_ILLUMINATING = 0x00000020;
export const DTS_MATERIAL_NEVER_ENVMAP = 0x00000040;
export const DTS_MATERIAL_NO_MIP_MAP = 0x00000080;
export const DTS_MATERIAL_MIP_MAP_ZERO_BORDER = 0x00000100;

export type DtsNode = {
  nameIndex: number;
  parentIndex: number;
  firstObject: number;
  firstChild: number;
  nextSibling: number;
};

export type DtsObject = {
  nameIndex: number;
  numMeshes: number;
  firstMesh: number;
  nodeIndex: number;
  nextSibling: number;
  firstDecal: number;
};

export type DtsSubshape = {
  firstNode: number;
  firstObject: number;
  firstDecal: number;
  numNodes: number;
  numObjects: number;
  numDecals: number;
};

export type DtsDetailLevel = {
  nameIndex: number;
  subshape: number;
  objectDetail: number;
  size: number;
  avgError: number;
  maxError: number;
  polyCount: number;
};

export type DtsObjectState = {
  vis: number;
  frame: number;
  matFrame: number;
};

export type DtsTrigger = {
  state: number;
  pos: number;
};

export type DtsPrimitive = {
  firstElement: number;
  numElements: number;
  type: number;
};

export type DtsMaterial = {
  name: string;
  flags: number;
  reflectanceMap: number;
  bumpMap: number;
  detailMap: number;
  detailScale: number;
  reflectance: number;
};

export type DtsMesh = {
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

export type BlocklandNodeSource = {
  id: string;
  name: string;
  parentId: string | null;
  objectIds: string[];
  localTransform: {
    origin: Vec3;
  };
};

export type DtsSequence = {
  nameIndex: number;
  flags: number;
  numKeyframes: number;
  duration: number;
  priority: number;
  firstGroundFrame: number;
  numGroundFrames: number;
  baseRotation: number;
  baseTranslation: number;
  baseScale: number;
  baseObjectState: number;
  baseDecalState: number;
  firstTrigger: number;
  numTriggers: number;
  toolBegin: number;
  rotationMatters: boolean[];
  translationMatters: boolean[];
  scaleMatters: boolean[];
  decalMatters: boolean[];
  iflMatters: boolean[];
  visMatters: boolean[];
  frameMatters: boolean[];
  matFrameMatters: boolean[];
};
