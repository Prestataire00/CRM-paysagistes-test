import { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { PIPELINE_STAGES } from '../../../../utils/constants'
import { KanbanColumn } from './KanbanColumn'
import { ProspectCard } from './ProspectCard'
import type { ProspectWithMeta, PipelineStage } from '../../../../types'

interface KanbanBoardProps {
  data: Record<PipelineStage, ProspectWithMeta[]>
  counts: Record<PipelineStage, number>
  onMoveProspect: (prospectId: string, newStage: PipelineStage) => void
  onCardClick: (prospectId: string) => void
  onAddClick: (stage: PipelineStage) => void
}

export function KanbanBoard({
  data,
  counts,
  onMoveProspect,
  onCardClick,
  onAddClick,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [perduExpanded, setPerduExpanded] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 5 },
    }),
    useSensor(KeyboardSensor),
  )

  // Find the active prospect across all stages
  const activeProspect = activeId
    ? Object.values(data)
        .flat()
        .find((p) => p.id === activeId) ?? null
    : null

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id))
    // Auto-expand "perdu" column when dragging starts
    setPerduExpanded(true)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveId(null)

      if (!over) return

      const prospectId = String(active.id)
      const targetStage = String(over.id) as PipelineStage

      // Find current stage of this prospect
      let currentStage: PipelineStage | null = null
      for (const stage of Object.keys(data) as PipelineStage[]) {
        if (data[stage].some((p) => p.id === prospectId)) {
          currentStage = stage
          break
        }
      }

      if (currentStage && currentStage !== targetStage) {
        onMoveProspect(prospectId, targetStage)
      }

      // Collapse "perdu" after drag ends
      setTimeout(() => setPerduExpanded(false), 300)
    },
    [data, onMoveProspect],
  )

  const handleDragCancel = useCallback(() => {
    setActiveId(null)
    setTimeout(() => setPerduExpanded(false), 300)
  }, [])

  const activeStages = PIPELINE_STAGES.filter((s) => s.id !== 'perdu')
  const perduStage = PIPELINE_STAGES.find((s) => s.id === 'perdu')!

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {activeStages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stageId={stage.id}
            label={stage.label}
            color={stage.color}
            prospects={data[stage.id as PipelineStage] ?? []}
            totalCount={counts[stage.id as PipelineStage] ?? 0}
            onCardClick={onCardClick}
            onAddClick={() => onAddClick(stage.id as PipelineStage)}
          />
        ))}

        {/* "Perdu" column — collapsed by default */}
        <KanbanColumn
          stageId={perduStage.id}
          label={perduStage.label}
          color={perduStage.color}
          prospects={data.perdu ?? []}
          totalCount={counts.perdu ?? 0}
          collapsed={!perduExpanded}
          onToggleCollapse={() => setPerduExpanded(!perduExpanded)}
          onCardClick={onCardClick}
          onAddClick={() => onAddClick('perdu')}
        />
      </div>

      {/* Drag overlay — shows a floating clone of the dragged card */}
      <DragOverlay dropAnimation={null}>
        {activeProspect ? (
          <div className="rotate-2 opacity-90">
            <ProspectCard
              prospect={activeProspect}
              onClick={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
