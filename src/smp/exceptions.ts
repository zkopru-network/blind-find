/**
 * Exceptions: to workaround for the issue that "isinstance is borken when class extends
 *  `Error` type, we need to override `constructor` to set prototype for each error.
 *  Ref
 *    - https://github.com/Microsoft/TypeScript/issues/13965
 *    - https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
 */

class BaseSMPError extends Error {
  constructor(m?: string) {
    super(m);
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, BaseSMPError.prototype);
  }
}

/**
 * Base error for `SMPState` related errors.
 */
class SMPStateError extends BaseSMPError {
  constructor(m?: string) {
    super(m);
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, SMPStateError.prototype);
  }
}
/**
 * Invalid group elements are received.
 */
class InvalidGroupElement extends SMPStateError {
  constructor(m?: string) {
    super(m);
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, InvalidGroupElement.prototype);
  }
}
class InvalidProof extends SMPStateError {
  constructor(m?: string) {
    super(m);
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, InvalidProof.prototype);
  }
}
class SMPNotFinished extends SMPStateError {
  constructor(m?: string) {
    super(m);
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, SMPNotFinished.prototype);
  }
}

class NotImplemented extends BaseSMPError {
  constructor(m?: string) {
    super(m);
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, NotImplemented.prototype);
  }
}

class ParsingError extends BaseSMPError {
  constructor(m?: string) {
    super(m);
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, ParsingError.prototype);
  }
}
class ValueError extends ParsingError {
  constructor(m?: string) {
    super(m);
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, ValueError.prototype);
  }
}

export {
  InvalidGroupElement,
  InvalidProof,
  NotImplemented,
  ValueError,
  SMPNotFinished,
  SMPStateError,
  BaseSMPError,
};
