type FaceTextureRef = string | false | Texture | undefined;
import type { ExportFace, ExportMesh, ExportModel, ExportObject, Vec2 } from '../dts/mesh';

export type ExportTextureAsset = {
  materialName: string;
  fileName: string;
  dataUrl: string;
};

type Rgba = [number, number, number, number];

const TEXTURE_BLEED_PASSES = 4;
const BLOCKLAND_TEXTURE_SIZE = 16;
const FULL_FACE_UVS: Vec2[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1]
];

const NAMED_COLOR_PALETTE: Array<{ name: string; color: Rgba }> = [
  { name: 'white', color: [255, 255, 255, 255] },
  { name: 'black', color: [0, 0, 0, 255] },
  { name: 'red', color: [255, 0, 0, 255] },
  { name: 'green', color: [0, 255, 0, 255] },
  { name: 'blue', color: [0, 0, 255, 255] },
  { name: 'yellow', color: [255, 255, 0, 255] },
  { name: 'cyan', color: [0, 255, 255, 255] },
  { name: 'magenta', color: [255, 0, 255, 255] },
  { name: 'orange', color: [255, 165, 0, 255] },
  { name: 'purple', color: [128, 0, 128, 255] },
  { name: 'pink', color: [255, 105, 180, 255] },
  { name: 'brown', color: [139, 69, 19, 255] },
  { name: 'gray', color: [128, 128, 128, 255] },
  { name: 'olive', color: [128, 128, 0, 255] },
  { name: 'lime', color: [50, 205, 50, 255] },
  { name: 'navy', color: [0, 0, 128, 255] }
];

function stripDuplicateSuffix(value: string): string {
  return value.split('#', 1)[0];
}

function stripExtension(value: string): string {
  const lastDot = value.lastIndexOf('.');
  if (lastDot <= 0) {
    return value;
  }

  return value.slice(0, lastDot);
}

export function sanitizeMaterialName(value: string): string {
  const stripped = stripExtension(stripDuplicateSuffix(value).trim());
  const sanitized = stripped.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');

  return sanitized || 'blank';
}

export function getTextureByReference(reference: FaceTextureRef): Texture | undefined {
  if (typeof reference === 'string') {
    return Texture.all.find((entry) => entry.uuid === reference);
  }

  if (reference instanceof Texture) {
    return reference;
  }

  return undefined;
}

export function getTextureMaterialName(texture: Texture): string {
  return sanitizeMaterialName(texture.name);
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function cloneImageData(source: Uint8ClampedArray): Uint8ClampedArray {
  const copy = new Uint8ClampedArray(source.length);
  copy.set(source);
  return copy;
}

function bleedTransparentPixels(imageData: ImageData, passes: number, context: CanvasRenderingContext2D): ImageData {
  let current = cloneImageData(imageData.data);
  const width = imageData.width;
  const height = imageData.height;

  for (let pass = 0; pass < passes; pass += 1) {
    const next = cloneImageData(current);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width + x) * 4;
        if (current[index + 3] !== 0) {
          continue;
        }

        let found = false;

        for (let offsetY = -1; offsetY <= 1 && !found; offsetY += 1) {
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            if (offsetX === 0 && offsetY === 0) {
              continue;
            }

            const sampleX = x + offsetX;
            const sampleY = y + offsetY;
            if (sampleX < 0 || sampleY < 0 || sampleX >= width || sampleY >= height) {
              continue;
            }

            const sampleIndex = (sampleY * width + sampleX) * 4;
            if (current[sampleIndex + 3] === 0) {
              continue;
            }

            next[index] = current[sampleIndex];
            next[index + 1] = current[sampleIndex + 1];
            next[index + 2] = current[sampleIndex + 2];
            next[index + 3] = current[sampleIndex + 3];
            found = true;
            break;
          }
        }
      }
    }

    current = next;
  }

  const output = context.createImageData(width, height);
  output.data.set(current);
  return output;
}

function getBleededTextureDataUrl(texture: Texture): string {
  const sourceCanvas = texture.canvas;
  const workingCanvas = createCanvas(sourceCanvas.width, sourceCanvas.height);
  const context = workingCanvas.getContext('2d');

  if (!context) {
    return texture.getDataURL();
  }

  context.drawImage(sourceCanvas, 0, 0);
  const sourceImageData = context.getImageData(0, 0, workingCanvas.width, workingCanvas.height);
  const bledImageData = bleedTransparentPixels(sourceImageData, TEXTURE_BLEED_PASSES, context);
  context.putImageData(bledImageData, 0, 0);

  return workingCanvas.toDataURL('image/png');
}

function colorDistance(a: Rgba, b: Rgba): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgbaToHex(color: Rgba): string {
  return color
    .slice(0, 3)
    .map((channel) => clampByte(channel).toString(16).padStart(2, '0'))
    .join('');
}

function getBlocklandColorName(color: Rgba): string {
  let best = NAMED_COLOR_PALETTE[0];
  let bestDistance = colorDistance(color, best.color);

  for (const candidate of NAMED_COLOR_PALETTE.slice(1)) {
    const distance = colorDistance(color, candidate.color);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best.name;
}

function createSolidTextureDataUrl(color: Rgba): string {
  const canvas = createCanvas(BLOCKLAND_TEXTURE_SIZE, BLOCKLAND_TEXTURE_SIZE);
  const context = canvas.getContext('2d');

  if (!context) {
    return '';
  }

  context.fillStyle = `rgba(${clampByte(color[0])}, ${clampByte(color[1])}, ${clampByte(color[2])}, ${Math.max(0, Math.min(1, color[3] / 255))})`;
  context.fillRect(0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/png');
}

function getCubeFaceByExportFace(exportFace: ExportFace): CubeFace | undefined {
  const cube = Cube.all.find((entry) => entry.uuid === exportFace.cubeId);
  if (!cube) {
    return undefined;
  }

  return cube.faces[exportFace.face];
}

function sampleFaceColor(face: CubeFace): Rgba {
  const texture = getTextureByReference(face.texture);
  if (!texture) {
    return [255, 255, 255, 255];
  }

  const canvas = texture.canvas;
  const context = canvas.getContext('2d');
  if (!context) {
    return [255, 255, 255, 255];
  }

  const [u0, v0, u1, v1] = face.uv ?? [0, 0, 1, 1];
  const minX = Math.max(0, Math.min(canvas.width - 1, Math.floor(Math.min(u0, u1))));
  const maxX = Math.max(minX + 1, Math.min(canvas.width, Math.ceil(Math.max(u0, u1))));
  const minY = Math.max(0, Math.min(canvas.height - 1, Math.floor(Math.min(v0, v1))));
  const maxY = Math.max(minY + 1, Math.min(canvas.height, Math.ceil(Math.max(v0, v1))));
  const image = context.getImageData(minX, minY, maxX - minX, maxY - minY).data;

  let red = 0;
  let green = 0;
  let blue = 0;
  let alpha = 0;
  let samples = 0;

  for (let index = 0; index < image.length; index += 4) {
    const pixelAlpha = image[index + 3];
    if (pixelAlpha === 0) {
      continue;
    }

    red += image[index];
    green += image[index + 1];
    blue += image[index + 2];
    alpha += pixelAlpha;
    samples += 1;
  }

  if (samples === 0) {
    return [255, 255, 255, 255];
  }

  return [
    clampByte(red / samples),
    clampByte(green / samples),
    clampByte(blue / samples),
    clampByte(alpha / samples)
  ];
}

function cloneMesh(mesh: ExportMesh): ExportMesh {
  return {
    vertices: mesh.vertices.map((vertex) => [...vertex] as typeof vertex),
    uvs: mesh.uvs.map((uv) => [...uv] as typeof uv),
    indices: [...mesh.indices],
    materialNames: [...mesh.materialNames],
    faces: mesh.faces.map((face) => ({ ...face }))
  };
}

function cloneObject(object: ExportObject): ExportObject {
  return {
    ...object,
    worldBounds: {
      min: [...object.worldBounds.min],
      max: [...object.worldBounds.max]
    },
    localTransform: {
      origin: [...object.localTransform.origin],
      rotation: [...object.localTransform.rotation]
    },
    mesh: cloneMesh(object.mesh)
  };
}

function rebuildMaterialTable(mesh: ExportMesh): void {
  const orderedNames: string[] = [];
  const nameToIndex = new Map<string, number>();

  for (const face of mesh.faces) {
    let materialIndex = nameToIndex.get(face.materialName);
    if (materialIndex === undefined) {
      materialIndex = orderedNames.length;
      orderedNames.push(face.materialName);
      nameToIndex.set(face.materialName, materialIndex);
    }
    face.materialIndex = materialIndex;
  }

  mesh.materialNames = orderedNames;
}

export function transformModelToBlocklandColors(model: ExportModel): {
  model: ExportModel;
  textures: ExportTextureAsset[];
} {
  const transformedObjects = model.shape.objects.map(cloneObject);
  const assets = new Map<string, ExportTextureAsset>();
  const colorToMaterialName = new Map<string, string>();
  const materialNameCounts = new Map<string, number>();

  for (const object of transformedObjects) {
    for (const exportFace of object.mesh.faces) {
      const cubeFace = getCubeFaceByExportFace(exportFace);
      const sampledColor: Rgba = cubeFace ? sampleFaceColor(cubeFace) : [255, 255, 255, 255];
      const colorKey = rgbaToHex(sampledColor);
      let materialName = colorToMaterialName.get(colorKey);

      if (!materialName) {
        const baseName = getBlocklandColorName(sampledColor);
        const nextCount = (materialNameCounts.get(baseName) ?? 0) + 1;
        materialNameCounts.set(baseName, nextCount);
        materialName = `${baseName}${nextCount}`;
        colorToMaterialName.set(colorKey, materialName);
      }

      exportFace.materialName = materialName;

      for (let offset = 0; offset < exportFace.vertexCount; offset += 1) {
        object.mesh.uvs[exportFace.vertexStart + offset] = [...FULL_FACE_UVS[offset]];
      }

      if (!assets.has(materialName)) {
        const assetColor: Rgba = [...sampledColor];
        assets.set(materialName, {
          materialName,
          fileName: `${materialName}.png`,
          dataUrl: createSolidTextureDataUrl(assetColor)
        });
      }
    }

    rebuildMaterialTable(object.mesh);
  }

  const transformedModel: ExportModel = {
    ...model,
    shape: {
      ...model.shape,
      objects: transformedObjects,
      names: Array.from(
        new Set([
          ...model.shape.nodes.map((node) => node.name),
          ...transformedObjects.map((object) => object.name),
          ...transformedObjects.flatMap((object) => object.mesh.materialNames)
        ])
      )
    },
    summary: {
      ...model.summary,
      materialCount: new Set(transformedObjects.flatMap((object) => object.mesh.materialNames)).size
    }
  };

  return {
    model: transformedModel,
    textures: Array.from(assets.values())
  };
}

export function getMaterialNameFromTextureReference(reference: FaceTextureRef): string {
  const texture = getTextureByReference(reference);
  if (texture) {
    return getTextureMaterialName(texture);
  }

  if (typeof reference === 'string') {
    return sanitizeMaterialName(reference);
  }

  return 'blank';
}

export function collectUsedTextureAssets(): ExportTextureAsset[] {
  const assets = new Map<string, ExportTextureAsset>();

  for (const cube of Cube.all) {
    for (const face of Object.values(cube.faces) as CubeFace[]) {
      if (!face || face.enabled === false) {
        continue;
      }

      const texture = getTextureByReference(face.texture);
      if (!texture) {
        continue;
      }

      const materialName = getTextureMaterialName(texture);
      if (assets.has(materialName)) {
        continue;
      }

      assets.set(materialName, {
        materialName,
        fileName: `${materialName}.png`,
        dataUrl: getBleededTextureDataUrl(texture)
      });
    }
  }

  return Array.from(assets.values());
}
