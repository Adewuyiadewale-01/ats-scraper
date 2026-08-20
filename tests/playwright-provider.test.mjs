import test from "node:test";
import assert from "node:assert/strict";
import { nextPaginationState, parsePlaywrightResult, PlaywrightGoogleSearchProvider, SearchBlockedError } from "../src/playwright-provider.mjs";

test("reads JSON payloads emitted by playwright-cli eval", () => {
  assert.deepEqual(parsePlaywrightResult('### Result\n[{"title":"Junior role"}]\n### Page'), [{ title: "Junior role" }]);
});

test("paginates until two ATS-valid thin pages and rejects off-domain results", async () => {
  const pages = [
    { hasNext: true, results: [1, 2, 3].map((number) => ({ title: `Job ${number}`, link: `https://jobs.ashbyhq.com/acme/job-${number}`, snippet: "Remote" })).concat({ title: "Noise", link: "https://example.com/noise", snippet: "" }) },
    { hasNext: true, results: [4, 5].map((number) => ({ title: `Job ${number}`, link: `https://jobs.ashbyhq.com/acme/job-${number}`, snippet: "Remote" })) },
    { hasNext: true, results: [{ title: "Job 6", link: "https://jobs.ashbyhq.com/acme/job-6", snippet: "Remote" }] }
  ];
  const browser = { open: async () => {}, rejectGoogleCookiesIfPresent: async () => {}, evaluate: async () => ({ url: "https://google.com/search", title: "Search", bodyText: "", ...pages.shift() }), close: async () => {} };
  const provider = new PlaywrightGoogleSearchProvider({ browser });
  const results = await provider.search({ query: "site:jobs.ashbyhq.com python", allowedHosts: ["jobs.ashbyhq.com"] }, { maxPages: 10, minPageDelayMs: 0, maxPageDelayMs: 0 });
  assert.equal(results.length, 6);
  assert.equal(results.paginationStop, "low_yield");
});

test("leaves a query retryable when Google presents a challenge", async () => {
  const browser = { open: async () => {}, rejectGoogleCookiesIfPresent: async () => {}, evaluate: async () => ({ url: "https://google.com/sorry/", title: "Verify", bodyText: "Our systems detected unusual traffic", hasNext: false, results: [] }) };
  const provider = new PlaywrightGoogleSearchProvider({ browser });
  await assert.rejects(() => provider.search({ query: "site:jobs.ashbyhq.com python" }), SearchBlockedError);
});

test("ends pagination after two consecutive low-yield pages", () => {
  const first = nextPaginationState(0, 2);
  assert.deepEqual(first, { thinPages: 1, complete: false });
  assert.deepEqual(nextPaginationState(first.thinPages, 1), { thinPages: 2, complete: true });
  assert.deepEqual(nextPaginationState(1, 3), { thinPages: 0, complete: false });
});
