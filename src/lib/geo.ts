// Haversine distance between two GPS coordinates.

const EARTH_RADIUS_M = 6371000; // meters

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in meters between two lat/lng points. */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

export interface GeofenceResult {
  distanceM: number;
  withinRadius: boolean;
}

export function checkGeofence(
  userLat: number,
  userLng: number,
  gymLat: number,
  gymLng: number,
  radiusM: number
): GeofenceResult {
  const distanceM = haversineMeters(userLat, userLng, gymLat, gymLng);
  return { distanceM, withinRadius: distanceM <= radiusM };
}
