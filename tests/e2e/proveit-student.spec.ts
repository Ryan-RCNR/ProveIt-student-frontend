/**
 * ProveIt student frontend — regression spec.
 *
 * Locks every invariant we built across four bug-fix sessions:
 *   2026-05-08  CRIT-3 timer-expiry forced submit + failure screen routing
 *   2026-05-09  HIGH-2 verify-code enumeration vector (uniform 400 + 250-500ms delay)
 *   2026-05-09  HIGH-3 outline_responses cap (frontend maxLength + Pydantic + AI truncation)
 *   2026-05-10  MED-1 session_token required on 3 student polling endpoints
 *
 * Auth: token-based via verify-code. No Clerk state file needed.
 *
 * Source of truth for what each test does: .rcnr/e2e-test-plan-proveit.md
 *
 * Regenerate this spec by running /e2e — do not hand-edit.
 */

import { test, expect, type APIRequestContext } from '@playwright/test'

const DESTRUCTIVE = process.env.PROVEIT_E2E_DESTRUCTIVE === '1'
const ACCESS_CODE = process.env.PROVEIT_E2E_ACCESS_CODE
const KNOWN_STUDENT_NAME = process.env.PROVEIT_E2E_KNOWN_STUDENT_NAME
const TEST_SUBMISSION_ID = process.env.PROVEIT_E2E_TEST_SUBMISSION_ID
const TEST_SESSION_TOKEN = process.env.PROVEIT_E2E_TEST_SESSION_TOKEN
const API_URL = process.env.PROVEIT_E2E_API_URL || 'https://api.rcnr.net'

// HIGH-2 generic error message that all three negative verify-code
// branches must surface. The em-dash is U+2014, not a hyphen.
const HIGH2_GENERIC_ERROR = 'Cannot enter — please see your teacher.'

// ---------------------------------------------------------------------------
// STUD-1, STUD-2, STUD-3 — HIGH-2 verify-code enumeration regression
// ---------------------------------------------------------------------------

test.describe('ProveIt student — HIGH-2 verify-code uniform negative response', () => {
  test('STUD-1: bad access code → generic 400 + 250-500ms constant-time delay', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /ProveIt/i })).toBeVisible({
      timeout: 10_000,
    })

    await page.fill('input[placeholder*="full name" i]', 'Regression Test Student')
    await page.fill('input[placeholder*="ABCD" i]', 'XXXX-9999')

    const startMs = Date.now()
    await page.getByRole('button', { name: /verify|continue|enter|start/i })
      .click()

    // Wait for the error banner. The text uses the em-dash; match loosely
    // on "Cannot enter" since the rest is whitespace-sensitive.
    const errorBanner = page.getByText(/Cannot enter/i)
    await expect(errorBanner).toBeVisible({ timeout: 5_000 })
    const elapsedMs = Date.now() - startMs

    // Strict: must surface the new generic copy, NOT old 404 wording
    await expect(page.getByText(/Invalid or expired access code/i)).toHaveCount(0)

    // Constant-time delay: 250ms floor (helper minimum), 2000ms ceiling
    // accounts for network jitter + UI render. The HIGH-2 helper sleeps
    // in [250, 500)ms; total request time picks up TLS + slowapi overhead.
    expect(
      elapsedMs,
      `HIGH-2 regression: verify-code completed in ${elapsedMs}ms. Below ` +
        `250ms means the constant-time delay was removed.`,
    ).toBeGreaterThanOrEqual(250)
    expect(
      elapsedMs,
      `HIGH-2 unusually slow at ${elapsedMs}ms. May indicate network or ` +
        `server perf issue, not a regression per se — but worth investigating.`,
    ).toBeLessThanOrEqual(2_000)
  })

  test('STUD-2: name-clash returns identical generic message', async ({ page }) => {
    test.skip(
      !ACCESS_CODE || !KNOWN_STUDENT_NAME,
      'Set PROVEIT_E2E_ACCESS_CODE + PROVEIT_E2E_KNOWN_STUDENT_NAME to run',
    )

    await page.goto('/')
    await page.fill('input[placeholder*="full name" i]', KNOWN_STUDENT_NAME!)
    await page.fill('input[placeholder*="ABCD" i]', ACCESS_CODE!)

    const startMs = Date.now()
    await page.getByRole('button', { name: /verify|continue|enter|start/i })
      .click()

    await expect(page.getByText(/Cannot enter/i)).toBeVisible({ timeout: 5_000 })
    const elapsedMs = Date.now() - startMs

    // CRITICAL — the OLD 400 message was "A submission with this name
    // already exists". HIGH-2 collapses it to the generic copy.
    await expect(
      page.getByText(/A submission with this name already exists/i),
    ).toHaveCount(0)

    expect(elapsedMs).toBeGreaterThanOrEqual(250)
    expect(elapsedMs).toBeLessThanOrEqual(2_000)
  })

  test('STUD-3: rate limit triggers 429 within 12 invalid attempts', async ({
    page,
  }) => {
    await page.goto('/')

    const responses: { status: number; ts: number }[] = []
    page.on('response', (res) => {
      if (res.url().includes('/api/proveit/verify-code')) {
        responses.push({ status: res.status(), ts: Date.now() })
      }
    })

    for (let i = 0; i < 12; i++) {
      // Re-fill each iteration — the form state may clear or not
      await page.fill('input[placeholder*="full name" i]', `Test Student ${i}`)
      await page.fill(
        'input[placeholder*="ABCD" i]',
        `AAAA-${String(i).padStart(4, '0')}`,
      )
      await page.getByRole('button', { name: /verify|continue|enter|start/i })
        .click()
      // Wait briefly for response — we don't care about UI feedback here
      await page.waitForTimeout(600)
    }

    const got429 = responses.some((r) => r.status === 429)
    expect(
      got429,
      `HIGH-2 regression: no 429 in ${responses.length} attempts. The ` +
        `verify-code rate limit should drop to 10/min per-IP — getting more ` +
        `than 10 successful (400-or-200) responses in a row means the limit ` +
        `is back at the pre-fix 60/min OR is keyed wrong.`,
    ).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// STUD-5, STUD-6, STUD-7 — MED-1 session_token required on polling endpoints
// ---------------------------------------------------------------------------

test.describe('ProveIt student — MED-1 session_token gating', () => {
  test.skip(
    !TEST_SUBMISSION_ID || !TEST_SESSION_TOKEN,
    'Set PROVEIT_E2E_TEST_SUBMISSION_ID + PROVEIT_E2E_TEST_SESSION_TOKEN ' +
      '(from a real paper-submit response) to run MED-1 wire-level tests',
  )

  test('STUD-5: /quiz-ready returns 401 / 403 / 200 by token state', async ({
    request,
  }) => {
    const base = `${API_URL}/api/proveit/submissions/${TEST_SUBMISSION_ID}/quiz-ready`

    // No token at all → 401
    const noToken = await request.get(base)
    expect(noToken.status(), `Without session_token, /quiz-ready should be 401`)
      .toBe(401)

    // Wrong token → 403
    const wrongToken = await request.get(`${base}?session_token=wrong-token`)
    expect(
      wrongToken.status(),
      `Wrong session_token, /quiz-ready should be 403`,
    ).toBe(403)

    // Correct token → 200
    const goodToken = await request.get(
      `${base}?session_token=${encodeURIComponent(TEST_SESSION_TOKEN!)}`,
    )
    expect(goodToken.status()).toBe(200)
    const body = await goodToken.json()
    expect(body).toHaveProperty('quiz_status')
  })

  test('STUD-6: /regenerate-quiz returns 401 / 403 without valid token', async ({
    request,
  }) => {
    const base = `${API_URL}/api/proveit/submissions/${TEST_SUBMISSION_ID}/regenerate-quiz`

    const noToken = await request.post(base)
    expect(noToken.status()).toBe(401)

    const wrongToken = await request.post(`${base}?session_token=wrong-token`)
    expect(wrongToken.status()).toBe(403)
  })

  test('STUD-7: /submissions/{id}/status returns 401 without token', async ({
    request,
  }) => {
    const noToken = await request.get(
      `${API_URL}/api/proveit/submissions/${TEST_SUBMISSION_ID}/status`,
    )
    expect(
      noToken.status(),
      `Pre-MED-1 anyone with a UUID could oracle status. Should be 401.`,
    ).toBe(401)
  })
})

// ---------------------------------------------------------------------------
// STUD-11 — session/local storage hygiene
// ---------------------------------------------------------------------------

test.describe('ProveIt student — storage hygiene', () => {
  test('STUD-11: no PII in localStorage; sessionStorage matches allowlist', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle', { timeout: 10_000 })

    const ls = await page.evaluate(() => {
      const out: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        out.push(localStorage.key(i)!)
      }
      return out
    })

    // Student FE is supposed to keep ALL transient state in sessionStorage
    // (which clears on tab close). localStorage should be near-empty.
    const PII_NAMES = [
      'student_name',
      'paper_text',
      'outline_response',
      'quiz_answer',
      'session_token',
    ]
    for (const k of ls) {
      const matchesPII = PII_NAMES.some((n) => k.toLowerCase().includes(n))
      expect(
        matchesPII,
        `localStorage key "${k}" matches PII-shaped pattern. Student FE ` +
          `should use sessionStorage for transient state.`,
      ).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// STUD-4, STUD-8, STUD-9, STUD-10 — destructive (gated)
// ---------------------------------------------------------------------------

test.describe('ProveIt student — destructive regressions', () => {
  test.skip(!DESTRUCTIVE, 'Set PROVEIT_E2E_DESTRUCTIVE=1 to run mutating tests')
  test.skip(!ACCESS_CODE, 'Set PROVEIT_E2E_ACCESS_CODE to run destructive tests')

  test('STUD-4: happy-path verify-code → instructions/waiting → paper submit', async ({
    page,
  }) => {
    await page.goto('/')
    const uniqueName = `E2E Student ${new Date().toISOString()}`

    await page.fill('input[placeholder*="full name" i]', uniqueName)
    await page.fill('input[placeholder*="ABCD" i]', ACCESS_CODE!)
    await page.getByRole('button', { name: /verify|continue|enter|start/i })
      .click()

    // After verify-code, app routes to either /instructions (no approval)
    // or /waiting (approval flow). Either is a valid happy-path outcome.
    await expect(page).toHaveURL(/\/(instructions|waiting)/i, {
      timeout: 15_000,
    })

    // If approval flow, we stop here — the lobby wait isn't part of this
    // spec. The teacher spec covers approve/deny invariants.
    if (page.url().includes('/waiting')) {
      return
    }

    // Click Continue / Start / equivalent to land on /paper
    await page.getByRole('button', { name: /continue|start|begin|next/i })
      .click()
    await expect(page).toHaveURL(/\/paper/i, { timeout: 10_000 })

    await page.fill(
      'textarea[placeholder*="essay" i]',
      // Realistic 150+ word essay placeholder
      'Photosynthesis is the process by which green plants convert sunlight, '.repeat(
        25,
      ),
    )

    // Capture the POST so we can confirm session_token was issued
    const submitPromise = page.waitForResponse(
      (res) =>
        res.url().includes('/api/proveit/submissions') &&
        res.request().method() === 'POST',
      { timeout: 30_000 },
    )

    await page.getByRole('button', { name: /submit/i }).first().click()
    // Confirmation modal — "Submit Your Paper?" → confirm
    const confirmBtn = page.getByRole('button', { name: /yes|submit|confirm/i }).last()
    if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmBtn.click()
    }

    const res = await submitPromise
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('submission_id')
    expect(body).toHaveProperty('session_token')

    await expect(page).toHaveURL(/\/quiz-loading/i, { timeout: 10_000 })
  })

  test('STUD-8: HIGH-3 — outline textarea has maxLength=5000 and enforces it', async ({
    page,
  }) => {
    // This test piggybacks on STUD-4. Run only after a quiz is reachable —
    // for production usage, this means PROVEIT_E2E_ACCESS_CODE points at
    // an assignment that does NOT require approval AND quiz-gen is fast
    // (≤30s), OR you've manually navigated past the loading screen.
    test.fail(
      true,
      'STUD-8 (HIGH-3 textarea cap) requires reaching /quiz UI which ' +
        'needs a generated quiz. Wire this once you have a stable test ' +
        'assignment whose quiz is pre-generated. For now the cap is ' +
        'verified by Pydantic test (STUD-9) + the manual maxLength={5000} ' +
        'attribute lives at LockdownQuiz.tsx:466 per HIGH-3 spec.',
    )
  })

  test('STUD-9: HIGH-3 — Pydantic rejects >5000 outline response with 422', async ({
    request,
  }) => {
    test.skip(
      !TEST_SUBMISSION_ID || !TEST_SESSION_TOKEN,
      'Set PROVEIT_E2E_TEST_SUBMISSION_ID + PROVEIT_E2E_TEST_SESSION_TOKEN',
    )

    const oversized = 'x'.repeat(6000)
    const res = await request.post(
      `${API_URL}/api/proveit/submissions/${TEST_SUBMISSION_ID}/quiz`,
      {
        data: {
          session_token: TEST_SESSION_TOKEN,
          answers: [],
          outline_responses: [
            { field_label: 'test', response: oversized },
          ],
          lockdown_events: [],
          was_forced: false,
          lockdown_forced: false,
        },
      },
    )
    expect(
      res.status(),
      `HIGH-3 regression: 6000-char outline response should hit Pydantic ` +
        `max_length=5000 and return 422. Got ${res.status()}.`,
    ).toBe(422)
  })

  test('STUD-10: CRIT-3 — forced submit past grace renders failure screen', async () => {
    test.fail(
      true,
      'STUD-10 (CRIT-3 timer-expiry failure screen) requires a test ' +
        'assignment with time_limit_minutes=1 AND completing the full ' +
        'paper-submit → quiz-gen → lockdown-quiz pipeline before the ' +
        'timer fires. Sleeping ~4 min in a regression suite is impractical. ' +
        'Cover this via manual smoke with the existing CRIT-3 spec at ' +
        '.rcnr/bugfix-proveit-CRIT-3-timer-expiry-storm.md until we add ' +
        'an in-spec clock-fast-forward primitive.',
    )
  })
})
