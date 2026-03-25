import { useRef, useEffect, useState, useCallback } from 'react'
import { Eraser, Check, X } from 'lucide-react'

interface SignaturePadProps {
  onConfirm: (blob: Blob) => void
  onCancel: () => void
}

export function SignaturePad({ onConfirm, onCancel }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasContent, setHasContent] = useState(false)

  // Setup canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size to match display size
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    ctx.scale(2, 2)

    // Style
    ctx.strokeStyle = '#1e293b'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    // White background
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rect.width, rect.height)

    // Cleanup: reset canvas on unmount
    return () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      canvas.width = 0
      canvas.height = 0
    }
  }, [])

  const getPos = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()

    if ('touches' in e) {
      const touch = e.touches[0]
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }, [])

  const startDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    setIsDrawing(true)
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }, [getPos])

  const draw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    if (!isDrawing) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return

    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    setHasContent(true)
  }, [isDrawing, getPos])

  const endDraw = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault()
    setIsDrawing(false)
  }, [])

  const clear = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !canvas) return

    const rect = canvas.getBoundingClientRect()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, rect.width, rect.height)
    setHasContent(false)
  }, [])

  const confirm = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.toBlob((blob) => {
      if (blob) onConfirm(blob)
    }, 'image/png')
  }, [onConfirm])

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
      <div className="bg-white w-full rounded-t-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900">Signature du client</h3>
          <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Canvas */}
        <div className="px-4 py-3">
          <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              className="w-full touch-none"
              style={{ height: 200 }}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
            />
          </div>
          <p className="text-[10px] text-slate-400 text-center mt-1">
            Signez avec votre doigt dans le cadre ci-dessus
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-4 pb-6 pt-1">
          <button
            onClick={clear}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 active:bg-slate-50 transition-colors"
          >
            <Eraser className="w-4 h-4" />
            Effacer
          </button>
          <button
            onClick={confirm}
            disabled={!hasContent}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary-600 text-white text-sm font-medium disabled:opacity-40 active:bg-primary-700 transition-colors"
          >
            <Check className="w-4 h-4" />
            Valider
          </button>
        </div>
      </div>
    </div>
  )
}
