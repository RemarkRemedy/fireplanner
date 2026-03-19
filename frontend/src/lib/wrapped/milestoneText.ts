/**
 * Pure string-formatting helpers for couple milestone display.
 * Extracted from CoupleMilestoneCard for testability.
 */

export function getDecadeLabel(age: number): string {
  const decade = Math.floor(age / 10) * 10
  const position = age - decade
  if (position < 4) return `early ${decade}s`
  if (position < 7) return `mid ${decade}s`
  return `late ${decade}s`
}

export function getJointSummary(
  names: [string, string],
  perPersonFireAge: [number | null, number | null]
): string {
  const [age1, age2] = perPersonFireAge

  if (age1 == null && age2 == null) {
    return 'Add more details to see your FIRE timeline.'
  }

  if (age1 != null && age2 == null) {
    return `${names[0]} reaches FIRE at ${age1}. Keep building together.`
  }

  if (age1 == null && age2 != null) {
    return `${names[1]} reaches FIRE at ${age2}. Keep building together.`
  }

  // Both non-null
  const a1 = age1!
  const a2 = age2!
  const diff = Math.abs(a1 - a2)

  if (diff <= 5) {
    const laterAge = Math.max(a1, a2)
    return `You could both be free in your ${getDecadeLabel(laterAge)}.`
  }

  if (a1 <= a2) {
    return `${names[0]} reaches FIRE first at ${a1}. ${names[1]} follows at ${a2}.`
  }
  return `${names[1]} reaches FIRE first at ${a2}. ${names[0]} follows at ${a1}.`
}
