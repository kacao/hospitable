export function snakeToCamel(s: string): string {
  return s.replace(/_(\w)/g, (_, c: string) => c.toUpperCase())
}

export function deepSnakeToCamel(obj: unknown, depth = 0): unknown {
  if (depth > 20) return obj
  if (Array.isArray(obj)) return obj.map(v => deepSnakeToCamel(v, depth + 1))
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [
        k.includes('_') ? snakeToCamel(k) : k,
        deepSnakeToCamel(v, depth + 1),
      ])
    )
  }
  return obj
}
