export interface SanityCheckResult {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface SanitySuiteResult {
  passed: boolean;
  results: SanityCheckResult[];
}

export function check(name: string, passed: boolean, detail?: string): SanityCheckResult {
  return { name, passed, detail };
}

export function mergeSuiteResults(...suites: SanitySuiteResult[]): SanitySuiteResult {
  const results = suites.flatMap((s) => s.results);
  return { passed: results.every((r) => r.passed), results };
}
