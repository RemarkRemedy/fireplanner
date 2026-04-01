export interface SupportNoteDisplayItem {
  preview: string
  detail: string | null
  intro: string | null
  bullets: string[]
  closing: string | null
}

export function summarizeSupportNote(note: string): { preview: string; detail: string | null } {
  const trimmed = note.trim()
  const compact = trimmed.replace(/\s+/g, ' ')

  if (compact.length <= 220) {
    return { preview: compact, detail: null }
  }

  const preview = `${compact.slice(0, 220).trimEnd()}...`

  return {
    preview,
    detail: trimmed,
  }
}

export function splitSupportNoteBullets(text: string): string[] {
  return text
    .split(', ')
    .reduce<string[]>((bullets, clause) => {
      const trimmed = clause.trim()
      if (trimmed.length === 0) return bullets

      if (bullets.length > 0 && /^(including|with|where|when|once|after|before|through|during)\b/i.test(trimmed)) {
        bullets[bullets.length - 1] = `${bullets[bullets.length - 1]}, ${trimmed}`
        return bullets
      }

      bullets.push(trimmed.replace(/^and\s+/i, ''))
      return bullets
    }, [])
}

export function buildSupportNoteBreakdown(note: string): {
  intro: string | null
  bullets: string[]
  closing: string | null
} {
  const trimmed = note.trim()
  const parserPrefix = 'The parser captures '
  const parserIndex = trimmed.indexOf(parserPrefix)

  if (parserIndex >= 0) {
    const intro = trimmed.slice(0, parserIndex).trim().replace(/\s+$/, '')
    const parserBody = trimmed.slice(parserIndex + parserPrefix.length).trim()
    const semicolonIndex = parserBody.indexOf('; ')
    const modeledText = semicolonIndex >= 0 ? parserBody.slice(0, semicolonIndex).trim() : parserBody
    const closing = semicolonIndex >= 0 ? parserBody.slice(semicolonIndex + 2).trim() : null

    return {
      intro: intro.length > 0 ? intro : null,
      bullets: splitSupportNoteBullets(modeledText),
      closing,
    }
  }

  const soIndex = trimmed.indexOf(', so ')
  if (soIndex >= 0) {
    const preface = trimmed.slice(0, soIndex).trim()
    const closing = trimmed.slice(soIndex + 5).trim()

    return {
      intro: null,
      bullets: splitSupportNoteBullets(preface),
      closing: closing.length > 0 ? closing : null,
    }
  }

  return {
    intro: trimmed,
    bullets: [],
    closing: null,
  }
}

export function createSupportNoteDisplayItem(note: string): SupportNoteDisplayItem {
  const { preview, detail } = summarizeSupportNote(note)
  const { intro, bullets, closing } = detail
    ? buildSupportNoteBreakdown(detail)
    : { intro: null, bullets: [], closing: null }

  return {
    preview,
    detail,
    intro,
    bullets,
    closing,
  }
}

export function mergeSupportNotes(notes: string[]): SupportNoteDisplayItem[] {
  const items = notes.map(createSupportNoteDisplayItem)
  const merged: SupportNoteDisplayItem[] = []

  for (const item of items) {
    const existing = item.intro
      ? merged.find((candidate) => candidate.intro === item.intro && candidate.bullets.length > 0 && item.bullets.length > 0)
      : null

    if (!existing) {
      merged.push(item)
      continue
    }

    const bulletSet = new Set(existing.bullets)
    for (const bullet of item.bullets) {
      if (!bulletSet.has(bullet)) {
        existing.bullets.push(bullet)
        bulletSet.add(bullet)
      }
    }

    if (existing.detail == null || (item.detail != null && item.detail.length > existing.detail.length)) {
      existing.detail = item.detail
      existing.preview = item.preview
    }

    if (existing.closing == null && item.closing != null) {
      existing.closing = item.closing
    } else if (existing.closing != null && item.closing != null && existing.closing !== item.closing) {
      existing.closing = `${existing.closing} ${item.closing}`
    }
  }

  return merged
}
