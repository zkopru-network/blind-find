import AwaitLock from "await-lock";

import { IAtomicDB, TLevelDBOp } from "./interfaces";
import { ValueError } from "./exceptions";
import { stringifyBigInts, unstringifyBigInts } from "maci-crypto";
const level = require("level");

export class MemoryDB implements IAtomicDB {
  map: Map<string, any>;

  constructor() {
    this.map = new Map<string, any>();
  }

  async get(key: string) {
    return this.map.get(key);
  }

  async set(key: string, data: any) {
    this.map.set(key, data);
  }

  async batch(ops: Array<TLevelDBOp>) {
    for (const op of ops) {
      if (op.type === "put") {
        this.map.set(op.key, op.value);
      } else {
        this.map.delete(op.key);
      }
    }
  }

  async close() {}
}

export class LevelDB implements IAtomicDB {
  db: any;
  lock: AwaitLock;

  constructor(path: string) {
    this.db = level(path, { valueEncoding: "json" });
    this.lock = new AwaitLock();
  }

  async get(key: string) {
    await this.lock.acquireAsync();
    try {
      return await this.db.get(key);
    } catch (e) {
      // https://github.com/Level/level#dbgetkey-options-callback
      if (e.type === "NotFoundError") {
        return undefined;
      } else {
        throw e;
      }
    } finally {
      this.lock.release();
    }
  }

  async set(key: string, data: any) {
    await this.lock.acquireAsync();
    try {
      await this.db.put(key, data);
    } finally {
      this.lock.release();
    }
  }

  async batch(ops: Array<TLevelDBOp>) {
    await this.lock.acquireAsync();
    try {
      await this.db.batch(ops);
    } finally {
      this.lock.release();
    }
  }

  async close() {
    await this.db.close();
  }
}

interface IDBArray<T> {
  get(index: number): Promise<T>;
  append(data: T): Promise<void>;
  set(index: number, data: T): Promise<void>;
}

interface IDBMap<T> extends AsyncIterable<T> {
  getLength(): Promise<number>;
  get(key: string): Promise<T | undefined>;
  set(key: string, data: T): Promise<void>;
}

export class DBObjectArray<T extends object> implements IDBArray<T> {
  lock: AwaitLock;

  constructor(readonly prefix: string, readonly db: IAtomicDB) {
    this.lock = new AwaitLock();
  }

  private getLengthKey() {
    return `${this.prefix}-length`;
  }

  private getIndexKey(index: number) {
    return `${this.prefix}-data-${index}`;
  }

  private encodeBigInts(rawObj: T): object {
    return stringifyBigInts(rawObj);
  }

  private decodeBigInts(encodedObj: object): T {
    return unstringifyBigInts(encodedObj);
  }

  private async _getLength(): Promise<number> {
    const key = this.getLengthKey();
    const length = await this.db.get(key);
    if (length === undefined) {
      // Store length if it's not found.
      await this.db.set(key, 0);
      return 0;
    } else {
      return length;
    }
  }

  async getLength(): Promise<number> {
    await this.lock.acquireAsync();
    try {
      return await this._getLength();
    } finally {
      this.lock.release();
    }
  }

  async get(index: number): Promise<T> {
    await this.lock.acquireAsync();
    try {
      const length = await this._getLength();
      if (index >= length) {
        throw new ValueError(
          `index out of range: index=${index}, length=${length}`
        );
      }
      const key = this.getIndexKey(index);
      const data = this.decodeBigInts(await this.db.get(key));
      if (data === undefined) {
        throw new Error("index is in the range but data is not found");
      }
      return data;
    } finally {
      this.lock.release();
    }
  }

  async append(data: T): Promise<void> {
    await this.lock.acquireAsync();
    try {
      const length = await this._getLength();
      const key = this.getIndexKey(length);
      const encodedData = this.encodeBigInts(data);
      // Atomically execute the following operations.
      await this.db.batch([
        { type: "put", key: key, value: encodedData }, // Append data
        { type: "put", key: this.getLengthKey(), value: length + 1 } // Update length
      ]);
    } finally {
      this.lock.release();
    }
  }

  async set(index: number, data: T): Promise<void> {
    await this.lock.acquireAsync();
    try {
      const length = await this._getLength();
      const key = this.getIndexKey(index);
      const encodedData = this.encodeBigInts(data);
      if (index >= length) {
        throw new ValueError(
          `index out of range: index=${index}, length=${length}`
        );
      }
      await this.db.set(key, encodedData);
    } finally {
      this.lock.release();
    }
  }
}

export class DBMap<T extends object> implements IDBMap<T> {
  lock: AwaitLock;
  constructor(readonly prefix: string, readonly db: IAtomicDB) {
    this.lock = new AwaitLock();
  }

  private getLengthKey() {
    return `${this.prefix}-keys-length`;
  }

  private getIndexKey(index: number) {
    return `${this.prefix}-keys-${index}`;
  }

  private getMapKey(key: string) {
    return `${this.prefix}-values-${key}`;
  }

  private encodeBigInts(rawObj: T): object {
    return stringifyBigInts(rawObj);
  }

  private decodeBigInts(encodedObj: object): T {
    return unstringifyBigInts(encodedObj);
  }

  private async _getLength(): Promise<number> {
    const key = this.getLengthKey();
    const length = await this.db.get(key);
    if (length === undefined) {
      // Store length if it's not found.
      await this.db.set(key, 0);
      return 0;
    } else {
      return length;
    }
  }

  async getLength(): Promise<number> {
    await this.lock.acquireAsync();
    try {
      return await this._getLength();
    } finally {
      this.lock.release();
    }
  }

  // Return directly.
  async get(key: string): Promise<T> {
    await this.lock.acquireAsync();
    try {
      return this.decodeBigInts(await this.db.get(this.getMapKey(key)));
    } finally {
      this.lock.release();
    }
  }

  async getAtIndex(index: number): Promise<T> {
    await this.lock.acquireAsync();
    try {
        const length = await this._getLength();
        if (index >= length) {
            throw new ValueError(
              `index out of range: index=${index}, length=${length}`
            );
        }
        return (await this._getAtIndex(index));
    } finally {
        this.lock.release();
    }
  }

  async* [Symbol.asyncIterator]() {
    await this.lock.acquireAsync();
    try {
        const length = await this._getLength();
        for (let i = 0; i < length; i++) {
            yield (await this._getAtIndex(i));
        }
    } finally {
        this.lock.release();
    }
  }

  async set(key: string, data: T): Promise<void> {
    await this.lock.acquireAsync();
    try {
      const mapKey = this.getMapKey(key);
      const encodedData = this.encodeBigInts(data);
      const savedData = await this.db.get(mapKey);
      // If the key exists, just update data.
      if (savedData !== undefined) {
        await this.db.set(mapKey, encodedData);
      } else {
        // Else, append the key to key list, update the length of key list,
        //    and set data to the key in map.
        // Atomically, execute the following operations.
        //  - 1. Append mapKey to list.
        //  - 2. Set data to key.
        const keysLength = await this._getLength();
        await this.db.batch([
            { type: "put", key: this.getIndexKey(keysLength), value: mapKey }, // Append key to keys
            { type: "put", key: this.getLengthKey(), value: keysLength + 1 }, // Update keys length
            { type: "put", key: mapKey, value: encodedData } // Set data to the corresponding key
        ]);
      }
    } finally {
      this.lock.release();
    }
  }

  private async _getAtIndex(index: number): Promise<T> {
    const mapKey = await this.db.get(this.getIndexKey(index));
    return this.decodeBigInts(await this.db.get(mapKey));
  }

}
