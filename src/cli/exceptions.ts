import { BaseBlindFindError } from "../exceptions";

export class BaseBlindFindCLIError extends BaseBlindFindError {
  constructor(m?: string) {
    super(m);
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, BaseBlindFindCLIError.prototype);
  }
}

export class ConfigError extends BaseBlindFindCLIError {
  constructor(m?: string) {
    super(m);
    // Set the prototype explicitly.
    Object.setPrototypeOf(this, ConfigError.prototype);
  }
}
