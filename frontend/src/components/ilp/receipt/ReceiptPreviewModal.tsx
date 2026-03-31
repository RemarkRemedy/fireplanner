// frontend/src/components/ilp/receipt/ReceiptPreviewModal.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toBlob } from 'html-to-image'
import { Download, Share2, Copy, Check } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { IlpPolicyInput, IlpProjectedPolicyAnalysis } from '@/lib/calculations/ilp'
import type { IlpFeeBreakdownResult } from '@/lib/calculations/ilpFeeBreakdown'
import { ReceiptCanvas } from './ReceiptCanvas'
import { computeReceiptData } from '@/lib/calculations/ilpReceiptData'
import { RECEIPT_DIMENSIONS, type ReceiptFormat } from '@/lib/data/ilpReceiptConstants'

interface ReceiptPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  policy: IlpPolicyInput
  analysis: IlpProjectedPolicyAnalysis
  feeBreakdown: IlpFeeBreakdownResult
  includeOcf: boolean
  defaultUseReal?: boolean
}

const FORMAT_OPTIONS: { value: ReceiptFormat; label: string }[] = [
  { value: 'story', label: 'Story (9:16)' },
  { value: 'square', label: 'Square (1:1)' },
]

async function generateBlob(node: HTMLDivElement): Promise<Blob> {
  await document.fonts.ready
  const blob = await toBlob(node, { cacheBust: true })
  if (!blob) throw new Error('Failed to generate receipt image')
  return blob
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}

export function ReceiptPreviewModal({
  open,
  onOpenChange,
  policy,
  analysis,
  feeBreakdown,
  includeOcf,
  defaultUseReal = true,
}: ReceiptPreviewModalProps) {
  const [format, setFormat] = useState<ReceiptFormat>('story')
  const [useReal, setUseReal] = useState(defaultUseReal)
  const [isGenerating, setIsGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setUseReal(defaultUseReal)
    }
  }, [open, defaultUseReal])

  const receiptData = useMemo(
    () => computeReceiptData(policy, analysis, feeBreakdown, includeOcf, useReal),
    [policy, analysis, feeBreakdown, includeOcf, useReal],
  )
  const dims = RECEIPT_DIMENSIONS[format]
  const previewScale = Math.min(360 / dims.width, 640 / dims.height)

  const canShare = typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator
  const canCopy = typeof navigator !== 'undefined' && 'clipboard' in navigator && 'write' in navigator.clipboard

  const handleDownload = useCallback(async () => {
    if (!canvasRef.current) return
    setIsGenerating(true)
    try {
      const blob = await generateBlob(canvasRef.current)
      downloadBlob(blob, `ilp-receipt-${format}.png`)
    } catch {
      // Download is the primary action — if it fails, there's no fallback
    } finally {
      setIsGenerating(false)
    }
  }, [format])

  const handleShare = useCallback(async () => {
    if (!canvasRef.current) return
    setIsGenerating(true)
    try {
      const blob = await generateBlob(canvasRef.current)
      const filename = `ilp-receipt-${format}.png`
      const file = new File([blob], filename, { type: 'image/png' })
      try {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] })
        } else {
          downloadBlob(blob, filename)
        }
      } catch (err) {
        // AbortError means user dismissed the share sheet
        if (err instanceof Error && err.name !== 'AbortError') {
          downloadBlob(blob, filename)
        }
      }
    } finally {
      setIsGenerating(false)
    }
  }, [format])

  const handleCopy = useCallback(async () => {
    if (!canvasRef.current) return
    setIsGenerating(true)
    try {
      const blob = await generateBlob(canvasRef.current)
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ])
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard write failed — silently fall back (button stays as "Copy")
    } finally {
      setIsGenerating(false)
    }
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Your ILP Receipt</DialogTitle>
          <DialogDescription>
            Preview and download your receipt image for sharing.
          </DialogDescription>
        </DialogHeader>

        {/* Format toggle */}
        <div className="flex gap-1 rounded-lg border p-1">
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFormat(opt.value)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                format === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 rounded-lg border p-1">
          <button
            onClick={() => setUseReal(true)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              useReal
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Today&apos;s dollars
          </button>
          <button
            onClick={() => setUseReal(false)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              !useReal
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Nominal
          </button>
        </div>

        {/* Scaled preview */}
        <div className="flex justify-center overflow-hidden rounded-lg border bg-muted/50 p-4">
          <div
            style={{
              width: dims.width * previewScale,
              height: dims.height * previewScale,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              style={{
                transform: `scale(${previewScale})`,
                transformOrigin: 'top left',
                position: 'absolute',
                top: 0,
                left: 0,
              }}
            >
              <ReceiptCanvas data={receiptData} format={format} />
            </div>
          </div>
        </div>

        {/* Hidden full-size canvas for image capture */}
        <ReceiptCanvas ref={canvasRef} data={receiptData} format={format} offscreen />

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleDownload}
            disabled={isGenerating}
            className="flex-1"
          >
            <Download className="mr-2 h-4 w-4" />
            {isGenerating ? 'Generating...' : 'Download PNG'}
          </Button>

          {canShare && (
            <Button
              variant="secondary"
              onClick={handleShare}
              disabled={isGenerating}
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          )}

          {canCopy && (
            <Button
              variant="outline"
              onClick={handleCopy}
              disabled={isGenerating}
            >
              {copied ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
