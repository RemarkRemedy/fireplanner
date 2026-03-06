import { useRef, useEffect } from 'react'
import * as d3 from 'd3'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { InfoTooltip } from '@/components/shared/InfoTooltip'
import type { HeatmapData } from '@/lib/types'

interface SwrHeatmapProps {
  data: HeatmapData
  onCellClick?: (swr: number, duration: number, successRate: number) => void
}

export function SwrHeatmap({ data, onCellClick }: SwrHeatmapProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return

    const containerWidth = containerRef.current.clientWidth
    const nCols = data.duration_values.length
    const nRows = data.swr_values.length
    const cellSize = Math.max(28, Math.min(60, Math.floor(500 / Math.max(nCols, nRows))))
    const margin = { top: 40, right: 20, bottom: 50, left: 70 }
    const innerWidth = nCols * cellSize
    const innerHeight = nRows * cellSize
    const width = Math.min(containerWidth, innerWidth + margin.left + margin.right)

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', innerHeight + margin.top + margin.bottom)

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const swrLabels = data.swr_values.map((v) => `${(v * 100).toFixed(1)}%`)
    const durLabels = data.duration_values.map((v) => `${v}yr`)

    const cellWidth = innerWidth / nCols
    const cellHeight = innerHeight / nRows
    const fontSize = Math.max(8, Math.min(11, cellSize * 0.3))

    // Color scale: red → orange → yellow → green
    const colorScale = d3.scaleLinear<string>()
      .domain([0, 0.60, 0.80, 0.95, 1.0])
      .range(['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'])
      .clamp(true)

    // Draw cells
    for (let row = 0; row < data.swr_values.length; row++) {
      for (let col = 0; col < data.duration_values.length; col++) {
        const rate = data.success_rates[row][col]

        g.append('rect')
          .attr('x', col * cellWidth)
          .attr('y', row * cellHeight)
          .attr('width', cellWidth - 1)
          .attr('height', cellHeight - 1)
          .attr('fill', colorScale(rate))
          .attr('rx', 2)
          .style('cursor', 'pointer')
          .on('mouseenter', function (event) {
            d3.select(this).attr('stroke', '#000').attr('stroke-width', 2)
            tooltip
              .style('opacity', 1)
              .html(`<strong>SWR ${swrLabels[row]} × ${durLabels[col]}</strong><br/>Success: ${(rate * 100).toFixed(1)}%`)
              .style('left', `${event.offsetX + 10}px`)
              .style('top', `${event.offsetY - 10}px`)
          })
          .on('mouseleave', function () {
            d3.select(this).attr('stroke', 'none')
            tooltip.style('opacity', 0)
          })
          .on('click', function () {
            if (onCellClick) {
              onCellClick(data.swr_values[row], data.duration_values[col], rate)
            }
          })

        // Cell text
        g.append('text')
          .attr('x', col * cellWidth + cellWidth / 2)
          .attr('y', row * cellHeight + cellHeight / 2)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-size', `${fontSize}px`)
          .attr('fill', rate >= 0.8 ? '#fff' : '#1f2937')
          .attr('pointer-events', 'none')
          .text(`${(rate * 100).toFixed(0)}%`)
      }
    }

    // X-axis labels (duration)
    g.selectAll('.x-label')
      .data(durLabels)
      .enter()
      .append('text')
      .attr('x', (_, i) => i * cellWidth + cellWidth / 2)
      .attr('y', innerHeight + 20)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', '#374151')
      .text((d) => d)

    // X-axis title
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 42)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#6b7280')
      .text('Retirement Duration')

    // Y-axis labels (SWR)
    g.selectAll('.y-label')
      .data(swrLabels)
      .enter()
      .append('text')
      .attr('x', -8)
      .attr('y', (_, i) => i * cellHeight + cellHeight / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '11px')
      .attr('fill', '#374151')
      .text((d) => d)

    // Y-axis title
    g.append('text')
      .attr('transform', `translate(-55,${innerHeight / 2}) rotate(-90)`)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#6b7280')
      .text('Withdrawal Rate (SWR)')

    // Tooltip
    const tooltip = d3.select(containerRef.current)
      .selectAll('.d3-tooltip')
      .data([null])
      .join('div')
      .attr('class', 'd3-tooltip')
      .style('position', 'absolute')
      .style('pointer-events', 'none')
      .style('background', 'rgba(0,0,0,0.85)')
      .style('color', '#fff')
      .style('padding', '6px 10px')
      .style('border-radius', '6px')
      .style('font-size', '12px')
      .style('opacity', 0)
      .style('transition', 'opacity 0.15s')

    const container = containerRef.current
    return () => {
      svg.selectAll('*').remove()
      d3.select(container).selectAll('.d3-tooltip').remove()
    }
  }, [data])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          SWR x Duration Heatmap
          <InfoTooltip text="Historical success rate for each combination of withdrawal rate and retirement duration. Green = portfolio lasted, red = high risk of running out." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="relative overflow-x-auto">
          <svg ref={svgRef} />
        </div>
      </CardContent>
    </Card>
  )
}
