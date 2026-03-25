import { brand } from '../config/brand'
import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'

export interface Entity {
  id: string
  label: string
  shortLabel: string
}

const ENTITIES: Entity[] = [
  { id: brand.slug, label: brand.name, shortLabel: brand.slug.toUpperCase().slice(0,2) },
  { id: 'thomas', label: 'Thomas Services', shortLabel: 'TS' },
]

interface EntityContextType {
  entities: Entity[]
  currentEntity: Entity
  setCurrentEntity: (entity: Entity) => void
}

const EntityContext = createContext<EntityContextType | null>(null)

export function EntityProvider({ children }: { children: ReactNode }) {
  const [currentEntity, setCurrentEntityState] = useState<Entity>(() => {
    try {
      const saved = localStorage.getItem('selected-entity')
      return ENTITIES.find((e) => e.id === saved) ?? ENTITIES[0]
    } catch {
      return ENTITIES[0]
    }
  })

  const setCurrentEntity = useCallback((entity: Entity) => {
    setCurrentEntityState(entity)
    localStorage.setItem('selected-entity', entity.id)
  }, [])

  const value = useMemo(() => ({
    entities: ENTITIES, currentEntity, setCurrentEntity,
  }), [currentEntity, setCurrentEntity])

  return (
    <EntityContext.Provider value={value}>
      {children}
    </EntityContext.Provider>
  )
}

export function useEntity() {
  const ctx = useContext(EntityContext)
  if (!ctx) throw new Error('useEntity must be used within EntityProvider')
  return ctx
}
