import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, Monitor, Maximize, Shield, Loader2 } from 'lucide-react'
import axios from 'axios'
import { submitQuiz, submitQuizForced, reportLockdownEvent, LockdownEvent, QuizQuestion as QuizQuestionType } from '../api/client'
import { useSession } from '../hooks/useSessionStorage'
import { useLockdown, Violation } from '../hooks/useLockdown'
import { QuizTimer } from '../components/QuizTimer'
import { QuizQuestion } from '../components/QuizQuestion'

const AUTOSAVE_DEBOUNCE_MS = 1000

export function LockdownQuiz() {
  const navigate = useNavigate()
  const { session } = useSession()

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [outlineResponses, setOutlineResponses] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [forcedSubmitting, setForcedSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quizStarted, setQuizStarted] = useState(false)
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false)

  // Proper ref for violations -- survives re-renders, always current
  const violationsRef = useRef<Violation[]>([])
  // Refs for current answers so forced/auto submit always captures latest state
  const answersRef = useRef(answers)
  const outlineResponsesRef = useRef(outlineResponses)
  const submittingRef = useRef(false)

  useEffect(() => { answersRef.current = answers }, [answers])
  useEffect(() => { outlineResponsesRef.current = outlineResponses }, [outlineResponses])

  // Redirect if no session
  useEffect(() => {
    if (!session.startedAt || !session.timeLimitMinutes) {
      navigate('/')
    }
  }, [session.startedAt, session.timeLimitMinutes, navigate])

  const handleSubmit = useCallback(async (forced: boolean = false, lockdownForced: boolean = false) => {
    // Forced submits (lockdown/timer) always go through, even if already submitting
    if (submittingRef.current && !forced) return
    submittingRef.current = true

    setLoading(true)
    setError(null)
    setShowSubmitConfirm(false)

    const currentAnswers = answersRef.current
    const currentOutline = outlineResponsesRef.current

    const answersList = Object.entries(currentAnswers).map(([question_id, answer]) => ({
      question_id,
      answer,
    }))

    const outlineList = Object.entries(currentOutline).map(([field_label, response]) => ({
      field_label,
      response,
    }))

    // Convert violations to LockdownEvent format for the API
    const lockdownEvents: LockdownEvent[] = violationsRef.current.map((v) => ({
      type: v.type as LockdownEvent['type'],
      timestamp: v.timestamp,
      count: v.count,
    }))

    const navigateToComplete = (status: string) => {
      sessionStorage.setItem('proveit_submit_status', status)
      sessionStorage.removeItem('proveit_autosave')
      navigate('/complete')
    }

    if (forced) {
      setForcedSubmitting(true)
      const status = lockdownForced ? 'locked_out' : 'completed'
      try {
        // Race the submit against a 10s safety timeout.
        // The backend returns immediately (AI grading runs in background),
        // so this should resolve in <2s. If it doesn't (network issue,
        // server error), we still navigate -- the data was already saved
        // by real-time lockdown event reporting.
        await Promise.race([
          submitQuizForced(
            session.submissionId!,
            session.sessionToken!,
            answersList,
            outlineList,
            lockdownEvents,
            forced,
            lockdownForced
          ),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000)),
        ])
      } catch {
        // Even if the submit fails or times out, navigate away.
        // The submission data (answers, status) is committed server-side
        // before the response is sent, so reaching here likely means a
        // network issue rather than data loss.
      }
      navigateToComplete(status)
      return
    }

    // Non-forced: use normal axios call so we can show errors
    const submitPromise = submitQuiz(
      session.submissionId!,
      session.sessionToken!,
      answersList,
      outlineList,
      lockdownEvents,
      forced,
      lockdownForced
    )

    // Non-forced (manual) submit — no timeout, show errors to student
    try {
      const response = await submitPromise
      navigateToComplete(response.status)
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || 'Failed to submit. Please try again.')
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
      submittingRef.current = false
      setLoading(false)
    }
  }, [session.submissionId, session.sessionToken, navigate])

  const handleAutoSubmit = useCallback(() => {
    handleSubmit(true, true) // forced + lockdown-caused
  }, [handleSubmit])

  // Report each violation to the backend in real-time (fire-and-forget)
  const handleViolation = useCallback((type: string) => {
    if (session.submissionId && session.sessionToken) {
      reportLockdownEvent(
        session.submissionId,
        session.sessionToken,
        type as LockdownEvent['type']
      ).catch(() => {}) // Silently ignore -- violations are also sent at final submission
    }
  }, [session.submissionId, session.sessionToken])

  const handleTimeUp = useCallback(() => {
    handleSubmit(true, false) // forced by timer, NOT lockdown
  }, [handleSubmit])

  // Lockdown only enabled after student clicks "Enter Lockdown"
  const {
    isFullscreen,
    isMobileDevice,
    violations,
    countdown,
    enterFullscreen,
  } = useLockdown({
    onAutoSubmit: handleAutoSubmit,
    onViolation: handleViolation,
    enabled: quizStarted,
  })

  // Keep violations ref in sync
  useEffect(() => {
    violationsRef.current = violations
  }, [violations])

  // Student must click to enter fullscreen (browser requires user gesture)
  const handleStartQuiz = useCallback(async () => {
    await enterFullscreen()
    setQuizStarted(true)
  }, [enterFullscreen])

  // Auto-save to session storage (debounced)
  useEffect(() => {
    const timeout = setTimeout(() => {
      const saveData = {
        answers,
        outlineResponses,
      }
      sessionStorage.setItem('proveit_autosave', JSON.stringify(saveData))
    }, AUTOSAVE_DEBOUNCE_MS)
    return () => clearTimeout(timeout)
  }, [answers, outlineResponses])

  // Load auto-saved data
  useEffect(() => {
    const saved = sessionStorage.getItem('proveit_autosave')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        if (data.answers) setAnswers(data.answers)
        if (data.outlineResponses) setOutlineResponses(data.outlineResponses)
      } catch (e) {
        console.warn('Failed to parse autosaved data, starting fresh:', e)
      }
    }
  }, [])

  const handleAnswerChange = useCallback((questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }, [])

  if (!session.quizQuestions || !session.submissionId || !session.sessionToken || !session.startedAt || !session.timeLimitMinutes) {
    return null
  }

  // Mobile device gate
  if (isMobileDevice) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass-card rounded-xl p-8 max-w-md text-center">
          <Monitor className="w-16 h-16 text-brand mx-auto mb-4" />
          <h1 className="text-2xl font-display text-brand mb-4">Computer Required</h1>
          <p className="text-brand/50 mb-2">
            This quiz must be taken on a computer with fullscreen support.
          </p>
          <p className="text-brand/30 text-sm">
            Please open this page on a laptop or desktop computer.
          </p>
        </div>
      </div>
    )
  }

  // Lockdown entry gate -- must click to enter fullscreen (browser requires user gesture)
  if (!quizStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="glass-card rounded-xl p-8 text-center">
            <Shield className="w-16 h-16 text-brand mx-auto mb-4" />
            <h1 className="text-2xl font-display text-brand mb-2">Ready for Lockdown?</h1>
            <p className="text-brand/50 mb-6">
              Your quiz will open in fullscreen lockdown mode. The timer is already running.
            </p>

            <div className="space-y-3 text-left mb-8">
              <div className="flex items-start gap-3 p-3 bg-surface-light rounded-lg">
                <Maximize className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" />
                <p className="text-sm text-brand/70">Your browser will go fullscreen</p>
              </div>
              <div className="flex items-start gap-3 p-3 bg-surface-light rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-brand/70">Leaving fullscreen or switching tabs will auto-submit your quiz</p>
              </div>
            </div>

            <button
              onClick={handleStartQuiz}
              className="w-full px-6 py-4 btn-ice rounded-lg text-lg"
            >
              Enter Lockdown
            </button>
          </div>
        </div>
      </div>
    )
  }

  const questions = session.quizQuestions as QuizQuestionType[]
  const outlineFields = session.outlineFields || []
  const totalQuestions = questions.length
  const totalOutlineFields = outlineFields.length
  const totalItemsToAnswer = totalQuestions + totalOutlineFields
  const answeredCount = Object.keys(answers).length + Object.keys(outlineResponses).length

  return (
    <div className="min-h-screen">
      {/* Fixed Timer Header */}
      <div className="fixed top-0 left-0 right-0 bg-surface border-b border-brand/15 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <QuizTimer
              startedAt={session.startedAt}
              timeLimitMinutes={session.timeLimitMinutes}
              onTimeUp={handleTimeUp}
              onWarning={() => {}}
            />
            <span className="text-sm text-brand/50">
              {answeredCount} / {totalItemsToAnswer} answered
            </span>
          </div>

          <button
            onClick={() => setShowSubmitConfirm(true)}
            disabled={loading}
            className="px-4 py-2 btn-ice rounded-lg disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit Quiz'}
          </button>
        </div>
      </div>

      {/* Lockdown violation overlay — 5s countdown to re-enter fullscreen */}
      {countdown !== null && !isFullscreen && (
        <div className="fixed inset-0 z-[100] bg-midnight/95 flex items-center justify-center p-4" role="alertdialog" aria-label="Fullscreen required">
          <div className="glass-card rounded-xl p-8 max-w-md text-center">
            <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-2xl font-display text-brand mb-2">Lockdown Violation</h2>
            <p className="text-brand/50 mb-6">
              You left fullscreen. Re-enter now or your quiz will be submitted.
            </p>
            <div className="mb-6">
              <div className="text-5xl font-mono font-bold text-red-400">
                {countdown}
              </div>
            </div>
            <button
              onClick={enterFullscreen}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 btn-ice rounded-lg text-lg"
            >
              <Maximize className="w-5 h-5" />
              Re-enter Fullscreen
            </button>
          </div>
        </div>
      )}

      {/* In-fullscreen countdown (Alt+Tab while still technically fullscreen) */}
      {countdown !== null && isFullscreen && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100]" role="alert">
          <div className="flex items-center gap-3 px-6 py-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-400">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Focus lost. Auto-submit in {countdown}s</span>
          </div>
        </div>
      )}

      {/* Forced submit overlay -- blocks all interaction while submitting */}
      {forcedSubmitting && (
        <div className="fixed inset-0 z-[100] bg-midnight/90 flex items-center justify-center p-4">
          <div className="glass-card rounded-xl p-8 max-w-md text-center">
            <Loader2 className="w-12 h-12 text-brand mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-display text-brand mb-2">Submitting Your Quiz</h2>
            <p className="text-brand/50">
              Your answers are being sent to your teacher. Please wait.
            </p>
          </div>
        </div>
      )}

      {/* Submit Confirmation */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-[90] bg-midnight/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-card rounded-xl p-8 max-w-md w-full text-center">
            <Check className="w-12 h-12 text-brand mx-auto mb-4" />
            <h2 className="text-xl font-display text-brand mb-2">Submit Your Quiz?</h2>
            <p className="text-brand/50 mb-2">
              You've answered {answeredCount} of {totalItemsToAnswer} questions.
            </p>
            {answeredCount < totalItemsToAnswer && (
              <p className="text-sm text-yellow-400 mb-6">
                You have {totalItemsToAnswer - answeredCount} unanswered question{totalItemsToAnswer - answeredCount !== 1 ? 's' : ''}.
              </p>
            )}
            {answeredCount >= totalItemsToAnswer && (
              <p className="text-sm text-brand/40 mb-6">All questions answered.</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 px-4 py-3 rounded-lg border border-brand/20 text-brand/70 hover:bg-brand/5 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={() => {
                  setShowSubmitConfirm(false)
                  handleSubmit(false)
                }}
                disabled={loading}
                className="flex-1 px-4 py-3 btn-ice rounded-lg disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="pt-20 pb-8 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Error */}
          {error && (
            <div className="p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400">
              {error}
            </div>
          )}

          {/* Quiz Questions */}
          {questions.map((q, index) => (
            <QuizQuestion
              key={q.id}
              question={q}
              index={index}
              answer={answers[q.id]}
              onAnswerChange={handleAnswerChange}
            />
          ))}

          {/* Outline Fields */}
          {outlineFields.length > 0 && (
            <>
              <div className="pt-6">
                <h2 className="text-xl font-semibold text-brand mb-2">Reflection Questions</h2>
                <p className="text-brand/50">Answer the following questions about your paper.</p>
              </div>

              {outlineFields.map((field, index) => (
                <div key={index} className="glass-card rounded-xl p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-brand/20 text-brand rounded-full font-semibold text-sm">
                      R{index + 1}
                    </span>
                    <p className="text-white flex-1">{field.label}</p>
                    {outlineResponses[field.label] && (
                      <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                    )}
                  </div>
                  <div className="ml-12">
                    <textarea
                      value={outlineResponses[field.label] || ''}
                      onChange={(e) =>
                        setOutlineResponses({
                          ...outlineResponses,
                          [field.label]: e.target.value,
                        })
                      }
                      placeholder="Type your response..."
                      rows={4}
                      className="w-full px-4 py-3 rounded-xl bg-surface-light border border-brand/15 text-white placeholder-brand/30 focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition-colors resize-none"
                    />
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Submit Button */}
          <div className="pt-6">
            <button
              onClick={() => setShowSubmitConfirm(true)}
              disabled={loading}
              className="w-full px-6 py-4 btn-ice rounded-lg disabled:opacity-50 text-lg"
            >
              {loading ? 'Submitting...' : 'Submit Quiz'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
