import { logger } from "@truffle/db/logger";
const debug = logger("db:project:resources");

import { IdObject } from "@truffle/db/meta";
import { CollectionName, Input, Resource } from "@truffle/db/resources";

export type ResourceMethods<N extends CollectionName> = {
  load(inputs: Input<N>[]): Promise<IdObject<Resource<N>>>;
}

export type Resources<N extends CollectionName> = {
  [K in N]: ResourceMethods<K>;
}


