import { useEffect, useRef, useCallback } from 'react'
import { LockdownEvent } from '../api/client'

interface UseLockdownOptions {
  onEvent: (event: LockdownEvent) => void
  enabled: boolean
}

export function useLockdown({ onEvent, enabled }: UseLockdownOptions) {
  const eventCounts = useRef<Record<string, number>>({})

  const recordEvent = useCallback(
    (type: LockdownEvent['type']) => {
      eventCounts.current[type] = (eventCounts.current[type] || 0) + 1
      onEvent({
        type,
        timestamp: new Date().toISOString(),
        count: eventCounts.current[type],
      })
    },
    [onEvent]
  )

  useEffect(() => {
    if (!enabled) return

    // Visibility change (tab switch)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordEvent('tab_switch')
      }
    }

    // Window blur (clicking outside)
    const handleBlur = () => {
      recordEvent('window_blur')
    }

    // Copy prevention
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault()
      recordEvent('copy_attempt')
    }

    // Paste prevention
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault()
      recordEvent('paste_attempt')
    }

    // Keyboard shortcuts prevention
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent common shortcuts
      if (
        (e.ctrlKey || e.metaKey) &&
        ['c', 'v', 'a', 'f', 'p'].includes(e.key.toLowerCase())
      ) {
        // Allow in input/textarea
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          // Only allow in text inputs
          if (e.key.toLowerCase() !== 'c' && e.key.toLowerCase() !== 'v') {
            return
          }
        }
        e.preventDefault()
        if (e.key.toLowerCase() === 'c') recordEvent('copy_attempt')
        if (e.key.toLowerCase() === 'v') recordEvent('paste_attempt')
      }
    }

    // Context menu prevention
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleBlur)
    document.addEventListener('copy', handleCopy)
    document.addEventListener('paste', handlePaste)
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('contextmenu', handleContextMenu)

    // Add lockdown class to body
    document.body.classList.add('lockdown-mode')

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('copy', handleCopy)
      document.removeEventListener('paste', handlePaste)
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('contextmenu', handleContextMenu)
      document.body.classList.remove('lockdown-mode')
    }
  }, [enabled, recordEvent])

  return {
    getTotalViolations: () =>
      Object.values(eventCounts.current).reduce((a, b) => a + b, 0),
  }
}
