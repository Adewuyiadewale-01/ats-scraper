import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

function defaultCliPath() {
  const projectWrapper = fileURLToPath(new URL("../scripts/playwright-cli.sh", import.meta.url));
  return process.env.PLAYWRIGHT_CLI_PATH || projectWrapper || path.join(homedir(), ".codex", "skills", "playwright", "scripts", "playwright_cli.sh");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomBetween = (minimum, maximum) => minimum + Math.floor(Math.random() * Math.max(1, maximum - minimum + 1));

export class SearchBlockedError extends Error { constructor(message) { super(message); this.name = "SearchBlockedError"; this.retryable = true; } }
export class SearchSafetyLimitError extends Error { constructor(message) { super(message); this.name = "SearchSafetyLimitError"; this.retryable = true; } }

export function parsePlaywrightResult(output) {
  const match = output.match(/### Result\s*\n([\s\S]*?)(?=\n###|$)/);
  if (!match) throw new Error("Playwright did not return a readable page result");
  return JSON.parse(match[1].trim());
}

export function nextPaginationState(previousThinPages, validResultCount) {
  const thinPages = validResultCount < 3 ? previousThinPages + 1 : 0;
  return { thinPages, complete: thinPages >= 2 };
}

export class PlaywrightBrowser {
  constructor({ cliPath = process.env.PLAYWRIGHT_CLI_PATH || defaultCliPath(), session = "daily-job-discovery", headed = true, timeoutMs = 45_000 } = {}) {
    this.cliPath = cliPath; this.session = session; this.headed = headed; this.timeoutMs = timeoutMs;
  }

  async command(args) {
    const { stdout } = await execFileAsync(this.cliPath, ["--session", this.session, ...args], { timeout: this.timeoutMs, maxBuffer: 2_000_000 });
    return stdout;
  }

  async open(url) {
    const args = [this.started ? "goto" : "open", url];
    if (!this.started && this.headed) args.push("--headed");
    await this.command(args);
    this.started = true;
  }

  async evaluate(expression) { return parsePlaywrightResult(await this.command(["eval", expression])); }

  async runCode(code) { return this.command(["run-code", code]); }

  async rejectGoogleCookiesIfPresent() {
    const hasBanner = await this.evaluate(`document.body.innerText.includes('Before you continue to Google')`);
    if (hasBanner) await this.runCode("async page => { const button = page.getByRole('button', { name: 'Reject all' }); if (await button.count()) await button.click(); }");
  }

  async close() {
    if (!this.started) return;
    try { await this.command(["close"]); } finally { this.started = false; }
  }
}

export class PlaywrightGoogleSearchProvider {
  constructor({ browser = new PlaywrightBrowser(), maxResults } = {}) { this.browser = browser; this.maxResults = maxResults; }

  async search(query, options = {}) {
    const resume = options.resume || {};
    const allResults = [...(resume.partialResults || [])];
    const seenUrls = new Set(allResults.map((result) => result.link));
    let pageNumber = Number(resume.nextPage || 0);
    let thinPages = Number(resume.thinPages || 0);
    const maximumPages = Math.max(1, Number(options.maxPages || 20));
    const maximumMs = Math.max(60_000, Number(options.maxMinutes || 20) * 60_000);
    const startedAt = Date.now();
    let paginationStop = "";
    while (true) {
      if (pageNumber >= maximumPages) throw new SearchSafetyLimitError(`Query reached the ${maximumPages}-page safety limit`);
      if (Date.now() - startedAt >= maximumMs) throw new SearchSafetyLimitError(`Query reached the ${Math.round(maximumMs / 60_000)}-minute safety limit`);
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query.query)}&start=${pageNumber * 10}`;
      await this.browser.open(searchUrl);
      await this.browser.rejectGoogleCookiesIfPresent();
      const page = await this.browser.evaluate(`(() => {
        const unwrap = (value) => {
          try { const url = new URL(value, location.href); return url.hostname.endsWith('google.com') && url.pathname === '/url' ? (url.searchParams.get('q') || url.searchParams.get('url') || value) : url.href; }
          catch { return value; }
        };
        return {
          url: location.href,
          title: document.title,
          bodyText: document.body.innerText.slice(0, 12000),
          hasNext: Boolean(document.querySelector('#pnnext, a[aria-label="Next page"], a[aria-label^="Next"]')),
          results: [...document.querySelectorAll('a')].flatMap((anchor) => {
            const heading = anchor.querySelector('h3');
            if (!heading) return [];
            const container = anchor.closest('div');
            return [{ title: heading.innerText.trim(), link: unwrap(anchor.href), snippet: (container?.parentElement?.innerText || container?.innerText || '').replace(/\\s+/g, ' ').trim() }];
          })
        };
      })()`);
      const challengeText = `${page.url || ""}\n${page.title || ""}\n${page.bodyText || ""}`;
      if (/\/sorry\/|unusual traffic|verify (?:that )?you(?:'re| are) human|not a robot|captcha/i.test(challengeText)) throw new SearchBlockedError("Google presented a verification or unusual-traffic page; query remains pending");
      const allowedHosts = query.allowedHosts?.length ? query.allowedHosts : [...query.query.matchAll(/site:([a-z0-9.-]+)/gi)].map((match) => match[1].toLowerCase());
      const hostAllowed = (hostname) => !allowedHosts.length || allowedHosts.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`));
      const resolved = [];
      for (const result of page.results || []) {
        if (this.maxResults && allResults.length + resolved.length >= this.maxResults) break;
        let url;
        try { url = new URL(result.link); } catch { continue; }
        if (!/^https?:$/.test(url.protocol) || url.hostname.endsWith("google.com") || !hostAllowed(url.hostname.toLowerCase()) || seenUrls.has(url.href)) continue;
        seenUrls.add(url.href);
        resolved.push({ title: result.title, snippet: result.snippet, link: url.href, displayLink: url.hostname });
      }
      allResults.push(...resolved);
      const state = nextPaginationState(thinPages, resolved.length);
      thinPages = state.thinPages;
      const reachedResultLimit = Boolean(this.maxResults && allResults.length >= this.maxResults);
      if (reachedResultLimit) paginationStop = "result_limit";
      else if (!page.hasNext) paginationStop = "exhausted";
      else if (state.complete) paginationStop = "low_yield";
      await options.onPage?.({ partialResults: allResults, nextPage: pageNumber + 1, thinPages, lastPage: pageNumber, validResults: resolved.length, paginationStop });
      if (paginationStop) break;
      pageNumber += 1;
      await sleep(randomBetween(Number(options.minPageDelayMs || 0), Number(options.maxPageDelayMs || options.minPageDelayMs || 0)));
    }
    allResults.paginationStop = paginationStop;
    return allResults;
  }

  async close() { await this.browser.close(); }
}

export function createPlaywrightListingReader(browser) {
  return async (candidate) => {
    await browser.open(candidate.canonicalUrl);
    await browser.runCode("async page => { await page.waitForTimeout(2000); }");
    const listing = await browser.evaluate(`(() => {
      const body = document.body.innerText.slice(0, 100000);
      let schema;
      for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          const parsed = JSON.parse(script.textContent);
          const values = Array.isArray(parsed) ? parsed : [parsed, ...(Array.isArray(parsed?.['@graph']) ? parsed['@graph'] : [])];
          schema = values.find((item) => item?.['@type'] === 'JobPosting' || item?.['@type']?.includes?.('JobPosting'));
          if (schema) break;
        } catch { /* malformed third-party schema */ }
      }
      const address = Array.isArray(schema?.jobLocation) ? schema.jobLocation[0]?.address : schema?.jobLocation?.address;
      return {
        title: schema?.title || document.querySelector('h1')?.innerText?.trim() || document.title,
        description: schema?.description ? new DOMParser().parseFromString(schema.description, 'text/html').body.innerText : body,
        company: schema?.hiringOrganization?.name || '',
        location: address?.addressLocality || schema?.applicantLocationRequirements?.name || (body.match(/Location\\s+([^\\n]+)/i) || [])[1] || '',
        closed: /job (?:is )?no longer available|position (?:has been|is) filled|application closed/i.test(body),
        blocked: /access denied|verify (?:that )?you(?:'re| are) human|captcha|checking your browser/i.test(body)
      };
    })()`);
    if (listing.blocked) throw new Error("ATS page presented an access or verification challenge");
    const url = new URL(candidate.canonicalUrl);
    const pathPart = url.pathname.split('/').filter(Boolean)[0];
    const tenant = url.hostname.split('.')[0];
    const inferred = /(?:myworkdayjobs|recruitee|breezy|pinpointhq)\.com$|breezy\.hr$/i.test(url.hostname) && !/^(www|jobs|apply|career)$/i.test(tenant) ? tenant : pathPart || candidate.displayLink;
    return { ...listing, company: listing.company || inferred.replace(/[-_]/g, ' ').replace(/\\b\\w/g, (letter) => letter.toUpperCase()), canonicalUrl: candidate.canonicalUrl };
  };
}
