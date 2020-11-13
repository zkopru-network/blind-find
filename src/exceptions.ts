/**
 * Exceptions: to workaround for the issue that "isinstance is borken when class extends
 *  `Error` type, we need to override `constructor` to set prototype for each error.
 *  Ref
 *    - https://github.com/Microsoft/TypeScript/issues/13965
 *    - https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
 */

export class BaseBlindFind extends Error {
  constructor(m?: string) {
    super(m);
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, BaseBlindFind.prototype);
  }
}

export class ValueError extends BaseBlindFind {
  constructor(m?: string) {
    super(m);
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, ValueError.prototype);
  }
}