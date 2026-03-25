const ESTIMATE_HOURS_MAP: Record<string, string> = {
  "0": "0h (0d)",
  "1": "até 2h (0,25d)",
  "2": "até 6h (0,75d)",
  "3": "8h (1d)",
  "5": "até 16h (2d)",
  "8": "até 24h (3d)",
  "13": "até 40h (5d)",
  "20+": "acima de 40h (5d+)",
};

export function getEstimatedHoursByPoints(points: string | null | undefined) {
  if (!points) return null;
  return ESTIMATE_HOURS_MAP[points] || null;
}

export function getEstimatedHoursLabel(points: string | null | undefined) {
  return getEstimatedHoursByPoints(points) || "Sem estimativa em horas";
}

export function getEstimatedHoursOnlyLabel(points: string | null | undefined) {
  const full = getEstimatedHoursByPoints(points);
  if (!full) return "Sem estimativa em horas";
  return full.replace(/\s*\([^)]*\)\s*$/, "").trim();
}
