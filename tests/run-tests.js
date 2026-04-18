import assert from "node:assert/strict";

import { analyzeMessage } from "../src/services/feedbackService.js";
import {
  hashPassword,
  normalizeEmail,
  validateCredentials,
  verifyPassword
} from "../src/services/authService.js";

async function run(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

await run("flags mixed Chinese content", async () => {
  const result = analyzeMessage("I think this plan is good, 我也认可", "A2");
  assert.ok(result.errorTags.includes("native-language-mix"));
  assert.ok(result.quickFixes.length >= 1);
});

await run("rewrites common grammar issues", async () => {
  const result = analyzeMessage("I very like this idea", "A2");
  assert.equal(result.rewrite, "I really like this idea");
  assert.ok(result.errorTags.includes("word-order"));
});

await run("returns zero scores for empty input", async () => {
  const result = analyzeMessage("   ", "A2");
  assert.equal(result.fluencyScore, 0);
  assert.equal(result.accuracyScore, 0);
});

await run("normalizes email and validates credentials", async () => {
  const result = validateCredentials({ email: "  User@Example.com ", password: "12345678" });
  assert.equal(result.email, "user@example.com");
  assert.equal(result.errors.length, 0);
});

await run("rejects short password", async () => {
  const result = validateCredentials({ email: "user@example.com", password: "123" });
  assert.ok(result.errors.some((msg) => msg.includes("at least 8")));
});

await run("hash and verify password", async () => {
  const password = "strong-password";
  const hash = await hashPassword(password);
  assert.notEqual(hash, password);
  const ok = await verifyPassword(password, hash);
  assert.equal(ok, true);
});

await run("normalizeEmail handles null safely", async () => {
  assert.equal(normalizeEmail(null), "");
});

if (process.exitCode === 1) {
  process.exit(1);
}

console.log("All tests passed.");

