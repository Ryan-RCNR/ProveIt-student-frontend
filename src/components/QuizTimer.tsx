import { useEffect, useState } from 'react'
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

  useEffect(() => {
    const startTime = new Date(startedAt).getTime()
    const endTime = startTime + timeLimitMinutes * 60 * 1000

    const updateTimer = () => {
      const now = Date.now()
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000))
      setTimeRemaining(remaining)

      // Warning at 5 minutes
      if (remaining === FIVE_MINUTES_IN_SECONDS) {
        onWarning('5 minutes remaining!')
        setTimeout(() => onWarning(''), WARNING_DISPLAY_DURATION_MS)
      }

      // Warning at 1 minute
      if (remaining === ONE_MINUTE_IN_SECONDS) {
        onWarning('1 minute remaining!')
        setTimeout(() => onWarning(''), WARNING_DISPLAY_DURATION_MS)
      }

      // Auto-submit when time runs out
      if (remaining === 0) {
        onTimeUp()
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [startedAt, timeLimitMinutes, onTimeUp, onWarning])

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
          : 'bg-ice/20 text-ice'
      }`}
    >
      <Clock className="w-4 h-4" />
      <span className="font-mono font-bold">{formatTime(timeRemaining)}</span>
    </div>
  )
}
