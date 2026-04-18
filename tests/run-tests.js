import assert from "node:assert/strict";
import { analyzeMessage } from "../src/services/feedbackService.js";

function run(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

run("flags mixed Chinese content", () => {
  const result = analyzeMessage("我觉得 this plan is good", "A2");
  assert.ok(result.errorTags.includes("native-language-mix"));
  assert.ok(result.quickFixes.length >= 1);
});

run("rewrites common grammar issues", () => {
  const result = analyzeMessage("I very like this idea", "A2");
  assert.equal(result.rewrite, "I really like this idea");
  assert.ok(result.errorTags.includes("word-order"));
});

run("returns zero scores for empty input", () => {
  const result = analyzeMessage("   ", "A2");
  assert.equal(result.fluencyScore, 0);
  assert.equal(result.accuracyScore, 0);
});

if (process.exitCode === 1) {
  process.exit(1);
}

console.log("All tests passed.");

