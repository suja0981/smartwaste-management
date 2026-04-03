const DEFAULT_ZONES = ["north", "south", "east", "west", "central"]

export const UNASSIGNED_ZONE = "unassigned"

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export function getZoneLabel(zoneId?: string | null) {
  if (!zoneId || zoneId === UNASSIGNED_ZONE) {
    return "Unassigned"
  }
  return titleCase(zoneId)
}

export function buildZoneOptions(values: Array<string | null | undefined> = []) {
  const unique = new Set<string>()

  for (const zone of DEFAULT_ZONES) {
    unique.add(zone)
  }

  for (const value of values) {
    if (value) {
      unique.add(value)
    }
  }

  return Array.from(unique)
    .filter((zone) => zone !== UNASSIGNED_ZONE)
    .sort((left, right) => getZoneLabel(left).localeCompare(getZoneLabel(right)))
}
