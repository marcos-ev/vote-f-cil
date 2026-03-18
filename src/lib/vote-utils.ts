export function parseVoteNumeric(vote: string | null | undefined): number | null {
  if (!vote) return null;
  const normalized = String(vote).trim();
  if (!normalized || normalized === "?" || normalized === "☕" || normalized === "∞") return null;
  const match = normalized.match(/^\d+(\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isNaN(parsed) ? null : parsed;
}

export function isNumericVote(vote: string | null | undefined): vote is string {
  return parseVoteNumeric(vote) !== null;
}

export function filterNumericVoteLabels(votes: string[]) {
  return votes.filter((vote) => isNumericVote(vote));
}
