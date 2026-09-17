// ─── Helpers ──────────────────────────────────────────────────────────────────

export function buildLetterboxdUrl(title: string, year: number): string {
  const query = `${title} ${year}`
  return `https://letterboxd.com/search/films/${encodeURIComponent(query).replace(/%20/g, '+')}`
}
