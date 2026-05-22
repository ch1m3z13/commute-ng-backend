const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Haversine distance between two points in meters.
 */
export function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Cross-track distance: shortest distance from a point to a great-circle path
 * defined by start and end points. Returns distance in meters.
 *
 * This is the proper "point to line segment" distance on a sphere.
 */
export function crossTrackDistance(
  pointLat: number, pointLng: number,
  startLat: number, startLng: number,
  endLat: number, endLng: number
): number {
  const dStart = haversineDistance(startLat, startLng, pointLat, pointLng) / EARTH_RADIUS_METERS;
  const bearingStartEnd = bearing(startLat, startLng, endLat, endLng);
  const bearingStartPoint = bearing(startLat, startLng, pointLat, pointLng);

  const crossTrack = Math.asin(
    Math.sin(dStart) * Math.sin(bearingStartPoint - bearingStartEnd)
  ) * EARTH_RADIUS_METERS;

  return Math.abs(crossTrack);
}

/**
 * Along-track distance: how far along the start→end path the closest point is.
 * Used to check if the perpendicular projection falls within the segment.
 */
export function alongTrackDistance(
  pointLat: number, pointLng: number,
  startLat: number, startLng: number,
  endLat: number, endLng: number
): number {
  const dStart = haversineDistance(startLat, startLng, pointLat, pointLng) / EARTH_RADIUS_METERS;
  const crossTrack = crossTrackDistance(pointLat, pointLng, startLat, startLng, endLat, endLng) / EARTH_RADIUS_METERS;

  // Protect against floating point errors
  const arg = Math.max(-1, Math.min(1, Math.cos(dStart) / Math.max(0.0000001, Math.cos(crossTrack))));
  return Math.acos(arg) * EARTH_RADIUS_METERS;
}

/**
 * Bearing from point 1 to point 2 in radians.
 */
function bearing(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const dLng = toRadians(lng2 - lng1);

  const y = Math.sin(dLng) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);

  return Math.atan2(y, x);
}

/**
 * Shortest distance from a point to a line segment on a sphere (meters).
 * If the perpendicular projection falls outside the segment, returns
 * the distance to the nearest endpoint.
 */
export function pointToSegmentDistance(
  pointLat: number, pointLng: number,
  startLat: number, startLng: number,
  endLat: number, endLng: number
): number {
  const dStartEnd = haversineDistance(startLat, startLng, endLat, endLng);

  // Degenerate case: start and end are the same point
  if (dStartEnd < 1) {
    return haversineDistance(pointLat, pointLng, startLat, startLng);
  }

  const along = alongTrackDistance(pointLat, pointLng, startLat, startLng, endLat, endLng);

  // If projection falls before start, distance to start
  if (along < 0) {
    return haversineDistance(pointLat, pointLng, startLat, startLng);
  }

  // If projection falls after end, distance to end
  if (along > dStartEnd) {
    return haversineDistance(pointLat, pointLng, endLat, endLng);
  }

  // Projection falls within segment, return cross-track distance
  return crossTrackDistance(pointLat, pointLng, startLat, startLng, endLat, endLng);
}

/**
 * Check if a rider's direction is compatible with a driver's direction.
 * The rider's pickup should be closer to the driver's start than the rider's dropoff.
 */
export function directionIsCompatible(
  riderPickupLat: number, riderPickupLng: number,
  riderDropoffLat: number, riderDropoffLng: number,
  driverStartLat: number, driverStartLng: number,
  driverEndLat: number, driverEndLng: number
): boolean {
  const pickupToStart = haversineDistance(riderPickupLat, riderPickupLng, driverStartLat, driverStartLng);
  const dropoffToStart = haversineDistance(riderDropoffLat, riderDropoffLng, driverStartLat, driverStartLng);
  return pickupToStart < dropoffToStart;
}

/**
 * Compute a match score. Lower = better.
 * Combines spatial proximity and time alignment.
 */
export function computeMatchScore(
  pickupDetourMeters: number,
  dropoffDetourMeters: number,
  timeDeltaMinutes: number
): number {
  const spatialScore = (pickupDetourMeters + dropoffDetourMeters) / 2;
  const timeScore = timeDeltaMinutes * 100; // 1 minute ≈ 100 meters penalty
  return spatialScore * 0.6 + timeScore * 0.4;
}

/**
 * Convert a match score to a human-readable percentage (0-100).
 * 100 = perfect match (0 detour, 0 time delta).
 */
export function matchScoreToPercentage(score: number): number {
  // Score of 0 → 100%, score of 5000+ → 0%
  const pct = Math.max(0, Math.min(100, 100 - (score / 50)));
  return Math.round(pct);
}
