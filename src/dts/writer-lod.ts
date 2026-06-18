import type { ExportModel, ExportNode, ExportObject } from '../model/types';

const DETAIL_GROUP_RE = /^detail(-?\d+)$/i;

export type DtsLodLevelSource = {
  name: string;
  size: number;
  variantsByBaseName: Map<string, ExportObject>;
};

export type DtsLodPlan = {
  isLodExport: boolean;
  renderModel: ExportModel;
  renderObjects: ExportObject[];
  materialObjects: ExportObject[];
  detailLevels: DtsLodLevelSource[];
};

function parseDetailSize(name: string): number | null {
  const match = DETAIL_GROUP_RE.exec(name);
  if (!match) {
    return null;
  }

  const size = Number.parseInt(match[1], 10);
  return Number.isFinite(size) ? size : null;
}

function normalizeObjectName(name: string): string {
  const hashIndex = name.indexOf('#');
  return hashIndex === -1 ? name : name.slice(0, hashIndex);
}

function buildNodeMaps(nodes: ExportNode[]): {
  nodeById: Map<string, ExportNode>;
  childIdsByParentId: Map<string | null, string[]>;
} {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const childIdsByParentId = new Map<string | null, string[]>();

  for (const node of nodes) {
    const childIds = childIdsByParentId.get(node.parentId) ?? [];
    childIds.push(node.id);
    childIdsByParentId.set(node.parentId, childIds);
  }

  return { nodeById, childIdsByParentId };
}

function collectDescendantNodeIds(
  rootNodeId: string,
  childIdsByParentId: Map<string | null, string[]>
): Set<string> {
  const result = new Set<string>();
  const queue = [rootNodeId];

  while (queue.length > 0) {
    const nodeId = queue.shift() as string;
    if (result.has(nodeId)) {
      continue;
    }

    result.add(nodeId);
    for (const childId of childIdsByParentId.get(nodeId) ?? []) {
      queue.push(childId);
    }
  }

  return result;
}

function createFilteredRenderModel(
  model: ExportModel,
  includedNodeIds: Set<string>,
  includedObjectIds: Set<string>,
  reparentNodeIds: Set<string>,
  replacementParentId: string | null
): ExportModel {
  const nodes = model.shape.nodes
    .filter((node) => includedNodeIds.has(node.id))
    .map((node) => {
      const parentId = reparentNodeIds.has(node.id)
        ? replacementParentId
        : node.parentId;

      return {
        ...node,
        parentId,
        childNodeIds: [],
        objectIds: node.objectIds.filter((objectId) => includedObjectIds.has(objectId))
      };
    });
  const childNodeIdsByParentId = new Map<string | null, string[]>();

  for (const node of nodes) {
    const childIds = childNodeIdsByParentId.get(node.parentId) ?? [];
    childIds.push(node.id);
    childNodeIdsByParentId.set(node.parentId, childIds);
  }

  const nodesWithChildren = nodes.map((node) => ({
    ...node,
    childNodeIds: childNodeIdsByParentId.get(node.id) ?? []
  }));

  const objects = model.shape.objects
    .filter((object) => includedObjectIds.has(object.id))
    .map((object) => ({
      ...object,
      name: normalizeObjectName(object.name),
      parentNodeId: includedNodeIds.has(object.parentNodeId)
        ? object.parentNodeId
        : (replacementParentId ?? object.parentNodeId)
    }));
  const objectIdsByParentNodeId = new Map<string, string[]>();

  for (const object of objects) {
    const objectIds = objectIdsByParentNodeId.get(object.parentNodeId) ?? [];
    objectIds.push(object.id);
    objectIdsByParentNodeId.set(object.parentNodeId, objectIds);
  }

  const finalizedNodes = nodesWithChildren.map((node) => ({
    ...node,
    objectIds: objectIdsByParentNodeId.get(node.id) ?? []
  }));

  return {
    ...model,
    shape: {
      ...model.shape,
      nodes: finalizedNodes,
      objects
    }
  };
}

export function buildLodPlan(model: ExportModel): DtsLodPlan {
  const { nodeById, childIdsByParentId } = buildNodeMaps(model.shape.nodes);
  const rootNodeId = model.shape.nodes.find((node) => node.parentId === null)?.id ?? '__root__';
  const rootChildren = childIdsByParentId.get(rootNodeId) ?? [];

  const detailGroups = rootChildren
    .map((nodeId) => nodeById.get(nodeId))
    .filter((node): node is ExportNode => node !== undefined)
    .flatMap((node) => {
      const directSize = parseDetailSize(node.name);
      if (directSize !== null) {
        return [{ node, size: directSize }];
      }

      const childIds = childIdsByParentId.get(node.id) ?? [];
      return childIds
        .map((childId) => nodeById.get(childId))
        .filter((child): child is ExportNode => child !== undefined)
        .flatMap((child) => {
          const nestedSize = parseDetailSize(child.name);
          if (nestedSize === null) {
            return [];
          }

          return [{ node: child, size: nestedSize }];
        });
    })
    .sort((a, b) => b.size - a.size);

  if (detailGroups.length === 0) {
    return {
      isLodExport: false,
      renderModel: model,
      renderObjects: model.shape.objects.filter((object) => object.mesh.vertices.length > 0),
      materialObjects: model.shape.objects.filter((object) => object.mesh.vertices.length > 0),
      detailLevels: [
        {
          name: 'detail1',
          size: 1,
          variantsByBaseName: new Map(
            model.shape.objects
              .filter((object) => object.mesh.vertices.length > 0)
              .map((object) => [normalizeObjectName(object.name), object])
          )
        }
      ]
    };
  }

  const detailNodeIds = new Set(detailGroups.map(({ node }) => node.id));
  const detailSubtreeNodeIds = detailGroups.map(({ node }) => collectDescendantNodeIds(node.id, childIdsByParentId));
  const detailObjectSets = detailSubtreeNodeIds.map((nodeIds) => {
    const objectIds = new Set<string>();
    for (const nodeId of nodeIds) {
      const node = nodeById.get(nodeId);
      if (!node) {
        continue;
      }
      for (const objectId of node.objectIds) {
        objectIds.add(objectId);
      }
    }
    return objectIds;
  });

  const allDetailObjectIds = new Set<string>();
  for (const objectIds of detailObjectSets) {
    for (const objectId of objectIds) {
      allDetailObjectIds.add(objectId);
    }
  }

  const detailLevels = detailGroups.map(({ node, size }, index) => {
    const objectsById = detailObjectSets[index];
    const variantsByBaseName = new Map<string, ExportObject>();

    for (const object of model.shape.objects) {
      if (!objectsById.has(object.id) || object.mesh.vertices.length === 0) {
        continue;
      }
      variantsByBaseName.set(normalizeObjectName(object.name), object);
    }

    return {
      name: node.name,
      size,
      variantsByBaseName
    };
  });

  const representativeGroup = detailGroups[0].node;
  const representativeNodeIds = detailSubtreeNodeIds[0];
  const representativeObjectIds = detailObjectSets[0];
  const sharedNodeIds = new Set<string>();

  for (const node of model.shape.nodes) {
    if (representativeNodeIds.has(node.id) || detailNodeIds.has(node.id)) {
      continue;
    }

    let insideAnyOtherDetail = false;
    for (let index = 1; index < detailSubtreeNodeIds.length; index += 1) {
      if (detailSubtreeNodeIds[index].has(node.id)) {
        insideAnyOtherDetail = true;
        break;
      }
    }

    if (!insideAnyOtherDetail) {
      sharedNodeIds.add(node.id);
    }
  }

  const includedNodeIds = new Set<string>([rootNodeId]);
  for (const nodeId of representativeNodeIds) {
    if (nodeId !== representativeGroup.id) {
      includedNodeIds.add(nodeId);
    }
  }
  for (const nodeId of sharedNodeIds) {
    includedNodeIds.add(nodeId);
  }

  const includedObjectIds = new Set<string>(representativeObjectIds);
  const reparentNodeIds = new Set<string>();
  const replacementParentId = representativeGroup.parentId ?? rootNodeId;

  for (const childId of childIdsByParentId.get(representativeGroup.id) ?? []) {
    reparentNodeIds.add(childId);
  }

  const renderModel = createFilteredRenderModel(
    model,
    includedNodeIds,
    includedObjectIds,
    reparentNodeIds,
    replacementParentId
  );
  const renderObjects = renderModel.shape.objects.filter((object) => object.mesh.vertices.length > 0);
  const materialObjects = model.shape.objects.filter(
    (object) => allDetailObjectIds.has(object.id) && object.mesh.vertices.length > 0
  );

  return {
    isLodExport: true,
    renderModel,
    renderObjects,
    materialObjects,
    detailLevels
  };
}
