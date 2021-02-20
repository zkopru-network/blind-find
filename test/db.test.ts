import { DBMap, MemoryDB, LevelDB } from "../src/db";
import { PubKey } from "maci-crypto";
import { pubkeyFactoryExclude } from "./utils";

import chai from "chai";
import chaiAsPromised from "chai-as-promised";

import tmp from 'tmp-promise';

chai.use(chaiAsPromised);
const expect = chai.expect;

describe("LevelDB", () => {
  let db: LevelDB;
  let tmpDir: tmp.DirectoryResult;

  before(async () => {
    tmpDir = await tmp.dir({ unsafeCleanup: true });
    db = new LevelDB(tmpDir.path);
  });

  after(async () => {
    await db.close();
    await tmpDir.cleanup();
  });

  it("set and get", async () => {
    const key = "123";
    // Get undefined when key is not found.
    expect(await db.get(key)).to.be.undefined;
    // Get the same data when succeeds.
    const data = "456";
    await db.set(key, data);
    expect(await db.get(key)).to.eql(data);
    // Get the latest set data.
    const dataAnother = "789";
    await db.set(key, dataAnother);
    expect(await db.get(key)).to.to.eql(dataAnother);
  });

  it("batch", async () => {
    // Both succeed and are executed **atomically**.
    await db.batch([
      { type: "put", key: "key0", value: "value0" },
      { type: "put", key: "key1", value: "value1" }
    ]);
    expect(await db.get("key0")).to.eql("value0");
    expect(await db.get("key1")).to.eql("value1");

    // `del` fails with the key=null and thus put fails as well.
    // NOTE: Use db.db to avoid type check on `key`.
    await expect(
      db.db.batch([
        { type: "del", key: null },
        { type: "put", key: "key2", value: "value2" }
      ])
    ).to.be.rejected;
    expect(await db.get("key2")).to.be.undefined;
  });
});

describe("MemoryDB", () => {
  let db: MemoryDB;

  before(() => {
    db = new MemoryDB();
  });

  after(async () => {
    await db.close();
  });

  it("set and get", async () => {
    const key = "123";
    // Get undefined when key is not found.p
    expect(await db.get(key)).to.be.undefined;
    // Get the same data when succeeds.
    const data = "456";
    await db.set(key, data);
    expect(await db.get(key)).to.eql(data);
    // Get the latest set data.
    const dataAnother = "789";
    await db.set(key, dataAnother);
    expect(await db.get(key)).to.eql(dataAnother);
  });

  it("batch", async () => {
    // Both succeed and are executed **atomically**.
    await db.batch([
      { type: "put", key: "key0", value: "value0" },
      { type: "put", key: "key1", value: "value1" }
    ]);
    expect(await db.get("key0")).to.eql("value0");
    expect(await db.get("key1")).to.eql("value1");
  });
});

const isPubkeySame = (a: PubKey, b: PubKey) => {
  return a.length === b.length && a[0] === b[0] && a[1] === b[1];
};

describe("DBMap", () => {
  let db: LevelDB;
  let dbMap: DBMap<PubKey>;
  let tmpDir: tmp.DirectoryResult;

  before(async () => {
    tmpDir = await tmp.dir({ unsafeCleanup: true });
    db = new LevelDB(tmpDir.path);
    dbMap = new DBMap("map", db);
  });

  after(async () => {
    await db.close();
    await tmpDir.cleanup();
  });

  it("operations", async () => {
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

    await dbMap.del(key0);
    expect(await dbMap.getLength()).to.eql(1);
    // No warning when deleting an inexistent key.
    await dbMap.del(key0);
    expect(await dbMap.getLength()).to.eql(1);
    await dbMap.del(key1);
    expect(await dbMap.getLength()).to.eql(0);
  });

});
