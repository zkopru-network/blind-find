/**
 * Concatenate two `Uint8Array` into one.
 */
export function concatUint8Array(a: Uint8Array, b: Uint8Array): Uint8Array {
  let c = new Uint8Array(a.length + b.length);
  c.set(a);
  c.set(b, a.length);
  return c;
}
