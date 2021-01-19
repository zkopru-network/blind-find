import { DBArray, DBMap, MemoryDB, LevelDB } from '../src/db';
import fs from 'fs';

// TODO: Add tests for
//  - DBMap
//  - DBArray
//  - Possibly MemoryDB?

const dbPath = '/tmp/abc123456dsiuafadsoifjdsiao';

describe('LevelDB', () => {
    let db: LevelDB;

    beforeAll(() => {
        db = new LevelDB(dbPath);
    });

    afterAll(async () => {
        await db.close();
        // Remove db directory
        await new Promise((res, rej) => {
            fs.rmdir(dbPath, { recursive: true }, err => {
                if (err) {
                    rej(err);
                } else {
                    res();
                }
            });
        });
    });

    test('set and get', async () => {
        const key = '123';
        // Get undefined when key is not found.
        expect(await db.get(key)).toBeUndefined();
        // Get the same data when succeeds.
        const data = '456';
        await db.set(key, data);
        expect(await db.get(key)).toEqual(data);
        // Get the latest set data.
        const dataAnother = '789';
        await db.set(key, dataAnother);
        expect(await db.get(key)).toEqual(dataAnother);
    });

    test('batch', async () => {
        // Both succeed and are executed **atomically**.
        await db.batch([
            { type: 'put', key: 'key0', value: 'value0'},
            { type: 'put', key: 'key1', value: 'value1'},
        ]);
        expect(await db.get('key0')).toEqual('value0');
        expect(await db.get('key1')).toEqual('value1');

        // `del` fails with the key=null and thus put fails as well.
        // NOTE: Use db.db to avoid type check on `key`.
        await expect(db.db.batch([
            { type: 'del', key: null },
            { type: 'put', key: 'key2', value: 'value2'},
        ])).rejects.toThrow();
        expect(await db.get('key2')).toBeUndefined();
    });
});

describe('MemoryDB', () => {
    let db: MemoryDB;

    beforeAll(() => {
        db = new MemoryDB();
    });

    afterAll(async () => {
        await db.close();
    });

    test('set and get', async () => {
        const key = '123';
        // Get undefined when key is not found.
        expect(await db.get(key)).toBeUndefined();
        // Get the same data when succeeds.
        const data = '456';
        await db.set(key, data);
        expect(await db.get(key)).toEqual(data);
        // Get the latest set data.
        const dataAnother = '789';
        await db.set(key, dataAnother);
        expect(await db.get(key)).toEqual(dataAnother);
    });

    test('batch', async () => {
        // Both succeed and are executed **atomically**.
        await db.batch([
            { type: 'put', key: 'key0', value: 'value0'},
            { type: 'put', key: 'key1', value: 'value1'},
        ]);
        expect(await db.get('key0')).toEqual('value0');
        expect(await db.get('key1')).toEqual('value1');
    });
});
