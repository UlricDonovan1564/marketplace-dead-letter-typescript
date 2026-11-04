import assert from "node:assert/strict";
import { decideJob } from "./dead_letter.ts";

assert.equal(decideJob(0), "retry");
assert.equal(decideJob(2), "retry");
assert.equal(decideJob(3), "dead-letter");
assert.equal(decideJob(5, 2), "dead-letter");
console.log("dead-letter decision test passed");
