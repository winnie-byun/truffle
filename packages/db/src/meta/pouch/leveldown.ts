import { logger } from "@truffle/db/logger";
const debug = logger("db:meta:pouch:leveldown");

import path from "path";
import fse from "fs-extra";
import PouchDB from "pouchdb";
import leveldown from "leveldown";
import PouchDBAdapterLevelDB from "pouchdb-adapter-leveldb";

import { Collections } from "@truffle/db/meta";
import { Databases } from "./databases";

export class LeveldownDatabases<C extends Collections> extends Databases<C> {
  private directory: string;

  setup(options) {
    this.directory = options.settings.directory;
    fse.ensureDirSync(this.directory);

    PouchDB.plugin(PouchDBAdapterLevelDB);
  }

  createDatabase(resource) {
    const savePath = path.join(this.directory, resource);
    return new PouchDB(savePath, {
      adapter: "leveldb",
      // @ts-ignore
      db: leveldown
    });
  }
}
