import { DtsBufferWriter } from './buffers';
import type { ExportModel } from '../model/types';
import type { ExportConfig } from '../export/config';
import { computeBounds, computeCenter } from '../model/transform';
import { computeRadius, computeTubeRadius, createNullMesh, toDtsMesh, writeMesh } from './writer-mesh';
import { buildLodPlan } from './writer-lod';
import {
  buildMaterialTable,
  encodeHeader,
  encodeMaterialBlock,
  rewriteMaterialIndices,
  synthesizeBlocklandNodes,
  writeDetailLevel,
  writeNode,
  writeObject,
  writeObjectState,
  writeTrigger
} from './writer-encode';
import type {
  DtsDetailLevel,
  DtsMesh,
  DtsNode,
  DtsObject,
  DtsObjectState,
  DtsSequence,
  DtsSubshape,
  DtsTrigger
} from './writer-types';

const DTS_SEQUENCE_FLAG_ALIGNED_SCALE = 1 << 1;
const DTS_SEQUENCE_FLAG_CYCLIC = 1 << 4;
const DTS_TRIGGER_STATE_ON = 1 << 31;

function subtractVec3(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function toQuat16FromEulerDegrees(euler: [number, number, number]): [number, number, number, number] {
  const degToRad = Math.PI / 180;
  const x = euler[0] * degToRad * 0.5;
  const y = euler[1] * degToRad * 0.5;
  const z = euler[2] * degToRad * 0.5;
  const cx = Math.cos(x);
  const sx = Math.sin(x);
  const cy = Math.cos(y);
  const sy = Math.sin(y);
  const cz = Math.cos(z);
  const sz = Math.sin(z);

  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz
  ];
}

function writeBitSetBytes(target: number[], values: boolean[]): void {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  const words = Math.ceil(values.length / 32);
  view.setInt32(0, 0, true);
  view.setInt32(4, words, true);
  target.push(...new Uint8Array(buffer));

  for (let wordIndex = 0; wordIndex < words; wordIndex += 1) {
    let word = 0;
    for (let bit = 0; bit < 32; bit += 1) {
      const valueIndex = wordIndex * 32 + bit;
      if (values[valueIndex]) {
        word |= (1 << bit);
      }
    }
    const wordBuffer = new ArrayBuffer(4);
    new DataView(wordBuffer).setInt32(0, word, true);
    target.push(...new Uint8Array(wordBuffer));
  }
}

function writeSequenceBlock(target: number[], sequences: DtsSequence[]): void {
  const countField = new DataView(new ArrayBuffer(4));
  countField.setInt32(0, sequences.length, true);
  target.push(...new Uint8Array(countField.buffer));

  for (const sequence of sequences) {
    const header = new ArrayBuffer(60);
    const view = new DataView(header);
    view.setInt32(0, sequence.nameIndex, true);
    view.setUint32(4, sequence.flags >>> 0, true);
    view.setInt32(8, sequence.numKeyframes, true);
    view.setFloat32(12, sequence.duration, true);
    view.setInt32(16, sequence.priority, true);
    view.setInt32(20, sequence.firstGroundFrame, true);
    view.setInt32(24, sequence.numGroundFrames, true);
    view.setInt32(28, sequence.baseRotation, true);
    view.setInt32(32, sequence.baseTranslation, true);
    view.setInt32(36, sequence.baseScale, true);
    view.setInt32(40, sequence.baseObjectState, true);
    view.setInt32(44, sequence.baseDecalState, true);
    view.setInt32(48, sequence.firstTrigger, true);
    view.setInt32(52, sequence.numTriggers, true);
    view.setFloat32(56, sequence.toolBegin, true);
    target.push(...new Uint8Array(header));

    writeBitSetBytes(target, sequence.rotationMatters);
    writeBitSetBytes(target, sequence.translationMatters);
    writeBitSetBytes(target, sequence.scaleMatters);
    writeBitSetBytes(target, sequence.decalMatters);
    writeBitSetBytes(target, sequence.iflMatters);
    writeBitSetBytes(target, sequence.visMatters);
    writeBitSetBytes(target, sequence.frameMatters);
    writeBitSetBytes(target, sequence.matFrameMatters);
  }
}

function remapObjectMeshToNodeOrigin(mesh: DtsMesh, origin: [number, number, number]): DtsMesh {
  if (origin[0] === 0 && origin[1] === 0 && origin[2] === 0) {
    return mesh;
  }

  const verts = mesh.verts.map((vertex) => subtractVec3(vertex, origin));
  const bounds = computeBounds(verts);
  const center = computeCenter(bounds.min, bounds.max);
  const radius = computeRadius(verts, center);

  return {
    ...mesh,
    verts,
    bounds,
    center,
    radius
  };
}

function interpolateTrackValue(
  times: number[],
  values: [number, number, number][],
  sampleTime: number
): [number, number, number] {
  if (times.length === 0 || values.length === 0) {
    return [0, 0, 0];
  }

  if (sampleTime <= times[0]) {
    return values[0];
  }

  const lastIndex = times.length - 1;
  if (sampleTime >= times[lastIndex]) {
    return values[lastIndex];
  }

  for (let index = 0; index < lastIndex; index += 1) {
    const start = times[index];
    const end = times[index + 1];
    if (sampleTime < start || sampleTime > end) {
      continue;
    }

    const alpha = end === start ? 0 : (sampleTime - start) / (end - start);
    const from = values[index];
    const to = values[index + 1];
    return [
      from[0] + (to[0] - from[0]) * alpha,
      from[1] + (to[1] - from[1]) * alpha,
      from[2] + (to[2] - from[2]) * alpha
    ];
  }

  return values[lastIndex];
}

export function writeDts(model: ExportModel, config: ExportConfig): ArrayBuffer {
  const lodPlan = buildLodPlan(model);
  const renderModel = lodPlan.renderModel;
  const sourceObjects = lodPlan.renderObjects;
  if (sourceObjects.length === 0) {
    throw new Error('DTS export requires at least one mesh object.');
  }
  const sourceNodes = synthesizeBlocklandNodes(renderModel, sourceObjects);

  const materials = buildMaterialTable(lodPlan.materialObjects, config);
  const materialIndexLookup = new Map<string, number>();
  materials.forEach((material, index) => materialIndexLookup.set(material.name, index));
  const names = Array.from(new Set(lodPlan.detailLevels.map((detailLevel) => detailLevel.name)));

  if (names.length === 0) {
    names.push('detail32');
  }
  const nameIndexLookup = new Map<string, number>(names.map((name, index) => [name, index]));

  const nameIndexFor = (value: string): number => {
    const existing = nameIndexLookup.get(value);
    if (existing !== undefined) {
      return existing;
    }

    const nextIndex = names.length;
    names.push(value);
    nameIndexLookup.set(value, nextIndex);
    return nextIndex;
  };

  const nodeIndexLookup = new Map<string, number>();
  sourceNodes.forEach((node, index) => nodeIndexLookup.set(node.id, index));
  const sourceNodeById = new Map(sourceNodes.map((node) => [node.id, node]));
  const sourceNodeByName = new Map(sourceNodes.map((node) => [node.name, node]));
  const objectToNodeId = new Map<string, string>();
  for (const node of sourceNodes) {
    for (const objectId of node.objectIds) {
      objectToNodeId.set(objectId, node.id);
    }
  }

  const objects: DtsObject[] = [];
  const meshes: DtsMesh[] = [];
  const objectStates: DtsObjectState[] = [];
  const detailLevels: DtsDetailLevel[] = [];
  const nodeAlignedScales: [number, number, number][] = [];
  const triggers: DtsTrigger[] = [];
  const detailTriangleCounts = lodPlan.detailLevels.map((detailLevel) => {
    let total = 0;
    for (const object of detailLevel.variantsByBaseName.values()) {
      total += object.mesh.indices.length / 3;
    }
    return total;
  });
  const normalizeObjectName = (name: string): string => {
    const hashIndex = name.indexOf('#');
    return hashIndex === -1 ? name : name.slice(0, hashIndex);
  };

  for (const sourceObject of sourceObjects) {
    const normalizedObjectName = normalizeObjectName(sourceObject.name);
    const assignedNodeId = objectToNodeId.get(sourceObject.id) ?? '__render__';
    const assignedNode = sourceNodeById.get(assignedNodeId);
    const nodeIndex = nodeIndexLookup.get(assignedNodeId) ?? 0;
    const variantObjects = lodPlan.detailLevels.map((detailLevel) => (
      detailLevel.variantsByBaseName.get(normalizedObjectName) ?? null
    ));
    const lastPresentMeshIndex = variantObjects.reduce((lastIndex, variantObject, detailIndex) => (
      variantObject ? detailIndex : lastIndex
    ), -1);
    const firstMesh = meshes.length;

    for (let detailIndex = 0; detailIndex <= lastPresentMeshIndex; detailIndex += 1) {
      const variantObject = variantObjects[detailIndex];
      if (!variantObject) {
        meshes.push(createNullMesh());
        continue;
      }

      const variantMesh = rewriteMaterialIndices(variantObject.mesh, materialIndexLookup);
      meshes.push(remapObjectMeshToNodeOrigin(
        toDtsMesh(variantMesh),
        assignedNode?.localTransform.origin ?? [0, 0, 0]
      ));
    }

    objects.push({
      nameIndex: nameIndexFor(normalizedObjectName),
      numMeshes: Math.max(lastPresentMeshIndex + 1, 0),
      firstMesh,
      nodeIndex,
      nextSibling: -1,
      firstDecal: -1
    });
    objectStates.push({
      vis: 1,
      frame: 0,
      matFrame: 0
    });
  }

  for (const material of materials) {
    nameIndexFor(material.name);
  }

  const objectIndexLookup = new Map<string, number>();
  sourceObjects.forEach((object, index) => objectIndexLookup.set(object.id, index));

  const nodes: DtsNode[] = sourceNodes.map((node) => {
    const childIndices = sourceNodes
      .filter((candidate) => candidate.parentId === node.id)
      .map((candidate) => nodeIndexLookup.get(candidate.id))
      .filter((value): value is number => value !== undefined);
    const objectIndices = node.objectIds
      .map((objectId) => objectIndexLookup.get(objectId))
      .filter((value): value is number => value !== undefined);

    return {
      nameIndex: nameIndexFor(node.name),
      parentIndex: node.parentId ? (nodeIndexLookup.get(node.parentId) ?? -1) : -1,
      firstObject: objectIndices[0] ?? -1,
      firstChild: childIndices[0] ?? -1,
      nextSibling: -1
    };
  });

  sourceNodes.forEach((node) => {
    const childIndices = sourceNodes
      .filter((candidate) => candidate.parentId === node.id)
      .map((candidate) => nodeIndexLookup.get(candidate.id))
      .filter((value): value is number => value !== undefined);

    for (let index = 0; index < childIndices.length; index += 1) {
      const currentIndex = childIndices[index];
      nodes[currentIndex].nextSibling = childIndices[index + 1] ?? -1;
    }

    const objectIndices = node.objectIds
      .map((objectId) => objectIndexLookup.get(objectId))
      .filter((value): value is number => value !== undefined);

    for (let index = 0; index < objectIndices.length; index += 1) {
      const currentIndex = objectIndices[index];
      objects[currentIndex].nextSibling = objectIndices[index + 1] ?? -1;
    }
  });

  const allVertices = sourceObjects.flatMap((object) => object.mesh.vertices);
  const shapeBounds = computeBounds(allVertices);
  const shapeCenter = computeCenter(shapeBounds.min, shapeBounds.max);
  const shapeRadius = computeRadius(allVertices, shapeCenter);
  const shapeTubeRadius = computeTubeRadius(allVertices, shapeCenter);
  const subshape: DtsSubshape = {
    firstNode: 0,
    firstObject: 0,
    firstDecal: 0,
    numNodes: nodes.length,
    numObjects: objects.length,
    numDecals: 0
  };
  for (const [index, detailLevel] of lodPlan.detailLevels.entries()) {
    detailLevels.push({
      nameIndex: nameIndexFor(detailLevel.name),
      subshape: 0,
      objectDetail: index,
      size: detailLevel.size,
      avgError: -1,
      maxError: -1,
      polyCount: detailTriangleCounts[index]
    });
  }
  const nodeTranslations: [number, number, number][] = [];
  const nodeRotations: [number, number, number, number][] = [];
  const sequences: DtsSequence[] = [];

  for (const sequence of renderModel.sequences) {
    const sampleTimes = Array.from(
      new Set(sequence.tracks.flatMap((track) => track.keyframeTimes))
    ).sort((a, b) => a - b);
    if (sampleTimes.length === 0) {
      continue;
    }

    const rotationMatters = sourceNodes.map(() => false);
    const translationMatters = sourceNodes.map(() => false);
    const scaleMatters = sourceNodes.map(() => false);
    const baseRotation = nodeRotations.length;
    const baseTranslation = nodeTranslations.length;
    const baseScale = nodeAlignedScales.length;
    const firstTrigger = triggers.length;
    const orderedTracks = sequence.tracks
      .map((track) => {
        const sourceNode = sourceNodeByName.get(track.targetName);
        return {
          track,
          sourceNode,
          nodeIndex: sourceNode ? (nodeIndexLookup.get(sourceNode.id) ?? -1) : -1
        };
      })
      .filter((entry) => entry.nodeIndex !== -1)
      .sort((a, b) => a.nodeIndex - b.nodeIndex || a.track.channel.localeCompare(b.track.channel));

    for (const { track, sourceNode, nodeIndex } of orderedTracks) {

      if (track.channel === 'rotation') {
        rotationMatters[nodeIndex] = true;
        for (const sampleTime of sampleTimes) {
          const value = interpolateTrackValue(track.keyframeTimes, track.keyframeValues, sampleTime);
          nodeRotations.push(toQuat16FromEulerDegrees(value));
        }
      } else if (track.channel === 'position') {
        translationMatters[nodeIndex] = true;
        for (const sampleTime of sampleTimes) {
          const value = interpolateTrackValue(track.keyframeTimes, track.keyframeValues, sampleTime);
          nodeTranslations.push([
            value[0] + (sourceNode?.localTransform.origin[0] ?? 0),
            value[1] + (sourceNode?.localTransform.origin[1] ?? 0),
            value[2] + (sourceNode?.localTransform.origin[2] ?? 0)
          ]);
        }
      } else if (track.channel === 'scale') {
        scaleMatters[nodeIndex] = true;
        for (const sampleTime of sampleTimes) {
          nodeAlignedScales.push(interpolateTrackValue(track.keyframeTimes, track.keyframeValues, sampleTime));
        }
      }
    }

    const duration = sequence.length > 0 ? sequence.length : sampleTimes[sampleTimes.length - 1];
    const sortedMarkers = sequence.markers.slice().sort((a, b) => a.time - b.time);

    for (const marker of sortedMarkers) {
      triggers.push({
        state: DTS_TRIGGER_STATE_ON,
        pos: duration > 0 ? marker.time / duration : 0
      });
    }

    sequences.push({
      nameIndex: nameIndexFor(sequence.name),
      flags: DTS_SEQUENCE_FLAG_ALIGNED_SCALE | (sequence.loop === 'loop' ? DTS_SEQUENCE_FLAG_CYCLIC : 0),
      numKeyframes: sampleTimes.length,
      duration: sequence.length,
      priority: 1,
      firstGroundFrame: 0,
      numGroundFrames: 0,
      baseRotation,
      baseTranslation,
      baseScale,
      baseObjectState: objectStates.length,
      baseDecalState: 0,
      firstTrigger,
      numTriggers: sortedMarkers.length,
      toolBegin: sampleTimes[0],
      rotationMatters,
      translationMatters,
      scaleMatters,
      decalMatters: sourceNodes.map(() => false),
      iflMatters: sourceNodes.map(() => false),
      visMatters: sourceNodes.map(() => false),
      frameMatters: sourceNodes.map(() => false),
      matFrameMatters: sourceNodes.map(() => false)
    });
  }

  const writer = new DtsBufferWriter();

  writer.writeInt32(nodes.length);
  writer.writeInt32(objects.length);
  writer.writeInt32(0);
  writer.writeInt32(1);
  writer.writeInt32(0);
  writer.writeInt32(nodeRotations.length);
  writer.writeInt32(nodeTranslations.length);
  writer.writeInt32(0);
  writer.writeInt32(nodeAlignedScales.length);
  writer.writeInt32(0);
  writer.writeInt32(0);
  writer.writeInt32(objectStates.length);
  writer.writeInt32(0);
  writer.writeInt32(triggers.length);
  writer.writeInt32(detailLevels.length);
  writer.writeInt32(meshes.length);
  writer.writeInt32(names.length);
  writer.writeFloat32(detailLevels[detailLevels.length - 1]?.size ?? 1);
  writer.writeInt32(Math.max(detailLevels.length - 1, 0));
  writer.writeGuard();

  writer.writeFloat32(shapeRadius);
  writer.writeFloat32(shapeTubeRadius);
  writer.writePoint3F(shapeCenter);
  writer.writePoint3F(shapeBounds.min);
  writer.writePoint3F(shapeBounds.max);
  writer.writeGuard();

  for (const node of nodes) {
    writeNode(writer, node);
  }
  writer.writeGuard();

  for (const object of objects) {
    writeObject(writer, object);
  }
  writer.writeGuard();

  writer.writeGuard();
  writer.writeGuard();

  writer.writeInt32(subshape.firstNode);
  writer.writeInt32(subshape.firstObject);
  writer.writeInt32(subshape.firstDecal);
  writer.writeGuard();
  writer.writeInt32(subshape.numNodes);
  writer.writeInt32(subshape.numObjects);
  writer.writeInt32(subshape.numDecals);
  writer.writeGuard();

  for (const node of sourceNodes) {
    writer.writeQuat16Identity();
    writer.writePoint3F(node.localTransform.origin);
  }
  for (const translation of nodeTranslations) {
    writer.writePoint3F(translation);
  }
  for (const rotation of nodeRotations) {
    writer.writeQuat16(rotation);
  }
  writer.writeGuard();

  for (const scale of nodeAlignedScales) {
    writer.writePoint3F(scale);
  }
  writer.writeGuard();
  writer.writeGuard();

  for (const state of objectStates) {
    writeObjectState(writer, state);
  }
  writer.writeGuard();

  for (const trigger of triggers) {
    writeTrigger(writer, trigger);
  }
  writer.writeGuard();

  for (const detail of detailLevels) {
    writeDetailLevel(writer, detail);
  }
  writer.writeGuard();

  for (const mesh of meshes) {
    writeMesh(writer, mesh);
  }
  writer.writeGuard();

  for (const name of names) {
    writer.writeNullTerminatedString(name);
  }
  writer.writeGuard();

  const finalized = writer.finalize();
  const output: number[] = [];

  encodeHeader(output, finalized, config.dtsVersion);
  output.push(...finalized.buffer32);
  output.push(...finalized.buffer16);
  output.push(...finalized.buffer8);
  writeSequenceBlock(output, sequences);
  encodeMaterialBlock(output, materials, config.dtsVersion);

  return Uint8Array.from(output).buffer;
}
