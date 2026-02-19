/**
 * Lockdown hook — enforces fullscreen quiz environment.
 *
 * STRICT ENFORCEMENT:
 *   - Cheating attempts (copy/paste/devtools): instant auto-submit, no grace.
 *   - Environmental violations (fullscreen exit, tab switch, Alt+Tab):
 *     First violation: 5-second countdown to return. Second: instant submit.
 *
 * Blocked silently (no violation):
 *   view source (Ctrl/Cmd+U), context menu, print (Ctrl/Cmd+P)
 *
 * If a student triggers a violation by accident, the teacher
 * can reset the submission and let them re-enter.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

const DEVTOOLS_KEYS = ['I', 'J', 'C', 'K']
/** Dedup window — fullscreen exit + blur + visibility fire together for one action. */
const DEDUP_MS = 1000
/** Seconds on the countdown clock for first environmental violation. */
const COUNTDOWN_SECONDS = 5

/** Violations that trigger instant auto-submit with no grace. */
const INSTANT_VIOLATIONS = new Set([
  'paste_attempt',
  'copy_attempt',
  'cut_attempt',
  'drop_attempt',
  'devtools_attempt',
])

export interface Violation {
  type: string
  timestamp: string
  count: number
}

interface UseLockdownOptions {
  enabled: boolean
  gracePeriodMs?: number
  onAutoSubmit: () => void
}

interface UseLockdownReturn {
  isFullscreen: boolean
  isMobileDevice: boolean
  violations: Violation[]
  /** Seconds remaining on countdown, or null. */
  countdown: number | null
  enterFullscreen: () => Promise<void>
}

/** Detect mobile/tablet devices that cannot support fullscreen lockdown. */
function detectMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const hasTouch = navigator.maxTouchPoints > 0
  const isSmallScreen = window.screen.width < 1024
  const mobileUA = /Android|iPhone|iPad|iPod|webOS|BlackBerry|Opera Mini|IEMobile/i.test(
    navigator.userAgent
  )
  return mobileUA || (hasTouch && isSmallScreen)
}

export function useLockdown({
  enabled,
  gracePeriodMs = 3000,
  onAutoSubmit,
}: UseLockdownOptions): UseLockdownReturn {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [violations, setViolations] = useState<Violation[]>([])
  const [isMobileDevice] = useState(() => detectMobileDevice())
  const [countdown, setCountdown] = useState<number | null>(null)

  const graceRef = useRef(false)
  const eventCountsRef = useRef<Record<string, number>>({})
  const autoSubmittedRef = useRef(false)
  const lastViolationRef = useRef(0)
  const internalDragRef = useRef(false)
  /** How many environmental violations have occurred. */
  const envViolationCountRef = useRef(0)
  /** Countdown interval. */
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  /** Wall-clock start of countdown (prevents JS-freeze exploits). */
  const countdownStartRef = useRef(0)

  const triggerAutoSubmit = useCallback(() => {
    if (autoSubmittedRef.current) return
    autoSubmittedRef.current = true
    onAutoSubmit()
  }, [onAutoSubmit])

  const clearCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    countdownStartRef.current = 0
    setCountdown(null)
  }, [])

  const startCountdown = useCallback(() => {
    clearCountdown()
    countdownStartRef.current = Date.now()
    setCountdown(COUNTDOWN_SECONDS)

    countdownIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - countdownStartRef.current) / 1000
      const remaining = Math.max(0, Math.ceil(COUNTDOWN_SECONDS - elapsed))
      setCountdown(remaining)
      if (remaining <= 0) {
        clearCountdown()
        triggerAutoSubmit()
      }
    }, 500)
  }, [clearCountdown, triggerAutoSubmit])

  // Clean up on unmount
  useEffect(() => {
    return () => clearCountdown()
  }, [clearCountdown])

  /** Record a violation and instantly auto-submit (cheating attempts). */
  const addViolation = useCallback(
    (type: string) => {
      if (graceRef.current || autoSubmittedRef.current) return

      eventCountsRef.current[type] = (eventCountsRef.current[type] || 0) + 1
      setViolations((prev) => [...prev, {
        type,
        timestamp: new Date().toISOString(),
        count: eventCountsRef.current[type],
      }])

      if (INSTANT_VIOLATIONS.has(type)) {
        triggerAutoSubmit()
        return
      }

      // Environmental violation
      envViolationCountRef.current += 1
      if (envViolationCountRef.current > 1) {
        // Second strike — instant submit
        triggerAutoSubmit()
      } else {
        // First strike — start countdown
        startCountdown()
      }
    },
    [triggerAutoSubmit, startCountdown]
  )

  /**
   * Environmental violation with dedup.
   * Fullscreen exit + blur + visibility often fire within ms of each other
   * for a single user action. Only count the first one.
   */
  const addEnvironmentalViolation = useCallback(
    (type: string) => {
      if (graceRef.current || autoSubmittedRef.current) return
      const now = Date.now()
      if (now - lastViolationRef.current < DEDUP_MS) return
      lastViolationRef.current = now
      addViolation(type)
    },
    [addViolation]
  )

  // Enter fullscreen
  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen()
      setIsFullscreen(true)
      clearCountdown()

      // Brief grace period while browser settles into fullscreen
      graceRef.current = true
      setTimeout(() => {
        graceRef.current = false
        lastViolationRef.current = 0
      }, gracePeriodMs)
    } catch {
      setIsFullscreen(false)
    }
  }, [gracePeriodMs, clearCountdown])

  // Beforeunload — prevent accidental tab close
  useEffect(() => {
    if (!enabled) return

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [enabled])

  // All lockdown event listeners
  useEffect(() => {
    if (!enabled) return

    function handleFullscreenChange() {
      const fs = !!document.fullscreenElement
      setIsFullscreen(fs)
      if (!fs) {
        addEnvironmentalViolation('fullscreen_exit')
      }
      if (fs) {
        clearCountdown()
      }
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        addEnvironmentalViolation('tab_switch')
      }
    }

    function handleBlur() {
      addEnvironmentalViolation('window_blur')
    }

    function handlePaste(e: Event) {
      e.preventDefault()
      addViolation('paste_attempt')
    }

    function handleCopy(e: Event) {
      e.preventDefault()
      addViolation('copy_attempt')
    }

    function handleCut(e: Event) {
      e.preventDefault()
      addViolation('cut_attempt')
    }

    function handleDragStart() {
      internalDragRef.current = true
    }

    function handleDragEnd() {
      internalDragRef.current = false
    }

    function handleDrop(e: DragEvent) {
      if (internalDragRef.current) {
        internalDragRef.current = false
        return
      }
      e.preventDefault()
      addViolation('drop_attempt')
    }

    function handleDragOver(e: DragEvent) {
      e.preventDefault()
    }

    function handleKeydown(e: KeyboardEvent) {
      const modKey = e.ctrlKey || e.metaKey

      if (e.key === 'F12') {
        e.preventDefault()
        addViolation('devtools_attempt')
        return
      }
      if (modKey && e.shiftKey && DEVTOOLS_KEYS.includes(e.key.toUpperCase())) {
        e.preventDefault()
        addViolation('devtools_attempt')
        return
      }
      if (modKey && e.key.toLowerCase() === 'u') {
        e.preventDefault()
        return
      }
      if (modKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        return
      }
    }

    function handleContextMenu(e: MouseEvent) {
      e.preventDefault()
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)
    document.addEventListener('paste', handlePaste)
    document.addEventListener('copy', handleCopy)
    document.addEventListener('cut', handleCut)
    document.addEventListener('dragstart', handleDragStart)
    document.addEventListener('dragend', handleDragEnd)
    document.addEventListener('drop', handleDrop)
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('keydown', handleKeydown)
    document.addEventListener('contextmenu', handleContextMenu)

    document.body.classList.add('lockdown-mode')

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('paste', handlePaste)
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('cut', handleCut)
      document.removeEventListener('dragstart', handleDragStart)
      document.removeEventListener('dragend', handleDragEnd)
      document.removeEventListener('drop', handleDrop)
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('keydown', handleKeydown)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.body.classList.remove('lockdown-mode')
    }
  }, [enabled, addViolation, addEnvironmentalViolation, clearCountdown])

  return {
    isFullscreen,
    isMobileDevice,
    violations,
    countdown,
    enterFullscreen,
  }
}
