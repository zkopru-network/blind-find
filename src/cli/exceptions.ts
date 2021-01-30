import { BaseBlindFindError } from "../exceptions";

export class BaseBlindFindCLIError extends BaseBlindFindError {
  constructor(m?: string) {
    super(m);
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, BaseBlindFindCLIError.prototype);
  }
}

export class UnsupportedNetwork extends BaseBlindFindCLIError {
  constructor(m?: string) {
    super(m);
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, UnsupportedNetwork.prototype);
  }
}

export class NoUserConfigs extends BaseBlindFindCLIError {
  constructor(m?: string) {
    super(m);
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, NoUserConfigs.prototype);
  }
}

export class IncompleteConfig extends BaseBlindFindCLIError {
  constructor(m?: string) {
    super(m);
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, IncompleteConfig.prototype);
  }
}
