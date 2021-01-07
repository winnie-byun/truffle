import debugModule from "debug";
const debug = debugModule("db");

require("source-map-support/register");

import * as Meta from "./meta";
import { definitions } from "./resources";
export { Db } from "./meta";
export { Collections, definitions } from "./resources";
export { Project } from "./project";

export const { schema, connect, serve, attach } = Meta.forDefinitions(
  definitions
);
