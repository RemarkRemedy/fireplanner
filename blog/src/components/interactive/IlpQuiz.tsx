import { useState, useCallback } from 'react'
import {
  QUIZ_RESULT_TIERS,
  QUIZ_DISCLAIMER,
  SITE_URL,
} from '@/lib/ilp-constants'

const QUESTIONS = [
  'Would you invest regularly on your own without a policy forcing you to?',
  'Are you comfortable opening a brokerage account and buying ETFs?',
  'Do you already have term life or other insurance coverage?',
  'Would you keep up with managing insurance and investments separately?',
  'Has your FA shown you the total fees over the full policy term?',
  'Do you have an emergency fund of 3-6 months\' expenses?',
] as const

const RESULT_TEXT = {
  HIGH: 'Based on your answers, you might prefer a DIY approach. You seem comfortable managing insurance and investments separately, which typically means lower fees over time.',
  MID: 'It could go either way. Consider comparing the specific ILP fees against a DIY approach before deciding. The fee calculator can help.',
  LOW: 'An ILP\'s structure may help you stay disciplined with regular investing. But still ask your FA the 7 questions above to make sure you\'re getting a fair deal.',
} as const

/**
 * Calculate quiz score from answers.
 *
 * Q1-4 and Q6: "Yes" = 1 point toward "DIY likely better"
 * Q5 is inverted: "No" = 1 point (FA hasn't been transparent)
 *
 * @param answers - Array of 6 answers (true = Yes, false = No, null = unanswered)
 * @returns Score from 0 to 6
 */
export function calculateScore(answers: (boolean | null)[]): number {
  let score = 0
  for (let i = 0; i < answers.length; i++) {
    const answer = answers[i]
    if (answer === null) continue
    if (i === 4) {
      // Q5 (index 4) is inverted: "No" adds 1 point
      if (!answer) score += 1
    } else {
      // Q1-4 and Q6: "Yes" adds 1 point
      if (answer) score += 1
    }
  }
  return score
}

function getResultTier(score: number): 'HIGH' | 'MID' | 'LOW' {
  if (score >= QUIZ_RESULT_TIERS.HIGH.min) return 'HIGH'
  if (score >= QUIZ_RESULT_TIERS.MID.min) return 'MID'
  return 'LOW'
}

/**
 * Render quiz result onto a canvas element for sharing.
 * Uses system font stack (no custom fonts) for iOS Safari compatibility.
 */
export function renderResultCanvas(
  canvas: HTMLCanvasElement,
  score: number,
  resultText: string,
  siteUrl: string
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const w = canvas.width
  const h = canvas.height

  // Background gradient: #1e293b to #0f172a
  const gradient = ctx.createLinearGradient(0, 0, 0, h)
  gradient.addColorStop(0, '#1e293b')
  gradient.addColorStop(1, '#0f172a')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)

  // Title
  ctx.fillStyle = '#f8fafc'
  ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('ILP Information Checklist', w / 2, 50)

  // Score circle
  const circleY = 110
  ctx.beginPath()
  ctx.arc(w / 2, circleY, 40, 0, Math.PI * 2)
  ctx.fillStyle = '#0d9488'
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(`${score}/6`, w / 2, circleY)

  // Result text (word-wrapped)
  ctx.fillStyle = '#cbd5e1'
  ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textBaseline = 'top'
  ctx.textAlign = 'center'

  const maxWidth = w - 80
  const lineHeight = 22
  const words = resultText.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const metrics = ctx.measureText(testLine)
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine)
      currentLine = word
    } else {
      currentLine = testLine
    }
  }
  if (currentLine) lines.push(currentLine)

  const textStartY = 170
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], w / 2, textStartY + i * lineHeight)
  }

  // Branding
  ctx.fillStyle = '#64748b'
  ctx.font = '14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(siteUrl, w / 2, h - 20)
}

export default function IlpQuiz() {
  const [answers, setAnswers] = useState<(boolean | null)[]>(
    Array(QUESTIONS.length).fill(null)
  )
  const [showResult, setShowResult] = useState(false)
  const [shareStatus, setShareStatus] = useState<string | null>(null)

  const allAnswered = answers.every((a) => a !== null)
  const score = calculateScore(answers)
  const tier = getResultTier(score)
  const resultText = RESULT_TEXT[tier]

  const handleAnswer = useCallback((index: number, value: boolean) => {
    setAnswers((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }, [])

  const handleShare = useCallback(async () => {
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 400
    renderResultCanvas(canvas, score, resultText, SITE_URL)

    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b)
          else reject(new Error('Canvas toBlob failed'))
        }, 'image/png')
      })

      // Try Web Share API first
      if (navigator.share && typeof File !== 'undefined') {
        const file = new File([blob], 'ilp-quiz-result.png', {
          type: 'image/png',
        })
        try {
          await navigator.share({ files: [file] })
          setShareStatus('Shared successfully!')
          return
        } catch {
          // User cancelled or share failed, fall through to clipboard
        }
      }

      // Try clipboard
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob }),
          ])
          setShareStatus('Image copied to clipboard!')
          return
        } catch {
          // Clipboard failed, fall through to download
        }
      }

      // Fallback: download
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'ilp-quiz-result.png'
      try {
        document.body.appendChild(a)
        a.click()
      } finally {
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
      setShareStatus('Image downloaded!')
    } catch {
      setShareStatus('Could not share the result. Please try a screenshot instead.')
    }
  }, [score, resultText])

  return (
    <div className="not-prose my-8 rounded-lg border border-border bg-card p-6 font-sans">
      <h3 className="mb-4 text-lg font-semibold text-card-foreground">
        ILP Information Checklist
      </h3>

      {/* Questions */}
      <div className="mb-6 space-y-4">
        {QUESTIONS.map((question, index) => (
          <div
            key={index}
            className="rounded-md border border-border bg-background p-4"
            data-testid={`question-${index}`}
          >
            <p className="mb-3 text-sm font-medium text-card-foreground">
              {index + 1}. {question}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => handleAnswer(index, true)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  answers[index] === true
                    ? 'bg-teal-600 text-white'
                    : 'border border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
                data-testid={`q${index}-yes`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => handleAnswer(index, false)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                  answers[index] === false
                    ? 'bg-orange-500 text-white'
                    : 'border border-border bg-background text-muted-foreground hover:bg-muted'
                }`}
                data-testid={`q${index}-no`}
              >
                No
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* See Result Button */}
      <button
        type="button"
        disabled={!allAnswered}
        onClick={() => setShowResult(true)}
        className={`mb-4 w-full rounded-md px-4 py-2 text-sm font-medium transition-colors ${
          allAnswered
            ? 'bg-teal-600 text-white hover:bg-teal-700'
            : 'cursor-not-allowed bg-muted text-muted-foreground'
        }`}
        data-testid="see-result-btn"
      >
        See your result
      </button>

      {/* Result Card */}
      {showResult && (
        <div
          className="mb-4 rounded-md bg-muted p-4"
          data-testid="result-card"
        >
          <div className="mb-2 text-center text-2xl font-bold text-teal-600">
            {score}/6
          </div>
          <p className="mb-4 text-sm text-card-foreground" data-testid="result-text">
            {resultText}
          </p>

          {/* Share Button */}
          <button
            type="button"
            onClick={handleShare}
            className="w-full rounded-md bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600 transition-colors"
            data-testid="share-btn"
          >
            Share your result
          </button>

          {shareStatus && (
            <p
              className="mt-2 text-center text-xs text-muted-foreground"
              data-testid="share-status"
            >
              {shareStatus}
            </p>
          )}
        </div>
      )}

      {/* Disclaimer */}
      {showResult && (
        <p
          className="text-xs text-muted-foreground"
          data-testid="disclaimer"
        >
          {QUIZ_DISCLAIMER}
        </p>
      )}
    </div>
  )
}
