import AwaitLock from "await-lock";

import { IAtomicDB, TRangeOptions, TLevelDBOp } from "./interfaces";
import { stringifyBigInts, unstringifyBigInts } from "maci-crypto";
import { ValueError } from "./exceptions";
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

  async createReadStream(options?: TRangeOptions): Promise<AsyncIterable<any>> {
    const m = this.map;
    return {
      async *[Symbol.asyncIterator]() {
        for (const entry of m) {
          const [ key, value ] = entry;
          if (value === undefined) {
            throw new Error('should never happen');
          }
          if (options !== undefined) {
            if (options.gt !== undefined && !(options.gt < key)) {
              continue;
            } else if (options.gte !== undefined && !(options.gte <= key)) {
              continue;
            } else if (options.lt !== undefined && !(key < options.lt)) {
              continue;
            } else if (options.lte !== undefined && !(key <= options.lte)) {
              continue;
            }
          }
          yield { key, value };
        }
      }
    }
  }

  async del(key: string) {
    this.map.delete(key);
  }

  async clear(options?: TRangeOptions) {
    const newMap = new Map<string, any>();
    if (options !== undefined) {
      for (const entry of this.map) {
        const [ key, value ] = entry;
        if (options.gt !== undefined && options.gt < key) {
          continue;
        } else if (options.gte !== undefined && options.gte <= key) {
          continue;
        } else if (options.lt !== undefined && key < options.lt) {
          continue;
        } else if (options.lte !== undefined && key <= options.lte) {
          continue;
        }
        newMap.set(key, value);
      }
    }
    this.map = newMap;
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

  async createReadStream(options?: TRangeOptions): Promise<AsyncIterable<any>> {
    await this.lock.acquireAsync();
    try {
      return await this.db.createReadStream(options);
    } finally {
      this.lock.release();
    }
  }

  async del(key: string): Promise<void> {
    await this.lock.acquireAsync();
    try {
      await this.db.del(key);
    } finally {
      this.lock.release();
    }
  }

  async clear(options?: TRangeOptions): Promise<void> {
    await this.lock.acquireAsync();
    try {
      await this.db.clear(options);
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
  del(key: string): Promise<void>;
  clear(): Promise<void>;
}

export class DBMap<T extends object> implements IDBMap<T> {

  lock: AwaitLock;
  /**
   *
   * @param prefix key prefix used for this map
   * @param db
   * @param maxKeyLength max length of a key in bytes
   */
  constructor(private readonly prefix: string, private readonly db: IAtomicDB, private readonly maxKeyLength: number) {
    this.lock = new AwaitLock();
  }

  async getLength(): Promise<number> {
    const allData: any[] = [];
    for await (const kv of this) {
      allData.push(kv);
    }
    return allData.length;
  }

  async get(key: string): Promise<T | undefined> {
    this.validateDataKey(key);
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
        lte: this.getMaxDataKey(),
      });
      for await (const kv of readStream) {
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
      await this.db.set(dataKey, encodedData);
    } finally {
      this.lock.release();
    }
  }

  async del(key: string): Promise<void> {
    await this.lock.acquireAsync();
    try {
      const dataKey = this.getDataKey(key);
      await this.db.del(dataKey);
    } finally {
      this.lock.release();
    }
  }

  async clear() {
    await this.lock.acquireAsync();
    try {
      await this.db.clear({
        gt: this.getDataKeyPrefix(),
        lte: this.getMaxDataKey(),
      });
    } finally {
      this.lock.release();
    }
  }

  // A workaround to make range iteration work.
  private getMaxDataKey() {
    return `${this.getDataKeyPrefix()}` + '\xff'.repeat(this.maxKeyLength);
  }

  private validateDataKey(key: string) {
    if (key.length > this.maxKeyLength) {
      throw new ValueError(`key is too long: key.length=${key.length}`);
    }
  }

  private getDataKeyPrefix() {
    return `${this.prefix}-data-`;
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

}
