import { DBObjectArray, DBMap, MemoryDB, LevelDB } from "../src/db";
import fs from "fs";
import { PubKey } from "maci-crypto";
import { pubkeyFactoryExclude } from "./utils";
import { ValueError } from "../src/exceptions";

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

chai.use(chaiAsPromised);
const expect = chai.expect;

const dbPath = "/tmp/abc123456dsiuafadsoifjdsiao";

describe("LevelDB", () => {
  let db: LevelDB;

  before(() => {
    db = new LevelDB(dbPath);
  });

  after(async () => {
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
    expect(
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
    // Get undefined when key is not found.
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

describe("DBArray", () => {
  let db: LevelDB;
  let dbArray: DBObjectArray<PubKey>;

  before(() => {
    db = new LevelDB(dbPath);
    dbArray = new DBObjectArray("pubkeys", db);
  });

  after(async () => {
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

  it("operations", async () => {
    // Initially length = 0;
    expect(await dbArray.getLength()).to.eql(0);
    const pubkey0 = pubkeyFactoryExclude([]);
    const pubkey1 = pubkeyFactoryExclude([pubkey0]);
    const pubkey2 = pubkeyFactoryExclude([pubkey0, pubkey1]);
    await dbArray.append(pubkey0);
    // Length is incremented after appending one object.
    expect(await dbArray.getLength()).to.eql(1);
    const pubkey0Actual = await dbArray.get(0);
    // Ensure what is store is correct.
    expect(isPubkeySame(pubkey0, pubkey0Actual)).to.be.true;

    // Keep appending
    await dbArray.append(pubkey1);
    expect(await dbArray.getLength()).to.eql(2);

    // Fails when trying to set data to a out-of-range position.
    expect(dbArray.set(2, pubkey2)).to.be.rejectedWith(ValueError);

    // Succeeds when modifying existing data in-range.
    await dbArray.set(0, pubkey2);
    const pubkey2Actual = await dbArray.get(0);
    expect(isPubkeySame(pubkey2, pubkey2Actual)).to.be.true;
  });
});

describe("DBMap", () => {
  let db: LevelDB;
  let dbMap: DBMap<PubKey>;

  before(() => {
    db = new LevelDB(dbPath);
    dbMap = new DBMap("map", db);
  });

  after(async () => {
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
    // Ensure what is store is correct.
    expect(isPubkeySame(pubkey0, pubkeyGetKey0)).to.be.true;
    const pubkeyGetAtIndex0 = await dbMap.getAtIndex(0);
    expect(isPubkeySame(pubkey0, pubkeyGetAtIndex0)).to.be.true;

    // Keep setting.
    await dbMap.set(key1, pubkey1);
    expect(await dbMap.getLength()).to.eql(2);

    // Succeed when modifying existing data.
    await dbMap.set(key1, pubkey2);
    const pubkey2Actual = await dbMap.get(key1);
    expect(isPubkeySame(pubkey2, pubkey2Actual)).to.be.true;

    // AsyncIterator
    const data: { key: string; value: PubKey }[] = [];
    for await (const i of dbMap) {
      data.push(i);
      console.log(i);
    }
    expect(data.length).to.eql(2);
  });
});
