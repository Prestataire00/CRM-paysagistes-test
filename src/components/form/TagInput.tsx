import { useState, useRef } from 'react'
import { X, Plus, Loader2 } from 'lucide-react'
import { cn } from '../../utils/cn'
import { useClickOutside } from '../../hooks/useClickOutside'
import type { ClientTag } from '../../types'

interface TagInputProps {
  availableTags: ClientTag[]
  selectedTagIds: string[]
  onChange: (tagIds: string[]) => void
  onCreateTag?: (name: string) => void
  isLoading?: boolean
  label?: string
}

export function TagInput({
  availableTags,
  selectedTagIds,
  onChange,
  onCreateTag,
  isLoading,
  label,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useClickOutside(containerRef, () => setIsOpen(false))

  const selectedTags = availableTags.filter((t) => selectedTagIds.includes(t.id))
  const filteredTags = availableTags.filter(
    (t) =>
      !selectedTagIds.includes(t.id) &&
      t.name.toLowerCase().includes(inputValue.toLowerCase()),
  )
  const canCreate =
    inputValue.trim().length > 0 &&
    !availableTags.some((t) => t.name.toLowerCase() === inputValue.trim().toLowerCase())

  const handleRemoveTag = (tagId: string) => {
    onChange(selectedTagIds.filter((id) => id !== tagId))
  }

  const handleSelectTag = (tagId: string) => {
    onChange([...selectedTagIds, tagId])
    setInputValue('')
    setIsOpen(false)
  }

  const handleCreate = () => {
    if (canCreate && onCreateTag) {
      onCreateTag(inputValue.trim())
      setInputValue('')
      setIsOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
      )}

      {/* Selected tags chips */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag.id)}
                className="ml-0.5 hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input + dropdown */}
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Rechercher ou créer un tag..."
          className={cn(
            'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900',
            'placeholder:text-slate-400 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-green-500 focus:ring-green-500/20',
          )}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
        )}

        {isOpen && (filteredTags.length > 0 || canCreate) && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 max-h-48 overflow-y-auto">
            {filteredTags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => handleSelectTag(tag.id)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </button>
            ))}
            {canCreate && onCreateTag && (
              <button
                type="button"
                onClick={handleCreate}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-primary-600 hover:bg-primary-50 transition-colors border-t border-slate-100"
              >
                <Plus className="w-3.5 h-3.5" />
                Créer « {inputValue.trim()} »
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
