/**
 * URL patterns for plugins and themes. Same semantics as Suno Desktop's injection pipeline:
 * `*` matches anything, compared against origin + path + query (no hash). Patterns must start
 * with https://suno.com/ so nothing ever runs on other sites or on sign-in pages.
 */

export const SUNO_ORIGIN = 'https://suno.com'

export function isAllowedPattern(pattern: string): boolean {
  return pattern.startsWith(`${SUNO_ORIGIN}/`) && pattern.length <= 200
}

function toRegExp(pattern: string): RegExp {
  const body = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*')
  return new RegExp(`^${body}$`)
}

export function matchesUrl(patterns: readonly string[], rawUrl: string): boolean {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return false
  }
  if (url.origin !== SUNO_ORIGIN) return false
  const target = `${url.origin}${url.pathname}${url.search}`
  return patterns.some((pattern) => isAllowedPattern(pattern) && toRegExp(pattern).test(target))
}
