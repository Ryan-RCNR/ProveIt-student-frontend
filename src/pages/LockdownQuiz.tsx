import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, AlertTriangle, Check } from 'lucide-react'
import { submitQuiz, LockdownEvent, QuizQuestion } from '../api/client'
import { useSession } from '../hooks/useSessionStorage'
import { useLockdown } from '../hooks/useLockdown'

export function LockdownQuiz() {
  const navigate = useNavigate()
  const { session } = useSession()

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [outlineResponses, setOutlineResponses] = useState<Record<string, string>>({})
  const [lockdownEvents, setLockdownEvents] = useState<LockdownEvent[]>([])
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [warning, setWarning] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize timer
  useEffect(() => {
    if (!session.startedAt || !session.timeLimitMinutes) {
      navigate('/')
      return
    }

    const startTime = new Date(session.startedAt).getTime()
    const endTime = startTime + session.timeLimitMinutes * 60 * 1000

    const updateTimer = () => {
      const now = Date.now()
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
      setTimeRemaining(remaining)

      // Warning at 5 minutes
      if (remaining === 300) {
        setWarning('5 minutes remaining!')
        setTimeout(() => setWarning(null), 5000)
      }

      // Warning at 1 minute
      if (remaining === 60) {
        setWarning('1 minute remaining!')
        setTimeout(() => setWarning(null), 5000)
      }

      // Auto-submit when time runs out
      if (remaining === 0) {
        handleSubmit(true)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [session.startedAt, session.timeLimitMinutes])

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

  // Auto-save to session storage
  useEffect(() => {
    const saveData = {
      answers,
      outlineResponses,
    }
    sessionStorage.setItem('proveit_autosave', JSON.stringify(saveData))
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
        // Ignore parse errors
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
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to submit. Please try again.')
      setLoading(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!session.quizQuestions || !session.submissionId) {
    return null
  }

  const questions = session.quizQuestions as QuizQuestion[]
  const outlineFields = session.outlineFields || []
  const totalItems = questions.length + outlineFields.length
  const answeredItems = Object.keys(answers).length + Object.keys(outlineResponses).length

  return (
    <div className="min-h-screen bg-midnight">
      {/* Fixed Timer Header */}
      <div className="fixed top-0 left-0 right-0 bg-deep-sea border-b border-white/10 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
                timeRemaining < 60
                  ? 'bg-red-500/20 text-red-400'
                  : timeRemaining < 300
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-ice/20 text-ice'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span className="font-mono font-bold">{formatTime(timeRemaining)}</span>
            </div>
            <span className="text-sm text-gray-400">
              {answeredItems} / {totalItems} answered
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
            <div key={q.id} className="glass rounded-xl p-6">
              <div className="flex items-start gap-4 mb-4">
                <span className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-ice/20 text-ice rounded-full font-semibold text-sm">
                  {index + 1}
                </span>
                <div className="flex-1">
                  <span className="text-xs text-gray-400 uppercase mb-2 block">
                    {q.type === 'mc' ? 'Multiple Choice' : 'Short Answer'}
                  </span>
                  <p className="text-white text-lg">{q.question}</p>
                </div>
                {answers[q.id] && (
                  <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
                )}
              </div>

              {q.type === 'mc' && q.options ? (
                <div className="space-y-2 ml-12">
                  {q.options.map((opt) => (
                    <label
                      key={opt.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        answers[q.id] === opt.id
                          ? 'bg-ice/20 border border-ice/50'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={opt.id}
                        checked={answers[q.id] === opt.id}
                        onChange={() => setAnswers({ ...answers, [q.id]: opt.id })}
                        className="sr-only"
                      />
                      <span
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          answers[q.id] === opt.id
                            ? 'border-ice bg-ice'
                            : 'border-gray-500'
                        }`}
                      >
                        {answers[q.id] === opt.id && (
                          <Check className="w-4 h-4 text-deep-sea" />
                        )}
                      </span>
                      <span className="text-gray-300">{opt.text}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="ml-12">
                  <textarea
                    value={answers[q.id] || ''}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    placeholder="Type your answer..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-ice focus:ring-1 focus:ring-ice focus:outline-none transition-colors resize-none"
                  />
                </div>
              )}
            </div>
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
