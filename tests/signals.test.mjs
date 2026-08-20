import test from "node:test";
import assert from "node:assert/strict";
import { verifySignals } from "../src/signals.mjs";

test("verifies the three strong signals", () => {
  const result = verifySignals({ title: "Junior Python Developer", description: "This fully remote team needs solid Python experience.", role: "Python Developer" });
  assert.equal(result.juniorStatus, "verified");
  assert.equal(result.remoteStatus, "verified");
  assert.equal(result.pythonStatus, "verified");
});

test("sends conflicting seniority wording to review", () => {
  const result = verifySignals({ title: "Junior / Senior Engineer", description: "A role with conflicting level wording.", role: "Software Engineer" });
  assert.equal(result.juniorStatus, "conflicting");
  assert.equal(result.reviewReason, "Conflicting signals");
});
