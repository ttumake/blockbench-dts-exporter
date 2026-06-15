import type { Vec2, Vec3 } from './mesh';

type FinalizedBuffers = {
  buffer32: Uint8Array;
  buffer16: Uint8Array;
  buffer8: Uint8Array;
  sizeAllDwords: number;
  start16Dwords: number;
  start8Dwords: number;
};

function pushUint16LE(target: number[], value: number): void {
  target.push(value & 0xff, (value >>> 8) & 0xff);
}

function pushUint32LE(target: number[], value: number): void {
  target.push(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff
  );
}

function pushFloat32LE(target: number[], value: number): void {
  const bytes = new Uint8Array(new Float32Array([value]).buffer);
  target.push(bytes[0], bytes[1], bytes[2], bytes[3]);
}

function alignBytes(target: number[], alignment: number): void {
  while (target.length % alignment !== 0) {
    target.push(0);
  }
}

export class DtsBufferWriter {
  private readonly bytes32: number[] = [];
  private readonly bytes16: number[] = [];
  private readonly bytes8: number[] = [];
  private guardValue = 0;

  writeInt32(value: number): void {
    pushUint32LE(this.bytes32, value >>> 0);
  }

  writeUint32(value: number): void {
    pushUint32LE(this.bytes32, value >>> 0);
  }

  writeFloat32(value: number): void {
    pushFloat32LE(this.bytes32, value);
  }

  writeInt16(value: number): void {
    pushUint16LE(this.bytes16, value & 0xffff);
  }

  writeUint8(value: number): void {
    this.bytes8.push(value & 0xff);
  }

  writePoint3F(value: Vec3): void {
    this.writeFloat32(value[0]);
    this.writeFloat32(value[1]);
    this.writeFloat32(value[2]);
  }

  writePoint2F(value: Vec2): void {
    this.writeFloat32(value[0]);
    this.writeFloat32(value[1]);
  }

  writeQuat16Identity(): void {
    this.writeInt16(0);
    this.writeInt16(0);
    this.writeInt16(0);
    this.writeInt16(0);
  }

  writeGuard(): void {
    this.writeInt32(this.guardValue);
    this.writeInt16(this.guardValue);
    this.writeUint8(this.guardValue);
    this.guardValue += 1;
  }

  writeNullTerminatedString(value: string): void {
    const encoded = new TextEncoder().encode(value);
    for (const byte of encoded) {
      this.writeUint8(byte);
    }
    this.writeUint8(0);
  }

  finalize(): FinalizedBuffers {
    alignBytes(this.bytes16, 4);
    alignBytes(this.bytes8, 4);

    const buffer32 = Uint8Array.from(this.bytes32);
    const buffer16 = Uint8Array.from(this.bytes16);
    const buffer8 = Uint8Array.from(this.bytes8);
    const size32Dwords = buffer32.byteLength / 4;
    const size16Dwords = buffer16.byteLength / 4;
    const size8Dwords = buffer8.byteLength / 4;

    return {
      buffer32,
      buffer16,
      buffer8,
      sizeAllDwords: size32Dwords + size16Dwords + size8Dwords,
      start16Dwords: size32Dwords,
      start8Dwords: size32Dwords + size16Dwords
    };
  }
}
