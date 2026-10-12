import { expect, type Page, test } from "@playwright/test";

type Violation = { directive: string; blocked: string; source: string };

/**
 * Fails the test if the browser blocks (or, in Report-Only, would block)
 * anything by the CSP (step 9.1): every flow the E2E covers doubles as a
 * check that the policy allows what the site really loads.
 */
export function failOnCspViolations() {
  const violations = new WeakMap<Page, Violation[]>();
  test.beforeEach(async ({ page }) => {
    const seen: Violation[] = [];
    violations.set(page, seen);
    await page.exposeFunction("__reportCspViolation", (violation: Violation) => {
      seen.push(violation);
    });
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (event) => {
        const report = (window as unknown as { __reportCspViolation: (v: Violation) => void })
          .__reportCspViolation;
        report({
          directive: event.effectiveDirective,
          blocked: event.blockedURI,
          source: event.sourceFile,
        });
      });
    });
  });
  test.afterEach(({ page }) => {
    expect(violations.get(page) ?? [], "CSP violations").toEqual([]);
  });
}
