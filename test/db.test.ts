import { DBObjectArray, DBMap, MemoryDB, LevelDB } from "../src/db";
import fs from "fs";
import { PubKey } from "maci-crypto";
import { pubkeyFactoryExclude } from "./utils";
import { ValueError } from "../src/exceptions";

const dbPath = "/tmp/abc123456dsiuafadsoifjdsiao";

describe("LevelDB", () => {
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

  test("set and get", async () => {
    const key = "123";
    // Get undefined when key is not found.
    expect(await db.get(key)).toBeUndefined();
    // Get the same data when succeeds.
    const data = "456";
    await db.set(key, data);
    expect(await db.get(key)).toEqual(data);
    // Get the latest set data.
    const dataAnother = "789";
    await db.set(key, dataAnother);
    expect(await db.get(key)).toEqual(dataAnother);
  });

  test("batch", async () => {
    // Both succeed and are executed **atomically**.
    await db.batch([
      { type: "put", key: "key0", value: "value0" },
      { type: "put", key: "key1", value: "value1" }
    ]);
    expect(await db.get("key0")).toEqual("value0");
    expect(await db.get("key1")).toEqual("value1");

    // `del` fails with the key=null and thus put fails as well.
    // NOTE: Use db.db to avoid type check on `key`.
    await expect(
      db.db.batch([
        { type: "del", key: null },
        { type: "put", key: "key2", value: "value2" }
      ])
    ).rejects.toThrow();
    expect(await db.get("key2")).toBeUndefined();
  });
});

describe("MemoryDB", () => {
  let db: MemoryDB;

  beforeAll(() => {
    db = new MemoryDB();
  });

  afterAll(async () => {
    await db.close();
  });

  test("set and get", async () => {
    const key = "123";
    // Get undefined when key is not found.
    expect(await db.get(key)).toBeUndefined();
    // Get the same data when succeeds.
    const data = "456";
    await db.set(key, data);
    expect(await db.get(key)).toEqual(data);
    // Get the latest set data.
    const dataAnother = "789";
    await db.set(key, dataAnother);
    expect(await db.get(key)).toEqual(dataAnother);
  });

  test("batch", async () => {
    // Both succeed and are executed **atomically**.
    await db.batch([
      { type: "put", key: "key0", value: "value0" },
      { type: "put", key: "key1", value: "value1" }
    ]);
    expect(await db.get("key0")).toEqual("value0");
    expect(await db.get("key1")).toEqual("value1");
  });
});

const isPubkeySame = (a: PubKey, b: PubKey) => {
  return a.length === b.length && a[0] === b[0] && a[1] === b[1];
};

describe("DBArray", () => {
  let db: LevelDB;
  let dbArray: DBObjectArray<PubKey>;

  beforeAll(() => {
    db = new LevelDB(dbPath);
    dbArray = new DBObjectArray("pubkeys", db);
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

  test("operations", async () => {
    // Initially length = 0;
    expect(await dbArray.getLength()).toEqual(0);
    const pubkey0 = pubkeyFactoryExclude([]);
    const pubkey1 = pubkeyFactoryExclude([pubkey0]);
    const pubkey2 = pubkeyFactoryExclude([pubkey0, pubkey1]);
    await dbArray.append(pubkey0);
    // Length is incremented after appending one object.
    expect(await dbArray.getLength()).toEqual(1);
    const pubkey0Actual = await dbArray.get(0);
    // Ensure what is store is correct.
    expect(isPubkeySame(pubkey0, pubkey0Actual)).toBeTruthy();

    // Keep appending
    await dbArray.append(pubkey1);
    expect(await dbArray.getLength()).toEqual(2);

    // Fails when trying to set data to a out-of-range position.
    await expect(dbArray.set(2, pubkey2)).rejects.toThrowError(ValueError);

    // Succeeds when modifying existing data in-range.
    await dbArray.set(0, pubkey2);
    const pubkey2Actual = await dbArray.get(0);
    expect(isPubkeySame(pubkey2, pubkey2Actual)).toBeTruthy();
  });
});

describe("DBMap", () => {
  let db: LevelDB;
  let dbMap: DBMap<PubKey>;

  beforeAll(() => {
    db = new LevelDB(dbPath);
    dbMap = new DBMap("map", db);
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

  test("operations", async () => {
    // Initially length = 0;
    expect(await dbMap.getLength()).toEqual(0);
    const key0 = "key0";
    const key1 = "key1";
    const pubkey0 = pubkeyFactoryExclude([]);
    const pubkey1 = pubkeyFactoryExclude([pubkey0]);
    const pubkey2 = pubkeyFactoryExclude([pubkey0, pubkey1]);
    await dbMap.set(key0, pubkey0);
    // Length is incremented after setting a keypair.
    expect(await dbMap.getLength()).toEqual(1);
    const pubkeyGetKey0 = await dbMap.get(key0);
    // Ensure what is store is correct.
    expect(isPubkeySame(pubkey0, pubkeyGetKey0)).toBeTruthy();
    const pubkeyGetAtIndex0 = await dbMap.getAtIndex(0);
    expect(isPubkeySame(pubkey0, pubkeyGetAtIndex0)).toBeTruthy();

    // Keep setting.
    await dbMap.set(key1, pubkey1);
    expect(await dbMap.getLength()).toEqual(2);

    // Succeed when modifying existing data.
    await dbMap.set(key1, pubkey2);
    const pubkey2Actual = await dbMap.get(key1);
    expect(isPubkeySame(pubkey2, pubkey2Actual)).toBeTruthy();

    // AsyncIterator
    const data: PubKey[] = [];
    for await (const i of dbMap) {
      data.push(i);
    }
    expect(data.length).toEqual(2);
  });
});
