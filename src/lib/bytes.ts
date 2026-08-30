/**
 * Copy any Uint8Array/Buffer into a fresh Uint8Array backed by a plain
 * ArrayBuffer. Works around the `Uint8Array<ArrayBufferLike>` vs
 * `Uint8Array<ArrayBuffer>` friction between @types/node's Buffer and both
 * Prisma's `Bytes` columns and the DOM `BodyInit` type.
 */
export function toBytes(input: Uint8Array) {
  const out = new Uint8Array(input.byteLength);
  out.set(input);
  return out; // inferred Uint8Array<ArrayBuffer>
}
