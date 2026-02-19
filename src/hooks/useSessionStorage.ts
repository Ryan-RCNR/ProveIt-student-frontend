import { useState, useCallback } from 'react'
import type { QuizQuestion } from '../api/client'

export function useSessionStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.sessionStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error('Error reading from sessionStorage:', error)
      return initialValue
    }
  })

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      setStoredValue((prev) => {
        const nextValue = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value
        window.sessionStorage.setItem(key, JSON.stringify(nextValue))
        return nextValue
      })
    } catch (error) {
      console.error('Error writing to sessionStorage:', error)
    }
  }, [key])

  return [storedValue, setValue]
}

// Session data types
export interface SessionData {
  assignmentId?: string
  assignmentName?: string
  instructions?: string | null
  outlineFields?: { label: string; order: number }[]
  timeLimitMinutes?: number
  questionCount?: number
  studentName?: string
  submissionId?: string
  sessionToken?: string
  quizQuestions?: QuizQuestion[]
  startedAt?: string
}

export function useSession() {
  const [session, setSession] = useSessionStorage<SessionData>('proveit_session', {})

  const clearSession = () => {
    window.sessionStorage.removeItem('proveit_session')
    setSession({})
  }

  return { session, setSession, clearSession }
}
