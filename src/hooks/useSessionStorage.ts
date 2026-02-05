import { useState, useEffect } from 'react'

export function useSessionStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.sessionStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      console.error('Error reading from sessionStorage:', error)
      return initialValue
    }
  })

  const setValue = (value: T) => {
    try {
      setStoredValue(value)
      window.sessionStorage.setItem(key, JSON.stringify(value))
    } catch (error) {
      console.error('Error writing to sessionStorage:', error)
    }
  }

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
  quizQuestions?: any[]
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
