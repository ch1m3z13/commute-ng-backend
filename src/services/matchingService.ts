import { getDb } from '../config/database.js';
import { Commute, MatchResult } from '../models/types.js';
import {
  pointToSegmentDistance,
  directionIsCompatible,
  computeMatchScore,
  haversineDistance,
} from './geoUtils.js';

function toCommute(row: Record<string, unknown>): Commute {
  return {
    ...row,
    recurring: Boolean(row.recurring),
    daysOfWeek: row.daysOfWeek ? JSON.parse(row.daysOfWeek as string) : undefined,
    startLat: row.startLat != null ? Number(row.startLat) : undefined,
    startLng: row.startLng != null ? Number(row.startLng) : undefined,
    destLat: row.destLat != null ? Number(row.destLat) : undefined,
    destLng: row.destLng != null ? Number(row.destLng) : undefined,
    seatsRemaining: row.seatsRemaining != null ? Number(row.seatsRemaining) : undefined,
    pickupRadiusMeters: row.pickupRadiusMeters != null ? Number(row.pickupRadiusMeters) : 2000,
    timeFlexibilityMinutes: row.timeFlexibilityMinutes != null ? Number(row.timeFlexibilityMinutes) : 30,
  } as unknown as Commute;
}

/**
 * Parse a time string like "08:00" or "08:00 AM" into minutes since midnight.
 */
function timeToMinutes(timeStr: string): number {
  const trimmed = timeStr.trim();

  // Handle "HH:MM AM/PM"
  const ampmMatch = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3].toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  // Handle "HH:MM" (24h)
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
  }

  return 0;
}

export class MatchingService {
  /**
   * Find matching commutes for a rider's request.
   * This replaces the old substring-based searchCommutes.
   */
  async findMatches(params: {
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    desiredTime: string;
    shift: 'morning' | 'evening';
    maxResults?: number;
  }): Promise<MatchResult[]> {
    const { pickupLat, pickupLng, dropoffLat, dropoffLng, desiredTime, shift, maxResults = 20 } = params;

    const desiredMinutes = timeToMinutes(desiredTime);

    // Fetch all active offer commutes that have coordinates
    const rows = await getDb().prepare(`
      SELECT * FROM commutes
      WHERE type = 'offer'
        AND status = 'active'
        AND shift = ?
        AND startLat IS NOT NULL
        AND startLng IS NOT NULL
        AND destLat IS NOT NULL
        AND destLng IS NOT NULL
      ORDER BY createdAt DESC
    `).all(shift) as Record<string, unknown>[];

    const commutes = rows.map(toCommute);
    const results: MatchResult[] = [];

    for (const commute of commutes) {
      // Skip if no seats remaining
      const seatsRemaining = commute.seatsRemaining ?? commute.seatsAvailable;
      if (seatsRemaining <= 0) continue;

      // Time-window filtering: driver departure must be within flexibility window
      const driverMinutes = timeToMinutes(commute.departureTime);
      const flexibility = commute.timeFlexibilityMinutes ?? 30;
      const timeDelta = Math.abs(driverMinutes - desiredMinutes);
      if (timeDelta > flexibility) continue;

      // Geospatial: both pickup and dropoff must be within driver's route corridor
      const radius = commute.pickupRadiusMeters ?? 2000;

      const pickupDetour = pointToSegmentDistance(
        pickupLat, pickupLng,
        commute.startLat!, commute.startLng!,
        commute.destLat!, commute.destLng!
      );

      const dropoffDetour = pointToSegmentDistance(
        dropoffLat, dropoffLng,
        commute.startLat!, commute.startLng!,
        commute.destLat!, commute.destLng!
      );

      if (pickupDetour > radius || dropoffDetour > radius) continue;

      // Direction compatibility: rider's pickup should be closer to driver's start
      if (!directionIsCompatible(
        pickupLat, pickupLng,
        dropoffLat, dropoffLng,
        commute.startLat!, commute.startLng!,
        commute.destLat!, commute.destLng!
      )) continue;

      const matchScore = computeMatchScore(pickupDetour, dropoffDetour, timeDelta);
      const totalDetour = Math.round(pickupDetour + dropoffDetour);

      results.push({
        commute,
        matchScore,
        pickupDetourMeters: Math.round(pickupDetour),
        dropoffDetourMeters: Math.round(dropoffDetour),
        totalDetourMeters: totalDetour,
        timeDeltaMinutes: timeDelta,
        seatsRemaining,
      });
    }

    // Sort by match score ascending (best first), then by seats remaining descending
    results.sort((a, b) => {
      if (Math.abs(a.matchScore - b.matchScore) < 50) {
        return b.seatsRemaining - a.seatsRemaining;
      }
      return a.matchScore - b.matchScore;
    });

    return results.slice(0, maxResults);
  }

  /**
   * Find matching rider requests for a driver's commute (auto-match).
   */
  async findRiderMatches(commute: Commute): Promise<Array<{
    commute: Commute;
    matchScore: number;
    pickupDetourMeters: number;
    dropoffDetourMeters: number;
    totalDetourMeters: number;
    timeDeltaMinutes: number;
  }>> {
    if (!commute.startLat || !commute.startLng || !commute.destLat || !commute.destLng) {
      return [];
    }

    const rows = await getDb().prepare(`
      SELECT * FROM commutes
      WHERE type = 'request'
        AND status = 'active'
        AND shift = ?
        AND startLat IS NOT NULL
        AND startLng IS NOT NULL
        AND destLat IS NOT NULL
        AND destLng IS NOT NULL
      ORDER BY createdAt DESC
    `).all(commute.shift || 'morning') as Record<string, unknown>[];

    const riderRequests = rows.map(toCommute);
    const results: Array<{
      commute: Commute;
      matchScore: number;
      pickupDetourMeters: number;
      dropoffDetourMeters: number;
      totalDetourMeters: number;
      timeDeltaMinutes: number;
    }> = [];

    for (const rider of riderRequests) {
      if (!rider.startLat || !rider.startLng || !rider.destLat || !rider.destLng) continue;

      const radius = commute.pickupRadiusMeters ?? 2000;

      const pickupDetour = pointToSegmentDistance(
        rider.startLat, rider.startLng,
        commute.startLat, commute.startLng,
        commute.destLat, commute.destLng
      );

      const dropoffDetour = pointToSegmentDistance(
        rider.destLat, rider.destLng,
        commute.startLat, commute.startLng,
        commute.destLat, commute.destLng
      );

      if (pickupDetour > radius || dropoffDetour > radius) continue;

      if (!directionIsCompatible(
        rider.startLat, rider.startLng,
        rider.destLat, rider.destLng,
        commute.startLat, commute.startLng,
        commute.destLat, commute.destLng
      )) continue;

      const driverMinutes = timeToMinutes(commute.departureTime);
      const riderMinutes = timeToMinutes(rider.departureTime);
      const timeDelta = Math.abs(driverMinutes - riderMinutes);

      const matchScore = computeMatchScore(pickupDetour, dropoffDetour, timeDelta);

      results.push({
        commute: rider,
        matchScore,
        pickupDetourMeters: Math.round(pickupDetour),
        dropoffDetourMeters: Math.round(dropoffDetour),
        totalDetourMeters: Math.round(pickupDetour + dropoffDetour),
        timeDeltaMinutes: timeDelta,
      });
    }

    results.sort((a, b) => a.matchScore - b.matchScore);
    return results;
  }

  /**
   * Find matching driver offers for a rider's request (auto-match).
   */
  async findDriverMatches(request: Commute): Promise<MatchResult[]> {
    if (!request.startLat || !request.startLng || !request.destLat || !request.destLng) {
      return [];
    }

    const rows = await getDb().prepare(`
      SELECT * FROM commutes
      WHERE type = 'offer'
        AND status = 'active'
        AND shift = ?
        AND startLat IS NOT NULL
        AND startLng IS NOT NULL
        AND destLat IS NOT NULL
        AND destLng IS NOT NULL
      ORDER BY createdAt DESC
    `).all(request.shift || 'morning') as Record<string, unknown>[];

    const driverOffers = rows.map(toCommute);
    const results: MatchResult[] = [];

    for (const driver of driverOffers) {
      if (driver.authorUid === request.authorUid) continue; // skip own
      if (!driver.startLat || !driver.startLng || !driver.destLat || !driver.destLng) continue;

      const seatsRemaining = driver.seatsRemaining ?? driver.seatsAvailable;
      if (seatsRemaining <= 0) continue;

      const radius = driver.pickupRadiusMeters ?? 2000;

      const pickupDetour = pointToSegmentDistance(
        request.startLat, request.startLng,
        driver.startLat, driver.startLng,
        driver.destLat, driver.destLng
      );

      const dropoffDetour = pointToSegmentDistance(
        request.destLat, request.destLng,
        driver.startLat, driver.startLng,
        driver.destLat, driver.destLng
      );

      if (pickupDetour > radius || dropoffDetour > radius) continue;

      if (!directionIsCompatible(
        request.startLat, request.startLng,
        request.destLat, request.destLng,
        driver.startLat, driver.startLng,
        driver.destLat, driver.destLng
      )) continue;

      const driverMinutes = timeToMinutes(driver.departureTime);
      const riderMinutes = timeToMinutes(request.departureTime);
      const flexibility = driver.timeFlexibilityMinutes ?? 30;
      const timeDelta = Math.abs(driverMinutes - riderMinutes);
      if (timeDelta > flexibility) continue;

      const matchScore = computeMatchScore(pickupDetour, dropoffDetour, timeDelta);

      results.push({
        commute: driver,
        matchScore,
        pickupDetourMeters: Math.round(pickupDetour),
        dropoffDetourMeters: Math.round(dropoffDetour),
        totalDetourMeters: Math.round(pickupDetour + dropoffDetour),
        timeDeltaMinutes: timeDelta,
        seatsRemaining,
      });
    }

    results.sort((a, b) => a.matchScore - b.matchScore);
    return results;
  }
}

export const matchingService = new MatchingService();
