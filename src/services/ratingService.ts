import { getDb } from '../config/database.js';
import { randomUUID } from 'node:crypto';

export interface RideRating {
  id: string;
  rideId: string;
  raterUid: string;
  rateeUid: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export class RatingService {
  async rateRide(
    rideId: string,
    raterUid: string,
    rating: number,
    comment?: string
  ): Promise<RideRating> {
    const ride = await getDb().prepare('SELECT driverUid, passengerUid, status FROM rides WHERE id = ?').get(rideId) as { driverUid: string; passengerUid: string; status: string } | undefined;
    if (!ride) throw new Error('Ride not found');
    if (ride.status !== 'completed') throw new Error('Can only rate completed rides');

    const isDriver = ride.driverUid === raterUid;
    const isPassenger = ride.passengerUid === raterUid;
    if (!isDriver && !isPassenger) throw new Error('Only ride participants can rate');

    const rateeUid = isDriver ? ride.passengerUid : ride.driverUid;

    const existing = await getDb().prepare('SELECT id FROM ride_ratings WHERE ride_id = ? AND rater_uid = ?').get(rideId, raterUid);
    if (existing) throw new Error('Already rated this ride');

    const id = randomUUID();
    const now = new Date().toISOString();

    await getDb().prepare(`
      INSERT INTO ride_ratings (id, ride_id, rater_uid, ratee_uid, rating, comment, created_at)
      VALUES (@id, @ride_id, @rater_uid, @ratee_uid, @rating, @comment, @created_at)
    `).run({ id, ride_id: rideId, rater_uid: raterUid, ratee_uid: rateeUid, rating, comment: comment || null, created_at: now });

    await this.recalculateUserRating(rateeUid);

    return { id, rideId, raterUid, rateeUid, rating, comment, createdAt: now };
  }

  async getRideRating(rideId: string): Promise<RideRating | null> {
    const row = await getDb().prepare('SELECT * FROM ride_ratings WHERE ride_id = ?').get(rideId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      id: row.id as string,
      rideId: row.ride_id as string,
      raterUid: row.rater_uid as string,
      rateeUid: row.ratee_uid as string,
      rating: row.rating as number,
      comment: row.comment as string | undefined,
      createdAt: row.created_at as string,
    };
  }

  async getUserRatings(uid: string): Promise<{ average: number; count: number; ratings: RideRating[] }> {
    const rows = await getDb().prepare('SELECT * FROM ride_ratings WHERE ratee_uid = ? ORDER BY created_at DESC').all(uid) as Record<string, unknown>[];
    const stats = await getDb().prepare('SELECT AVG(rating) as average, COUNT(*) as count FROM ride_ratings WHERE ratee_uid = ?').get(uid) as { average: number; count: number };

    const ratings = rows.map(row => ({
      id: row.id as string,
      rideId: row.ride_id as string,
      raterUid: row.rater_uid as string,
      rateeUid: row.ratee_uid as string,
      rating: row.rating as number,
      comment: row.comment as string | undefined,
      createdAt: row.created_at as string,
    }));

    return {
      average: stats.average || 0,
      count: stats.count || 0,
      ratings,
    };
  }

  private async recalculateUserRating(uid: string): Promise<void> {
    const stats = await getDb().prepare('SELECT AVG(rating) as avg_rating FROM ride_ratings WHERE ratee_uid = ?').get(uid) as { avg_rating: number } | undefined;
    const newRating = stats?.avg_rating || 5.0;
    await getDb().prepare('UPDATE users SET rating = ?, updatedAt = ? WHERE uid = ?').run(newRating, new Date().toISOString(), uid);
  }
}

export const ratingService = new RatingService();
