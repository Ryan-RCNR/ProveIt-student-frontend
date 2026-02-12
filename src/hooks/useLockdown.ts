/**
 * Lockdown hook — enforces fullscreen quiz environment.
 *
 * Two-tier violation policy:
 *
 * INSTANT AUTO-SUBMIT (cheating attempts — never accidental):
 *   copy, cut, paste, external drop, devtools shortcuts
 *
 * 1-STRIKE LIMIT (environmental — can be accidental once):
 *   fullscreen exit, tab switch, window blur
 *   First exit starts a 10-second wall-clock countdown to re-enter.
 *   Second exit (or countdown expiry) → instant auto-submit.
 *
 * Also blocked (no violation, just prevented):
 *   view source (Ctrl/Cmd+U), context menu
 *
 * The countdown uses wall-clock timestamps (Date.now()) so freezing
 * JS execution (e.g. via browser task manager) cannot buy extra time.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

const WARNING_DISPLAY_MS = 5000
const DEVTOOLS_KEYS = ['I', 'J', 'C', 'K'] // K = Firefox console
/** After a fullscreen exit, suppress blur violations for this window (ms). */
const BLUR_SUPPRESS_AFTER_FS_EXIT_MS = 500
/** Seconds the student has to re-enter fullscreen before auto-submit. */
const FULLSCREEN_REENTRY_SECONDS = 10
/** Maximum environmental violations before auto-submit. */
const MAX_ENVIRONMENTAL_VIOLATIONS = 1

/** Violations that trigger instant auto-submit. */
const INSTANT_SUBMIT_VIOLATIONS = new Set([
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
  warning: string | null
  /** Seconds remaining to re-enter fullscreen, or null if in fullscreen. */
  fullscreenCountdown: number | null
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
  gracePeriodMs = 5000,
  onAutoSubmit,
}: UseLockdownOptions): UseLockdownReturn {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [violations, setViolations] = useState<Violation[]>([])
  const [warning, setWarning] = useState<string | null>(null)
  const [isMobileDevice] = useState(() => detectMobileDevice())
  const [fullscreenCountdown, setFullscreenCountdown] = useState<number | null>(null)
  const graceRef = useRef(false)
  const violationCountRef = useRef(0)
  const eventCountsRef = useRef<Record<string, number>>({})
  /** Timestamp of last fullscreen exit — used to suppress the blur that follows it. */
  const lastFsExitRef = useRef(0)
  /** Interval ID for the fullscreen re-entry countdown. */
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  /** Wall-clock timestamp when countdown started — prevents JS freeze exploits. */
  const countdownStartRef = useRef(0)
  /** Guard against calling onAutoSubmit more than once. */
  const autoSubmittedRef = useRef(false)
  /** Tracks whether a drag started inside the page (internal rearrange = OK). */
  const internalDragRef = useRef(false)

  const triggerAutoSubmit = useCallback(() => {
    if (autoSubmittedRef.current) return
    autoSubmittedRef.current = true
    onAutoSubmit()
  }, [onAutoSubmit])

  // --- Fullscreen countdown timer (wall-clock based) ---
  const clearCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    countdownStartRef.current = 0
    setFullscreenCountdown(null)
  }, [])

  const startCountdown = useCallback(() => {
    clearCountdown()
    countdownStartRef.current = Date.now()
    setFullscreenCountdown(FULLSCREEN_REENTRY_SECONDS)

    countdownIntervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - countdownStartRef.current) / 1000
      const remaining = Math.max(0, Math.ceil(FULLSCREEN_REENTRY_SECONDS - elapsed))
      setFullscreenCountdown(remaining)
      if (remaining <= 0) {
        clearCountdown()
        triggerAutoSubmit()
      }
    }, 500) // Check every 500ms for smoother display + faster freeze detection
  }, [clearCountdown, triggerAutoSubmit])

  // Clean up countdown on unmount
  useEffect(() => {
    return () => clearCountdown()
  }, [clearCountdown])

  const addViolation = useCallback(
    (type: string) => {
      if (graceRef.current) return

      eventCountsRef.current[type] = (eventCountsRef.current[type] || 0) + 1
      const v: Violation = {
        type,
        timestamp: new Date().toISOString(),
        count: eventCountsRef.current[type],
      }
      setViolations((prev) => [...prev, v])

      // Instant submit for cheating attempts
      if (INSTANT_SUBMIT_VIOLATIONS.has(type)) {
        setWarning('Your quiz has been submitted.')
        triggerAutoSubmit()
        return
      }

      // Environmental violations: 1 strike, then you're out
      violationCountRef.current += 1

      if (violationCountRef.current > MAX_ENVIRONMENTAL_VIOLATIONS) {
        // Second environmental violation — instant submit, no countdown
        setWarning('Your quiz has been submitted.')
        triggerAutoSubmit()
      } else {
        setWarning('Warning: leave again and your quiz will be auto-submitted.')
        setTimeout(() => setWarning(null), WARNING_DISPLAY_MS)
      }
    },
    [triggerAutoSubmit]
  )

  // Enter fullscreen
  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen()
      setIsFullscreen(true)
      clearCountdown()

      // Start grace period
      graceRef.current = true
      setTimeout(() => {
        graceRef.current = false
      }, gracePeriodMs)
    } catch {
      // Fullscreen not supported or denied — start countdown
      setIsFullscreen(false)
      startCountdown()
    }
  }, [gracePeriodMs, clearCountdown, startCountdown])

  // Beforeunload — prevent accidental tab close / navigation
  useEffect(() => {
    if (!enabled) return

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    // Fullscreen change handler
    function handleFullscreenChange() {
      const fs = !!document.fullscreenElement
      setIsFullscreen(fs)
      if (!fs && !graceRef.current) {
        lastFsExitRef.current = Date.now()
        addViolation('fullscreen_exit')
        // Only start countdown if this was the first violation
        if (violationCountRef.current <= MAX_ENVIRONMENTAL_VIOLATIONS) {
          startCountdown()
        }
      }
      if (fs) {
        clearCountdown()
      }
    }

    // Visibility change (tab switch)
    function handleVisibilityChange() {
      if (document.hidden && !graceRef.current) {
        addViolation('tab_switch')
      }
    }

    // Window blur (Alt+Tab, etc.)
    // Suppressed briefly after fullscreen exit to avoid double-counting.
    function handleBlur() {
      if (graceRef.current) return
      if (Date.now() - lastFsExitRef.current < BLUR_SUPPRESS_AFTER_FS_EXIT_MS) return
      addViolation('window_blur')
    }

    // Block paste — instant submit
    function handlePaste(e: Event) {
      e.preventDefault()
      addViolation('paste_attempt')
    }

    // Block copy & cut — instant submit
    function handleCopy(e: Event) {
      e.preventDefault()
      addViolation('copy_attempt')
    }

    function handleCut(e: Event) {
      e.preventDefault()
      addViolation('cut_attempt')
    }

    // Drag/drop: allow internal rearranging, block external drops.
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

    // Block DevTools shortcuts (Ctrl AND Cmd for Mac support) — instant submit
    function handleKeydown(e: KeyboardEvent) {
      const modKey = e.ctrlKey || e.metaKey

      // F12
      if (e.key === 'F12') {
        e.preventDefault()
        addViolation('devtools_attempt')
        return
      }
      // Ctrl/Cmd+Shift+I / J / C / K
      if (modKey && e.shiftKey && DEVTOOLS_KEYS.includes(e.key.toUpperCase())) {
        e.preventDefault()
        addViolation('devtools_attempt')
        return
      }
      // Ctrl/Cmd+U (view source) — blocked silently, no violation
      if (modKey && e.key.toLowerCase() === 'u') {
        e.preventDefault()
        return
      }
      // Block print (Ctrl+P)
      if (modKey && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        return
      }
    }

    // Context menu prevention
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

    // Add lockdown class to body
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
  }, [enabled, addViolation, startCountdown, clearCountdown])

  return {
    isFullscreen,
    isMobileDevice,
    violations,
    warning,
    fullscreenCountdown,
    enterFullscreen,
  }
}
