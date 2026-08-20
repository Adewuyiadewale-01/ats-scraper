export const platforms = [
  ["Ashby", "site:jobs.ashbyhq.com"],
  ["Greenhouse", "site:greenhouse.io"],
  ["Lever", "(site:jobs.lever.co OR site:jobs.eu.lever.co)"],
  ["Workable", "site:apply.workable.com"],
  ["SmartRecruiters", "site:jobs.smartrecruiters.com"],
  ["Teamtailor", "site:career.teamtailor.com"],
  ["Recruitee", "site:recruitee.com"],
  ["Pinpoint", "site:pinpointhq.com"],
  ["Breezy HR", "site:breezy.hr"],
  ["Comeet", "site:comeet.co"],
  ["Personio", "site:jobs.personio.com"],
  ["Workday", "site:myworkdayjobs.com"]
].map(([name, siteTarget]) => ({ name, siteTarget, enabled: true }));

export const roles = [
  {
    name: "Python Developer",
    junior: ["junior python developer", "junior python engineer", "jr python developer", "associate python developer", "associate python engineer", "entry level python developer", "python engineer I", "python engineer 1"],
    unfiltered: ["python developer", "python engineer", "software engineer python", "python backend engineer", "backend engineer python"],
    strongSignals: ["python"]
  },
  {
    name: "Backend Developer",
    junior: ["junior backend engineer", "junior backend developer", "jr backend engineer", "associate backend engineer", "associate backend developer", "entry level backend engineer", "backend engineer I", "backend engineer 1"],
    unfiltered: ["backend engineer", "backend developer", "software engineer backend", "backend software engineer"],
    strongSignals: []
  },
  {
    name: "Automation Developer",
    junior: ["junior automation engineer", "junior automation developer", "jr automation engineer", "associate automation engineer", "associate automation developer", "entry level automation engineer", "automation engineer I", "automation engineer 1"],
    unfiltered: ["automation engineer", "automation developer", "software engineer automation"],
    strongSignals: []
  },
  {
    name: "Software Engineer",
    junior: ["junior software engineer", "jr software engineer", "associate software engineer", "entry level software engineer", "graduate software engineer", "new grad software engineer", "software engineer I", "software engineer 1"],
    unfiltered: ["software engineer", "software developer"],
    strongSignals: []
  },
  {
    name: "Full Stack Developer",
    junior: ["junior full stack engineer", "junior full stack developer", "junior fullstack engineer", "jr full stack engineer", "associate full stack engineer", "entry level full stack engineer", "full stack engineer I", "full stack engineer 1"],
    unfiltered: ["full stack engineer", "full stack developer", "fullstack engineer", "fullstack developer"],
    strongSignals: []
  }
];

export const defaults = {
  automationEnabled: false,
  dailyRunTime: "08:00",
  timezone: "Africa/Lagos",
  maxQueriesPerRun: 180,
  maxListingsPerRun: 180,
  minListingDelayMs: 1_000,
  maxListingDelayMs: 3_000,
  minPageDelayMs: 15_000,
  maxPageDelayMs: 30_000,
  minSearchPageCooldownMs: 180_000,
  maxSearchPageCooldownMs: 300_000,
  searchPageBurstSize: 3,
  minQueryDelayMs: 90_000,
  maxQueryDelayMs: 180_000,
  queryBurstSize: 3,
  cooldownMinMs: 600_000,
  cooldownMaxMs: 900_000,
  maxPagesPerQuery: 20,
  maxSearchMinutesPerQuery: 75,
  searchRetryAttempts: 2,
  listingRetryAttempts: 3,
  retryBaseDelayMs: 2_000,
  recheckAfterDays: 7,
  staleLockMinutes: 360,
  maxConsecutiveErrorsPerPlatform: 3,
  closeAfterMisses: 3
};
