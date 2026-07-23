import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'

const FIVE_MINUTES_IN_SECONDS = 300
const ONE_MINUTE_IN_SECONDS = 60
const WARNING_DISPLAY_DURATION_MS = 5000

interface QuizTimerProps {
  startedAt: string
  timeLimitMinutes: number
  onTimeUp: () => void
  onWarning: (message: string) => void
}

export function QuizTimer({
  startedAt,
  timeLimitMinutes,
  onTimeUp,
  onWarning,
}: QuizTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0)

  // Stable refs for callbacks so the interval survives parent re-renders
  // (same pattern as useLockdown -- parents may pass inline functions).
  const onTimeUpRef = useRef(onTimeUp)
  useEffect(() => {
    onTimeUpRef.current = onTimeUp
  }, [onTimeUp])

  const onWarningRef = useRef(onWarning)
  useEffect(() => {
    onWarningRef.current = onWarning
  }, [onWarning])

  // Guard against calling onTimeUp more than once.
  const timeUpFiredRef = useRef(false)

  useEffect(() => {
    const startTime = new Date(startedAt).getTime()
    const endTime = startTime + timeLimitMinutes * 60 * 1000

    let interval: ReturnType<typeof setInterval> | undefined

    const updateTimer = () => {
      const now = Date.now()
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
      setTimeRemaining(remaining)

      // Warning at 5 minutes
      if (remaining === FIVE_MINUTES_IN_SECONDS) {
        onWarningRef.current('5 minutes remaining!')
        setTimeout(() => onWarningRef.current(''), WARNING_DISPLAY_DURATION_MS)
      }

      // Warning at 1 minute
      if (remaining === ONE_MINUTE_IN_SECONDS) {
        onWarningRef.current('1 minute remaining!')
        setTimeout(() => onWarningRef.current(''), WARNING_DISPLAY_DURATION_MS)
      }

      // Auto-submit when time runs out -- fire exactly once, stop ticking
      if (remaining === 0) {
        if (interval !== undefined) clearInterval(interval)
        if (!timeUpFiredRef.current) {
          timeUpFiredRef.current = true
          onTimeUpRef.current()
        }
      }
    }

    updateTimer()
    if (!timeUpFiredRef.current) {
      interval = setInterval(updateTimer, 1000)
    }

    return () => {
      if (interval !== undefined) clearInterval(interval)
    }
  }, [startedAt, timeLimitMinutes])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${
        timeRemaining < 60
          ? 'bg-red-500/20 text-red-400'
          : timeRemaining < 300
          ? 'bg-yellow-500/20 text-yellow-400'
          : 'bg-brand/20 text-brand'
      }`}
    >
      <Clock className="w-4 h-4" />
      <span className="font-mono font-bold">{formatTime(timeRemaining)}</span>
    </div>
  )
}
