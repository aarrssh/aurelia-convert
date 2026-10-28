export function buildLocationQuery(
  locationName?: string,
  locationAddress?: string,
  destination?: string,
): string {
  const parts: string[] = []
  if (locationName && locationName.trim()) {
    parts.push(locationName.trim())
  }
  if (locationAddress && locationAddress.trim()) {
    parts.push(locationAddress.trim())
  }
  if (destination && destination.trim()) {
    parts.push(destination.trim())
  }
  return parts.join(', ')
}

export function getGoogleMapsUrl(
  locationName?: string,
  locationAddress?: string,
  destination?: string,
): string {
  const query = buildLocationQuery(locationName, locationAddress, destination)
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function getAppleMapsUrl(
  locationName?: string,
  locationAddress?: string,
  destination?: string,
): string {
  const query = buildLocationQuery(locationName, locationAddress, destination)
  return `https://maps.apple.com/?q=${encodeURIComponent(query)}`
}
