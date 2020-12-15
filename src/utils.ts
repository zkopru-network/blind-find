/**
 * AsyncEvent allows set/wait in async code. WARNING: Not sure if it's safe between coroutines.
 */
export class AsyncEvent {
  private _isSet: boolean;
  private isWaited: boolean;
  private eventSetter?: (value?: any) => void;
  private eventWaiter: Promise<void>;

  constructor() {
    this.eventWaiter = new Promise<void>((res, _) => {
      this.eventSetter = res;
    });
    this._isSet = false;
    this.isWaited = false;
  }

  public get isSet() {
    return this._isSet;
  }

  set() {
    if (this._isSet) {
      return;
    }
    this._isSet = true;
    if (this.eventSetter === undefined) {
      throw new Error(
        "eventSetter is undefined, i.e. set is called before wait is called"
      );
    }
    this.eventSetter();
  }

  async wait() {
    if (this._isSet) {
      return;
    }
    if (this.isWaited) {
      throw new Error("waiting for a waited event");
    }
    this.isWaited = true;
    await this.eventWaiter;
  }
}
