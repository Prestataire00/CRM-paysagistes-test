import { useEffect } from 'react'

interface ShortcutHandlers {
  onNewIntervention?: () => void
  onSearch?: () => void
  onUndo?: () => void
  onEscape?: () => void
}

export function useKeyboardShortcuts({
  onNewIntervention,
  onSearch,
  onUndo,
  onEscape,
}: ShortcutHandlers) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture shortcuts when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape' && onEscape) {
          onEscape()
        }
        return
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'n':
            e.preventDefault()
            onNewIntervention?.()
            break
          case 'f':
            e.preventDefault()
            onSearch?.()
            break
          case 'z':
            e.preventDefault()
            onUndo?.()
            break
        }
        return
      }

      if (e.key === 'Escape') {
        onEscape?.()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onNewIntervention, onSearch, onUndo, onEscape])
}
