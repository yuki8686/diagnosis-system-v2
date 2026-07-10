import { strict as assert } from "node:assert";
import { resolveType } from "../src/scoring";

assert.deepEqual(
  resolveType({ win: 7, connect: 3, analyze: 1, axis: 1 }, []),
  { kind: "resolved", primary: "win", secondary: "connect", source: "base" },
);

assert.equal(resolveType({ win: 4, connect: 3, analyze: 3, axis: 2 }, []).kind, "low-confidence");
console.log("scoring smoke tests passed");
