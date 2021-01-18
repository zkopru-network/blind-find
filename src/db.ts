const level = require('level');
import AwaitLock from 'await-lock';

import { IAtomicDB, TLevelDBOp } from "./interfaces";
import { ValueError } from "./smp/exceptions";
import { stringifyBigInts, unstringifyBigInts } from "maci-crypto";

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
            if (op.type === 'put') {
                this.map.set(op.key, op.value);
            } else {
                this.map.delete(op.key);
            }
        }
    }

    async close() { }
}

export class LevelDB implements IAtomicDB {
    db: any;
    lock: AwaitLock;

    constructor (path: string) {
        this.db = level(path, { valueEncoding: 'json' });
        this.lock = new AwaitLock();
    }

    async get(key: string) {
        await this.lock.acquireAsync();
        try {
            return await this.db.get(key);
        } catch (e) {
            // https://github.com/Level/level#dbgetkey-options-callback
            if (e.type === 'NotFoundError') {
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

interface IDBMap<T> {
    get(key: string): Promise<T | undefined>;
    set(key: string, data: T): Promise<void>;
}

export class DBArray<T> implements IDBArray<T> {
    constructor(readonly prefix: string, readonly db: IAtomicDB) {}

    private getLengthKey() {
        return `${this.prefix}-length`;
    }

    private getIndexKey(index: number) {
        return `${this.prefix}-data-${index}`;
    }

    async getLength(): Promise<number> {
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

    async get(index: number): Promise<T> {
        const length = await this.getLength();
        if (index >= length) {
            throw new ValueError(`index out of range: index=${index}, length=${length}`);
        }
        const key = this.getIndexKey(index);
        const data = await this.db.get(key);
        if (data === undefined) {
            throw new Error('index is in the range but data is not found');
        }
        return data;
    }

    async append(data: T): Promise<void> {
        const length = await this.getLength();
        const key = this.getIndexKey(length);
        await this.db.batch([
            { type: 'put', key: key, value: data },  // Append data
            { type: 'put', key: this.getLengthKey(), value: length + 1},  // Update length
        ])
    }

    async set(index: number, data: T): Promise<void> {
        const length = await this.getLength();
        const key = this.getIndexKey(index);
        if (index >= length) {
            throw new ValueError(`index out of range: index=${index}, length=${length}`);
        }
        await this.db.set(key, data);
    }
}

export class DBMap<T> implements IDBMap<T> {
    constructor(readonly prefix: string, readonly db: IAtomicDB) {}

    private getKey(keyString: string) {
        return `${this.prefix}-data-${keyString}`;
    }

    async get(key: string): Promise<T | undefined> {
        return await this.db.get(this.getKey(key));
    }

    async set(key: string, data: T): Promise<void> {
        await this.db.set(this.getKey(key), data);
    }
}
