import { useState, useCallback } from 'react'

interface UndoAction {
  type: 'move'
  slotId: string
  previousTeamId: string
  previousDate: string
  newTeamId: string
  newDate: string
}

const MAX_UNDO_STACK = 10

export function useUndoHistory() {
  const [stack, setStack] = useState<UndoAction[]>([])

  const pushAction = useCallback((action: UndoAction) => {
    setStack((prev) => [...prev.slice(-(MAX_UNDO_STACK - 1)), action])
  }, [])

  const popAction = useCallback((): UndoAction | null => {
    let action: UndoAction | null = null
    setStack((prev) => {
      if (prev.length === 0) return prev
      action = prev[prev.length - 1]
      return prev.slice(0, -1)
    })
    return action
  }, [])

  const canUndo = stack.length > 0

  return { pushAction, popAction, canUndo, stackSize: stack.length }
}
