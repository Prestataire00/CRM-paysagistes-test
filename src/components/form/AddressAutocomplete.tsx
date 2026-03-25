import { useState, useEffect, useRef } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import { cn } from '../../utils/cn'
import { useClickOutside } from '../../hooks/useClickOutside'

export interface AddressResult {
  label: string
  address_line1: string
  postal_code: string
  city: string
  latitude: number
  longitude: number
}

interface AddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect: (result: AddressResult) => void
  label?: string
  error?: string
  placeholder?: string
}

interface BanFeature {
  properties: {
    label: string
    name: string
    postcode: string
    city: string
  }
  geometry: {
    coordinates: [number, number]
  }
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  label,
  error,
  placeholder = 'Saisissez une adresse...',
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<BanFeature[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useClickOutside(containerRef, () => setIsOpen(false))

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value || value.length < 3) {
      setSuggestions([])
      setIsOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true)
      try {
        const res = await fetch(
          `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(value)}&limit=5`,
        )
        const data = await res.json()
        const features = (data.features ?? []) as BanFeature[]
        setSuggestions(features)
        setIsOpen(features.length > 0)
        setActiveIndex(-1)
      } catch {
        setSuggestions([])
      } finally {
        setIsLoading(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value])

  const handleSelect = (feature: BanFeature) => {
    const result: AddressResult = {
      label: feature.properties.label,
      address_line1: feature.properties.name,
      postal_code: feature.properties.postcode,
      city: feature.properties.city,
      longitude: feature.geometry.coordinates[0],
      latitude: feature.geometry.coordinates[1],
    }
    onChange(result.address_line1)
    onSelect(result)
    setIsOpen(false)
    setSuggestions([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
      return
    }
    if (e.key === 'Enter' && activeIndex >= 0 && suggestions[activeIndex]) {
      e.preventDefault()
      handleSelect(suggestions[activeIndex])
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value)
            setIsOpen(true)
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            'block w-full rounded-lg border bg-white pl-9 pr-8 py-2 text-sm text-slate-900',
            'placeholder:text-slate-400 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-offset-0',
            error
              ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20'
              : 'border-slate-300 focus:border-green-500 focus:ring-green-500/20',
          )}
          aria-invalid={error ? 'true' : undefined}
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 animate-spin" />
        )}
      </div>
      {error && (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      )}

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
          {suggestions.map((feature, idx) => (
            <button
              key={`${feature.properties.label}-${idx}`}
              type="button"
              onClick={() => handleSelect(feature)}
              className={cn(
                'flex items-center gap-2 w-full px-3 py-2.5 text-left text-sm transition-colors',
                idx === activeIndex ? 'bg-primary-50 text-primary-700' : 'text-slate-700 hover:bg-slate-50',
              )}
            >
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>{feature.properties.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
