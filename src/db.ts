import AwaitLock from "await-lock";

import { IAtomicDB, TCreateReadStreamOptions, TLevelDBOp } from "./interfaces";
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

  async createReadStream(options: TCreateReadStreamOptions): Promise<AsyncIterable<any>> {
    const m = this.map;
    const keys = m.keys();
    return {
      async *[Symbol.asyncIterator]() {
        for (const key of keys) {
          const value = m.get(key);
          if (value === undefined) {
            throw new Error('should never happen');
          }
          if (options.gt !== undefined && options.gt < key) {
            yield { key, value };
          }
          if (options.gte !== undefined && options.gte <= key) {
            yield { key, value };
          }
          if (options.lt !== undefined && key < options.lt) {
            yield { key, value };
          }
          if (options.lte !== undefined && key <= options.lte) {
            yield { key, value };
          }
        }
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

  async createReadStream(options: TCreateReadStreamOptions): Promise<AsyncIterable<any>> {
    await this.lock.acquireAsync();
    try {
      return await this.db.createReadStream(options);
    } finally {
      this.lock.release();
    }
  }

  async close() {
    await this.db.close();
  }
}

type TKeyValue<T> = {
  key: string;
  value: T;
};

export interface IDBMap<T extends object> extends AsyncIterable<TKeyValue<T>> {
  getLength(): Promise<number>;
  get(key: string): Promise<T | undefined>;
  set(key: string, data: T): Promise<void>;
}

export class DBMap<T extends object> implements IDBMap<T> {
  lock: AwaitLock;
  constructor(readonly prefix: string, readonly db: IAtomicDB) {
    this.lock = new AwaitLock();
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
  async get(key: string): Promise<T | undefined> {
    await this.lock.acquireAsync();
    try {
      const data = await this.db.get(this.getDataKey(key));
      if (data === undefined) {
        return undefined;
      } else {
        return this.decodeBigInts(data);
      }
    } finally {
      this.lock.release();
    }
  }

  async *[Symbol.asyncIterator]() {
    await this.lock.acquireAsync();
    try {
      const readStream = await this.db.createReadStream({
        gt: this.getDataKeyPrefix(),
      });
      for await (const kv of readStream) {
        // Skip the length key.
        if (kv.key === this.getLengthKey()) {
          continue;
        }
        yield { key: this.mapDataKeyToKey(kv.key), value: this.decodeBigInts(kv.value) };
      }
    } finally {
      this.lock.release();
    }
  }

  async set(key: string, data: T): Promise<void> {
    await this.lock.acquireAsync();
    try {
      const dataKey = this.getDataKey(key);
      const encodedData = this.encodeBigInts(data);
      const savedData = await this.db.get(dataKey);
      // If the key exists, just update data.
      if (savedData !== undefined) {
        await this.db.set(dataKey, encodedData);
      } else {
        // Else, append the key to key list, update the length of key list,
        //    and set data to the key in map.
        // Atomically, execute the following operations.
        //  - 1. Append mapKey to list.
        //  - 2. Set data to key.
        const keysLength = await this._getLength();
        await this.db.batch([
          { type: "put", key: this.getLengthKey(), value: keysLength + 1 }, // Update length
          { type: "put", key: dataKey, value: encodedData } // Set data to the corresponding key
        ]);
      }
    } finally {
      this.lock.release();
    }
  }

  async del(key: string): Promise<void> {
    await this.lock.acquireAsync();
    try {
      const dataKey = this.getDataKey(key);
      const savedData = await this.db.get(dataKey);
      // Only delete data if the key exists.
      if (savedData !== undefined) {
        // Else, append the key to key list, update the length of key list,
        //    and set data to the key in map.
        // Atomically, execute the following operations.
        //  - 1. Append mapKey to list.
        //  - 2. Set data to key.
        const keysLength = await this._getLength();
        await this.db.batch([
          { type: "put", key: this.getLengthKey(), value: keysLength - 1 }, // Update length
          { type: "del", key: dataKey } // Set data to the corresponding key
        ]);
      }
    } finally {
      this.lock.release();
    }
  }


  private getDataKeyPrefix() {
    return `${this.prefix}-data-`;
  }

  private getLengthKey() {
    return `${this.prefix}-length`;
  }

  private getDataKey(key: string) {
    return `${this.getDataKeyPrefix()}${key}`;
  }

  private mapDataKeyToKey(mapKey: string) {
    return mapKey.slice(`${this.getDataKeyPrefix()}`.length);
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
}
