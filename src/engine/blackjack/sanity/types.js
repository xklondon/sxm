export function check(name, passed, detail) {
    return { name, passed, detail };
}
export function mergeSuiteResults(...suites) {
    const results = suites.flatMap((s) => s.results);
    return { passed: results.every((r) => r.passed), results };
}
