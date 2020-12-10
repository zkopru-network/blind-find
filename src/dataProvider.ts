import * as express from "express";

import { HubRegistryTree } from "./";

interface IDB {
  get(): Buffer;
  set(b: Buffer): void;
}

// TODO: Persistance
class DataProvider {
  db: IDB;

  constructor(db: IDB) {
    this.db = db;
  }

  start(port: number): void {
  }
}
