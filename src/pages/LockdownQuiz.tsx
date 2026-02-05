import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check } from 'lucide-react'
import axios from 'axios'
import { submitQuiz, LockdownEvent, QuizQuestion as QuizQuestionType } from '../api/client'
import { useSession } from '../hooks/useSessionStorage'
import { useLockdown } from '../hooks/useLockdown'
import { QuizTimer } from '../components/QuizTimer'
import { QuizQuestion } from '../components/QuizQuestion'

const AUTOSAVE_DEBOUNCE_MS = 1000

export function LockdownQuiz() {
  const navigate = useNavigate()
  const { session } = useSession()

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [outlineResponses, setOutlineResponses] = useState<Record<string, string>>({})
  const [lockdownEvents, setLockdownEvents] = useState<LockdownEvent[]>([])
  const [warning, setWarning] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Redirect if no session
  useEffect(() => {
    if (!session.startedAt || !session.timeLimitMinutes) {
      navigate('/')
    }
  }, [session.startedAt, session.timeLimitMinutes, navigate])

  const handleTimeUp = useCallback(() => {
    handleSubmit(true)
  }, [])

  const handleTimerWarning = useCallback((message: string) => {
    if (message) {
      setWarning(message)
    } else {
      setWarning(null)
    }
  }, [])

  // Lockdown
  const handleLockdownEvent = useCallback((event: LockdownEvent) => {
    setLockdownEvents((prev) => [...prev, event])

    // Show warning
    const messages: Record<string, string> = {
      tab_switch: 'Tab switch detected',
      window_blur: 'Window unfocused',
      copy_attempt: 'Copy is disabled',
      paste_attempt: 'Paste is disabled',
    }
    setWarning(messages[event.type] || 'Lockdown violation detected')
    setTimeout(() => setWarning(null), 3000)
  }, [])

  useLockdown({
    onEvent: handleLockdownEvent,
    enabled: true,
  })

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

  const handleSubmit = async (forced: boolean = false) => {
    if (loading) return

    setLoading(true)
    setError(null)

    try {
      const answersList = Object.entries(answers).map(([question_id, answer]) => ({
        question_id,
        answer,
      }))

      const outlineList = Object.entries(outlineResponses).map(([field_label, response]) => ({
        field_label,
        response,
      }))

      await submitQuiz(
        session.submissionId!,
        answersList,
        outlineList,
        lockdownEvents,
        forced
      )

      // Clear auto-save
      sessionStorage.removeItem('proveit_autosave')

      navigate('/complete')
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || 'Failed to submit. Please try again.')
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
      setLoading(false)
    }
  }

  const handleAnswerChange = useCallback((questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }, [])

  if (!session.quizQuestions || !session.submissionId || !session.startedAt || !session.timeLimitMinutes) {
    return null
  }

  const questions = session.quizQuestions as QuizQuestionType[]
  const outlineFields = session.outlineFields || []
  const totalQuestions = questions.length
  const totalOutlineFields = outlineFields.length
  const totalItemsToAnswer = totalQuestions + totalOutlineFields
  const answeredCount = Object.keys(answers).length + Object.keys(outlineResponses).length

  return (
    <div className="min-h-screen bg-midnight">
      {/* Fixed Timer Header */}
      <div className="fixed top-0 left-0 right-0 bg-deep-sea border-b border-white/10 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <QuizTimer
              startedAt={session.startedAt}
              timeLimitMinutes={session.timeLimitMinutes}
              onTimeUp={handleTimeUp}
              onWarning={handleTimerWarning}
            />
            <span className="text-sm text-gray-400">
              {answeredCount} / {totalItemsToAnswer} answered
            </span>
          </div>

          <button
            onClick={() => handleSubmit(false)}
            disabled={loading}
            className="px-4 py-2 bg-ice text-deep-sea font-semibold rounded-lg hover:bg-ice-muted transition-colors disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit Quiz'}
          </button>
        </div>
      </div>

      {/* Warning Toast */}
      {warning && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-pulse">
          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-yellow-400">
            <AlertTriangle className="w-4 h-4" />
            {warning}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="pt-20 pb-8 px-4">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Error */}
          {error && (
            <div className="p-4 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400">
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
                <h2 className="text-xl font-semibold text-white mb-2">Reflection Questions</h2>
                <p className="text-gray-400">Answer the following questions about your paper.</p>
              </div>

              {outlineFields.map((field, index) => (
                <div key={index} className="glass rounded-xl p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-ice-muted/20 text-ice-muted rounded-full font-semibold text-sm">
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
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-ice focus:ring-1 focus:ring-ice focus:outline-none transition-colors resize-none"
                    />
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Submit Button */}
          <div className="pt-6">
            <button
              onClick={() => handleSubmit(false)}
              disabled={loading}
              className="w-full px-6 py-4 bg-ice text-deep-sea font-semibold rounded-lg hover:bg-ice-muted transition-colors disabled:opacity-50 text-lg"
            >
              {loading ? 'Submitting...' : 'Submit Quiz'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
