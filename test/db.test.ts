import { DBMap, MemoryDB, LevelDB } from "../src/db";
import { PubKey } from "maci-crypto";
import { pubkeyFactoryExclude } from "./utils";

import chai from "chai";
import chaiAsPromised from "chai-as-promised";

import tmp from 'tmp-promise';
import { IAtomicDB } from "../src/interfaces";

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("AtomicDB", () => {

  const testAtomicDB = async (db: IAtomicDB) => {
    /* set and get */
    const key0 = "key0";
    const key1 = "key1";
    const key2 = "key2";
    const key3 = "key3";
    // Get undefined when key is not found.p
    expect(await db.get(key0)).to.be.undefined;
    // Get the same data when succeeds.
    const data = "456";
    await db.set(key0, data);
    expect(await db.get(key0)).to.eql(data);
    // Get the latest set data.
    const dataAnother = "789";
    await db.set(key0, dataAnother);
    expect(await db.get(key0)).to.eql(dataAnother);

    /* set batch */
    // Both succeed and are executed **atomically**.
    await db.batch([
      { type: "put", key: key1, value: "value1" },
      { type: "put", key: key2, value: "value2" }
    ]);
    expect(await db.get(key1)).to.eql("value1");
    expect(await db.get(key2)).to.eql("value2");

    /* del */
    // It's fine to delete a inexistent key
    await db.del("keyInexistent");

    // Delete and will get undefined.
    await db.del(key0);
    expect(await db.get(key0)).to.be.undefined;

    // Clear
    await db.set(key3, "value3");
    await db.clear({gt: key3});
    expect(await db.get(key1)).to.eql("value1");
    expect(await db.get(key2)).to.eql("value2");
    expect(await db.get(key3)).to.eql("value3");
    await db.clear({lt: key1});
    expect(await db.get(key1)).to.eql("value1");
    expect(await db.get(key2)).to.eql("value2");
    expect(await db.get(key3)).to.eql("value3");
    await db.clear({lte: key1});
    expect(await db.get(key1)).to.be.undefined;
    expect(await db.get(key2)).to.eql("value2");
    expect(await db.get(key3)).to.eql("value3");
    await db.clear({gte: key3});
    expect(await db.get(key1)).to.be.undefined;
    expect(await db.get(key2)).to.eql("value2");
    expect(await db.get(key3)).to.be.undefined;
    await db.clear();
    expect(await db.get(key2)).to.be.undefined;
  }

  it("MemoryDB", async () => {
    const db = new MemoryDB();
    await testAtomicDB(db);
    await db.close();
  });

  it("LevelDB", async () => {
    const tmpDir = await tmp.dir({ unsafeCleanup: true });
    const db = new LevelDB(tmpDir.path);
    await testAtomicDB(db);
    await db.close();
    await tmpDir.cleanup();
  });

});

const isPubkeySame = (a: PubKey, b: PubKey) => {
  return a.length === b.length && a[0] === b[0] && a[1] === b[1];
};

describe("DBMap", () => {

  const testDBMap = async (db: IAtomicDB) => {
    const maxKeyLength = 32;
    const dbMap = new DBMap<PubKey>("map", db, maxKeyLength);
    // Initially length = 0;
    expect(await dbMap.getLength()).to.eql(0);
    const key0 = "key0";
    const key1 = "key1";
    const pubkey0 = pubkeyFactoryExclude([]);
    const pubkey1 = pubkeyFactoryExclude([pubkey0]);
    const pubkey2 = pubkeyFactoryExclude([pubkey0, pubkey1]);
    await dbMap.set(key0, pubkey0);
    // Length is incremented after setting a keypair.
    expect(await dbMap.getLength()).to.eql(1);
    const pubkeyGetKey0 = await dbMap.get(key0);
    // Make tsc happy.
    if (pubkeyGetKey0 === undefined) {
      throw new Error();
    }
    expect(pubkeyGetKey0).not.to.be.undefined;
    // Ensure what is store is correct.
    expect(isPubkeySame(pubkey0, pubkeyGetKey0)).to.be.true;

    // Throws when getting a inexistent key.
    const keyNonExists = "keyNonExists";
    expect(await dbMap.get(keyNonExists)).to.be.undefined;

    // Keep setting.
    await dbMap.set(key1, pubkey1);
    expect(await dbMap.getLength()).to.eql(2);

    // Succeeds when modifying existing data.
    await dbMap.set(key1, pubkey2);
    const pubkey2Actual = await dbMap.get(key1);
    // Make tsc happy.
    if (pubkey2Actual === undefined) {
      throw new Error();
    }
    expect(pubkey2Actual).not.to.be.undefined;
    expect(isPubkeySame(pubkey2, pubkey2Actual)).to.be.true;

    // AsyncIterator
    const data: { key: string; value: PubKey }[] = [];
    for await (const i of dbMap) {
      data.push(i);
    }
    expect(data.length).to.eql(2);

    // Delete key
    await dbMap.del(key0);
    expect(await dbMap.getLength()).to.eql(1);
    // No warning when deleting an inexistent key.
    await dbMap.del(key0);
    expect(await dbMap.getLength()).to.eql(1);
    await dbMap.del(key1);
    expect(await dbMap.getLength()).to.eql(0);

    // Clear
    await dbMap.set(key0, pubkey0);
    await dbMap.set(key1, pubkey1);
    expect(await dbMap.getLength()).to.eql(2);
    await dbMap.clear();
    expect(await dbMap.getLength()).to.eql(0);
  }

  it("MemoryDB", async () => {
    const db = new MemoryDB();
    await testDBMap(db);
    await db.close();
  });

  it("LevelDB", async () => {
    const tmpDir = await tmp.dir({ unsafeCleanup: true });
    const db = new LevelDB(tmpDir.path);
    await testDBMap(db);
    await db.close();
    await tmpDir.cleanup();
  });
});
