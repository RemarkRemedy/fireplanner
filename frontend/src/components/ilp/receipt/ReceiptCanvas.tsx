// frontend/src/components/ilp/receipt/ReceiptCanvas.tsx
import { forwardRef } from 'react'
import type { ReceiptData } from '@/lib/calculations/ilpReceiptData'
import type { ReceiptFormat } from '@/lib/data/ilpReceiptConstants'
import { RECEIPT_DIMENSIONS } from '@/lib/data/ilpReceiptConstants'
import { formatIlpCurrency, formatIlpPercent } from '../formatters'

interface ReceiptCanvasProps {
  data: ReceiptData
  format: ReceiptFormat
  /** When true, positions the canvas off-screen for image capture. Default false. */
  offscreen?: boolean
}

const COLORS = {
  paper: '#f5f0e8',
  text: '#1a1a1a',
  muted: '#888888',
  separator: '#bbbbbb',
  red: '#c41e1e',
  green: '#2a7d2a',
}

const FONT = "'Courier New', Courier, monospace"

/** Scale factor for story vs square — square uses tighter spacing. */
function s(format: ReceiptFormat, storyValue: number, squareValue: number): number {
  return format === 'story' ? storyValue : squareValue
}

export const ReceiptCanvas = forwardRef<HTMLDivElement, ReceiptCanvasProps>(
  function ReceiptCanvas({ data, format, offscreen = false }, ref) {
    const { width, height } = RECEIPT_DIMENSIONS[format]
    const cur = (v: number) => formatIlpCurrency(v, data.currency)
    const px = (v: number) => `${v}px`

    const baseFontSize = s(format, 28, 22)
    const gutPunchSize = s(format, 72, 52)
    const secondaryPunchSize = s(format, 56, 40)
    const labelSize = s(format, 22, 18)
    const footerSize = s(format, 22, 18)
    const sectionGap = s(format, 36, 20)
    const padding = s(format, 80, 48)
    const headerSize = s(format, 44, 34)

    const dotSeparator: React.CSSProperties = {
      borderBottom: `2px dotted ${COLORS.separator}`,
      margin: `${sectionGap}px 0`,
    }

    const sectionLabel: React.CSSProperties = {
      fontSize: px(labelSize),
      color: COLORS.muted,
      letterSpacing: '3px',
      textAlign: 'center',
    }

    const row: React.CSSProperties = {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: px(baseFontSize),
      lineHeight: 1.6,
    }

    return (
      <div
        ref={ref}
        style={{
          width: px(width),
          height: px(height),
          background: COLORS.paper,
          color: COLORS.text,
          fontFamily: FONT,
          padding: `${s(format, 96, 48)}px ${padding}px`,
          display: 'flex',
          flexDirection: 'column',
          position: offscreen ? 'absolute' : 'relative',
          left: offscreen ? '-9999px' : undefined,
          top: offscreen ? '-9999px' : undefined,
          backgroundImage:
            `repeating-linear-gradient(0deg, transparent, transparent ${s(format, 54, 42)}px, rgba(0,0,0,0.018) ${s(format, 54, 42)}px, rgba(0,0,0,0.018) ${s(format, 55, 43)}px)`,
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: px(s(format, 48, 28)) }}>
          <div
            style={{
              fontSize: px(headerSize),
              fontWeight: 'bold',
              letterSpacing: '6px',
            }}
          >
            YOUR ILP RECEIPT
          </div>
          <div
            style={{
              marginTop: px(12),
              color: COLORS.muted,
              fontSize: px(s(format, 28, 22)),
            }}
          >
            {'· '.repeat(20).trim()}
          </div>
        </div>

        {/* Product */}
        <div>
          <div style={sectionLabel}>PRODUCT</div>
          <div
            style={{
              fontSize: px(s(format, 30, 24)),
              fontWeight: 'bold',
              textAlign: 'center',
              marginTop: px(8),
            }}
          >
            {data.productLabel}
          </div>
        </div>

        <div style={dotSeparator} />

        {/* You pay */}
        <div style={row}>
          <span>You pay</span>
          <span style={{ fontWeight: 'bold' }}>{cur(data.youPay)}</span>
        </div>

        <div style={dotSeparator} />

        {/* Fee breakdown */}
        <div>
          <div style={row}>
            <span>Gross fees{data.includesOcf ? '' : ' (wrapper only)'}</span>
            <span>{cur(data.grossFees)}</span>
          </div>
          <div style={{ ...row, color: COLORS.green, marginTop: px(s(format, 12, 8)) }}>
            <span>Bonuses received</span>
            <span>-{cur(data.bonusesReceived)}</span>
          </div>
        </div>

        <div style={dotSeparator} />

        {/* WHAT THEY KEEP — the gut punch */}
        <div style={{ textAlign: 'center', padding: `${s(format, 16, 8)}px 0` }}>
          <div style={sectionLabel}>WHAT THEY KEEP</div>
          <div
            style={{
              fontSize: px(gutPunchSize),
              fontWeight: 'bold',
              color: COLORS.red,
              margin: `${s(format, 16, 10)}px 0`,
            }}
          >
            {cur(data.whatTheyKeep)}
          </div>
          <div style={{ fontSize: px(s(format, 24, 20)), color: COLORS.muted }}>
            {formatIlpPercent(data.feeDragPercent)} of your premiums
          </div>
        </div>

        <div style={dotSeparator} />

        {/* Index fund comparison */}
        <div>
          <div style={row}>
            <span>Same $ in index fund</span>
            <span style={{ fontWeight: 'bold' }}>{cur(data.indexFundValue)}</span>
          </div>
          <div
            style={{
              fontSize: px(s(format, 22, 18)),
              color: COLORS.muted,
              marginTop: px(6),
            }}
          >
            (global equity, 7% gross return)
          </div>
        </div>

        <div style={dotSeparator} />

        {/* Leaving on the table */}
        <div style={{ textAlign: 'center', padding: `${s(format, 8, 4)}px 0` }}>
          <div style={sectionLabel}>YOU'RE LEAVING ON THE TABLE</div>
          <div
            style={{
              fontSize: px(secondaryPunchSize),
              fontWeight: 'bold',
              margin: `${s(format, 12, 8)}px 0`,
            }}
          >
            {cur(data.leavingOnTable)}
          </div>
        </div>

        {/* Footer — pushed to bottom */}
        <div
          style={{
            marginTop: 'auto',
            borderTop: `2px dashed ${COLORS.separator}`,
            paddingTop: px(s(format, 36, 20)),
            textAlign: 'center',
            fontSize: px(footerSize),
            color: COLORS.muted,
            lineHeight: 1.8,
          }}
        >
          Fees as of {data.dataFreshness}
          <br />
          Based on published fund charges.
          <br />
          Actual returns vary.
          <br />
          <br />
          sgfireplanner.com/ilp
          <br />
          <span style={{ color: '#555', fontWeight: 'bold', fontSize: px(footerSize + 2) }}>
            Check before you sign.
          </span>
        </div>
      </div>
    )
  },
)
