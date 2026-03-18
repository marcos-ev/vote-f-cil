const ESTIMATE_HOURS_MAP: Record<string, string> = {
  "0": "0h (0d)",
  "1": "1h (0,125d)",
  "2": "2h (0,25d)",
  "3": "3h (0,375d)",
  "5": "5h (0,625d)",
  "8": "8h (1d)",
  "13": "13h (1,625d)",
  "20+": "20h+ (2,5d+)",
};

export function getEstimatedHoursByPoints(points: string | null | undefined) {
  if (!points) return null;
  return ESTIMATE_HOURS_MAP[points] || null;
}

export function getEstimatedHoursLabel(points: string | null | undefined) {
  return getEstimatedHoursByPoints(points) || "Sem estimativa em horas";
}
