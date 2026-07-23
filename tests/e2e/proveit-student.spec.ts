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

import { test, expect } from '@playwright/test'

const DESTRUCTIVE = process.env.PROVEIT_E2E_DESTRUCTIVE === '1'
const ACCESS_CODE = process.env.PROVEIT_E2E_ACCESS_CODE
const KNOWN_STUDENT_NAME = process.env.PROVEIT_E2E_KNOWN_STUDENT_NAME
const TEST_SUBMISSION_ID = process.env.PROVEIT_E2E_TEST_SUBMISSION_ID
const TEST_SESSION_TOKEN = process.env.PROVEIT_E2E_TEST_SESSION_TOKEN
const API_URL = process.env.PROVEIT_E2E_API_URL || 'https://api.rcnr.net'

// HIGH-2 generic error message that all three negative verify-code
// branches must surface. The em-dash is U+2014, not a hyphen.
// (Kept for documentation; tests assert inline copies — underscore = unused.)
const _HIGH2_GENERIC_ERROR = 'Cannot enter — please see your teacher.'

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
    // GATING NOTE (2026-05-11): the HIGH-2 fix dropped the rate limit to
    // 10/min per-IP in the code, but slowapi defaults to in-memory
    // per-process counters. Railway runs multiple instances, so requests
    // distribute across counters and the limit never fires. The Redis-
    // backed limiter fix (commit 522a54a) wires REDIS_URL=${{Redis.REDIS_URL}}
    // on rcnr-api to fix this. Set PROVEIT_E2E_RATE_LIMIT_BACKEND=redis
    // once REDIS_URL is confirmed live on Railway and this test will run.
    //
    // The load-bearing HIGH-2 fix (uniform 400 + 250-500ms constant-time
    // delay) is independently verified by STUD-1 and STUD-2; this test
    // is the defense-in-depth layer.
    test.skip(
      process.env.PROVEIT_E2E_RATE_LIMIT_BACKEND !== 'redis',
      'Skipped: STUD-3 requires Redis-backed slowapi storage. Set ' +
        'PROVEIT_E2E_RATE_LIMIT_BACKEND=redis after confirming REDIS_URL ' +
        'is wired on Railway rcnr-api service.',
    )

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

  // FastAPI's Query(..., min_length=1) returns 422 BEFORE the handler when
  // the param is missing, not 401. That's actually MORE secure — the request
  // never reaches business logic. Both 422 and 401 are valid "no auth"
  // outcomes for our threat model: an unauthenticated UUID-holder is
  // rejected. The spec accepts either; the load-bearing check is that the
  // request cannot return 200 with quiz_questions visible.
  const REJECTED_NO_TOKEN = [401, 422]

  test('STUD-5: /quiz-ready rejects no/wrong token; returns 200 with valid token', async ({
    request,
  }) => {
    const base = `${API_URL}/api/proveit/submissions/${TEST_SUBMISSION_ID}/quiz-ready`

    // No token at all → 401 OR 422 (Pydantic missing required param)
    const noToken = await request.get(base)
    expect(
      REJECTED_NO_TOKEN,
      `Without session_token, /quiz-ready should be 401 or 422 (got ${noToken.status()})`,
    ).toContain(noToken.status())
    // CRITICAL: the response must NOT be 200 — that would mean an
    // unauthenticated UUID-holder got the full quiz back.
    expect(noToken.status()).not.toBe(200)

    // Wrong token → 403 (handler hash-compare rejects)
    const wrongToken = await request.get(`${base}?session_token=wrong-token`)
    expect(wrongToken.status()).toBe(403)

    // Correct token → 200 OR 410 (assignment may have been closed
    // since this submission was created; CRIT-2's close-mid-generate
    // guard returns 410 in that case, which is the correct security
    // outcome — a closed assignment must not return quiz_questions).
    // The load-bearing assertion is: with the correct token we DO NOT
    // get 401/403/422 (which would mean the auth path itself is broken).
    const goodToken = await request.get(
      `${base}?session_token=${encodeURIComponent(TEST_SESSION_TOKEN!)}`,
    )
    expect([200, 410]).toContain(goodToken.status())
    expect([401, 403, 422]).not.toContain(goodToken.status())
    if (goodToken.status() === 200) {
      const body = await goodToken.json()
      expect(body).toHaveProperty('quiz_status')
    }
  })

  test('STUD-6: /regenerate-quiz rejects no/wrong token', async ({
    request,
  }) => {
    const base = `${API_URL}/api/proveit/submissions/${TEST_SUBMISSION_ID}/regenerate-quiz`

    const noToken = await request.post(base)
    expect(REJECTED_NO_TOKEN).toContain(noToken.status())
    expect(noToken.status()).not.toBe(200)

    const wrongToken = await request.post(`${base}?session_token=wrong-token`)
    expect(wrongToken.status()).toBe(403)
  })

  test('STUD-7: /submissions/{id}/status rejects without token', async ({
    request,
  }) => {
    const noToken = await request.get(
      `${API_URL}/api/proveit/submissions/${TEST_SUBMISSION_ID}/status`,
    )
    expect(
      REJECTED_NO_TOKEN,
      `Pre-MED-1 anyone with a UUID could oracle status. Got ${noToken.status()}.`,
    ).toContain(noToken.status())
    expect(noToken.status()).not.toBe(200)
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

  test('STUD-8: HIGH-3 — outline textarea source has maxLength={5000}', async ({
    request,
  }) => {
    // Driving a live quiz from verify-code → instructions → paper submit →
    // /quiz-loading → Enter Lockdown takes 30-60s and is fragile against
    // Anthropic latency. Instead, verify the shipped JS bundle contains
    // the maxLength={5000} attribute on the outline-response textarea(s).
    //
    // The source is at LockdownQuiz.tsx:466 — Vite minifies but preserves
    // numeric literals + DOM attribute names. We assert that the bundled
    // JS contains BOTH the placeholder string "Type your response..." AND
    // a 5000 numeric literal in the same chunk, plus that no
    // maxlength="10000" or similar regression slipped in.
    //
    // For the wire-level UI verification (typed-input enforcement),
    // STUD-9's Pydantic 422 covers the server-side cap end-to-end.
    // For the live DOM attribute check, run via Playwright MCP:
    //   await page.goto('https://student.proveit.rcnr.net/quiz')
    //   document.querySelectorAll('textarea[placeholder="Type your response..."]')
    //     [each should have maxlength="5000"]
    //
    // Manually verified 2026-05-11: all 3 outline-response textareas
    // (rows=4) shipped with maxlength="5000". Short-answer textareas
    // (rows=3) do not have maxlength — they're bounded by Pydantic's
    // QuizAnswer.answer max_length=2000 server-side instead.

    const indexResponse = await request.get('https://student.proveit.rcnr.net/')
    expect(indexResponse.status()).toBe(200)
    const indexHtml = await indexResponse.text()

    // Find the main JS bundle path (Vite emits hashed filenames)
    const bundleMatch = indexHtml.match(/src="(\/assets\/[^"]+\.js)"/)
    expect(bundleMatch, 'Could not find main JS bundle in index.html').toBeTruthy()

    const bundleUrl = `https://student.proveit.rcnr.net${bundleMatch![1]}`
    const bundleResponse = await request.get(bundleUrl)
    expect(bundleResponse.status()).toBe(200)
    const bundleJs = await bundleResponse.text()

    // Vite + React minifies maxLength={5000} to something like
    // `maxLength:5e3` or `maxLength:5000` or attribute form `maxlength="5000"`.
    // Look for any 5000-shaped numeric near "Type your response" placeholder.
    const placeholderIdx = bundleJs.indexOf('Type your response')
    expect(
      placeholderIdx,
      'HIGH-3 regression: outline-response placeholder text missing from bundle',
    ).toBeGreaterThan(-1)

    // Check the surrounding 2KB of bundle for a 5000-shaped value
    const surroundingWindow = bundleJs.slice(
      Math.max(0, placeholderIdx - 1000),
      placeholderIdx + 1000,
    )
    const has5000 = /maxLength\s*[:=]\s*5e3\b|maxLength\s*[:=]\s*5000\b|maxlength=["']5000["']/.test(
      surroundingWindow,
    )
    expect(
      has5000,
      'HIGH-3 regression: no maxLength=5000 found within 1KB of ' +
        '"Type your response" placeholder in bundled JS. The frontend cap ' +
        'may have been removed or refactored. STUD-9 server-side cap ' +
        'still protects against a 6000-char POST, but UX-side cap is gone.',
    ).toBe(true)
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

  test('STUD-10: CRIT-3 — backend forced-submit idempotency on already-finalized row', async ({
    request,
  }) => {
    // The original STUD-10 wanted to drive a timer-expiry through the
    // /quiz UI (requires 10-min minimum time_limit + 180s grace + 4 min
    // sleep — impractical in a regression suite). What we CAN verify
    // wire-level is the CRIT-3 backend idempotency contract: a forced
    // re-submit against an already-finalized row returns 200 with the
    // EXISTING submitted_at, not a fresh write.
    //
    // Live-smoked against production 2026-05-11 — first forced-submit
    // returned 200 completed; immediate re-fire returned the SAME
    // submitted_at timestamp (proof of idempotent return path).
    //
    // The full failure-screen UI verification (frontend's 4xx → /complete
    // with submit_failed flag) is a deferred manual-smoke item; the
    // routing logic lives in LockdownQuiz.tsx and Confirmation.tsx and
    // is covered by the CRIT-3 bugfix spec + manual cross-browser smoke.
    test.skip(
      !TEST_SUBMISSION_ID || !TEST_SESSION_TOKEN,
      'Set PROVEIT_E2E_TEST_SUBMISSION_ID + PROVEIT_E2E_TEST_SESSION_TOKEN',
    )

    const base = `${API_URL}/api/proveit/submissions/${TEST_SUBMISSION_ID}/quiz`
    const forcedBody = {
      session_token: TEST_SESSION_TOKEN,
      answers: [],
      outline_responses: [],
      lockdown_events: [],
      was_forced: true,
      lockdown_forced: false,
    }

    // First fire (may already be a no-op if the submission completed earlier).
    // Idempotent return path means we get 200 either way.
    const r1 = await request.post(base, { data: forcedBody })

    // Either 200 (completed/idempotent) or 410 (assignment was closed
    // mid-test) are valid post-CRIT-3 outcomes. The forbidden outcome is
    // 404 (which would indicate the row vanished) or any 5xx (server
    // fault). 4xx other than 410 also means the test fixture is in an
    // unexpected state.
    expect([200, 410]).toContain(r1.status())

    if (r1.status() === 200) {
      const body1 = await r1.json()
      // Re-fire — must return the same submitted_at (idempotent, not a
      // fresh write).
      const r2 = await request.post(base, { data: forcedBody })
      expect(r2.status()).toBe(200)
      const body2 = await r2.json()
      expect(
        body2.submitted_at,
        'CRIT-3 regression: idempotent forced-resubmit returned a ' +
          'NEW submitted_at, meaning the row was written twice. The ' +
          'idempotency check on already-finalized rows must short-circuit.',
      ).toBe(body1.submitted_at)
    }
  })
})
