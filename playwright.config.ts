import { defineConfig } from '@playwright/test'

/**
 * Playwright config — ProveIt student frontend.
 *
 * Tests run against PRODUCTION (https://student.proveit.rcnr.net) by default.
 * Override with PROVEIT_E2E_STUDENT_BASE_URL env var for local/staging.
 *
 * Student auth is token-based (no Clerk state file) — verify-code on each
 * test bootstraps a fresh session via a teacher-issued access code passed
 * through the PROVEIT_E2E_ACCESS_CODE env var.
 *
 * Destructive scenarios (paper submit + quiz forced submit) are gated
 * behind PROVEIT_E2E_DESTRUCTIVE=1 to prevent accidental real submissions.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['proveit-student.spec.ts'],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  workers: 1, // student flow is sequential — serialize
  fullyParallel: false,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'tests/e2e/reports', open: 'never' }],
  ],
  use: {
    baseURL:
      process.env.PROVEIT_E2E_STUDENT_BASE_URL ||
      'https://student.proveit.rcnr.net',
    headless: false,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
})
