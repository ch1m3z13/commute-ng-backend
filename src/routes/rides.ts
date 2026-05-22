import { Router, Response } from 'express';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth.js';
import { rideService } from '../services/rideService.js';
import { notificationService } from '../services/notificationService.js';
import { userService } from './../services/userService.js';
import { commuteService } from './../services/commuteService.js';
import { geocodingService } from './../services/geocodingService.js';
import { z } from 'zod';

const router = Router();

router.get('/my-bookings', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rides = await rideService.getRidesForPassenger(req.user!.uid);
    return res.json(rides);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

router.get('/my-requests', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const rides = await rideService.getRidesForDriver(req.user!.uid);
    return res.json(rides);
  } catch (error) {
    console.error('Error fetching requests:', error);
    return res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

router.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ride = await rideService.getRide(req.params.id);
    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    const hasAccess = ride.driverUid === req.user!.uid || ride.passengerUid === req.user!.uid;
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    return res.json(ride);
  } catch (error) {
    console.error('Error fetching ride:', error);
    return res.status(500).json({ error: 'Failed to fetch ride' });
  }
});

router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { commuteId } = req.body;

    if (!commuteId) {
      return res.status(400).json({ error: 'commuteId is required' });
    }

    const commute = await commuteService.getCommute(commuteId);
    if (!commute) {
      return res.status(404).json({ error: 'Commute not found' });
    }

    if (commute.authorUid === req.user!.uid) {
      return res.status(400).json({ error: 'Cannot request your own commute' });
    }

    if (commute.status !== 'active') {
      return res.status(400).json({ error: 'Commute is not available' });
    }

    // Check capacity
    const seatsRemaining = commute.seatsRemaining ?? commute.seatsAvailable;
    if (seatsRemaining <= 0) {
      return res.status(400).json({ error: 'No seats available on this commute' });
    }

    const user = await userService.getUser(req.user!.uid);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const ride = await rideService.requestRide(
      req.user!.uid,
      user.displayName,
      user.photoURL || null,
      commuteId,
      {
        driverUid: commute.authorUid,
        startPoint: commute.startPoint,
        destination: commute.destination,
        departureTime: commute.departureTime,
        seatsAvailable: commute.seatsAvailable,
        carMake: commute.carMake,
        carModel: commute.carModel,
        carYear: commute.carYear,
        plateNumber: commute.plateNumber,
      },
      req.body.matchScore,
      req.body.detourMeters,
    );

    await notificationService.createRideRequestNotification(
      commute.authorUid,
      req.user!.uid,
      user.displayName,
      user.photoURL || null,
      ride.id!,
      commuteId,
      commute.startPoint,
      commute.destination,
      commute.departureTime
    );

    return res.status(201).json(ride);
  } catch (error) {
    console.error('Error creating ride:', error);
    return res.status(500).json({ error: 'Failed to create ride' });
  }
});

router.patch('/:id/accept', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ride = await rideService.getRide(req.params.id);
    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    if (ride.driverUid !== req.user!.uid) {
      return res.status(403).json({ error: 'Only the driver can accept rides' });
    }

    const updatedRide = await rideService.acceptRide(req.params.id, req.user!.uid);
    if (!updatedRide) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    const driver = await userService.getUser(req.user!.uid);

    await notificationService.createRequestAcceptedNotification(
      ride.passengerUid,
      req.user!.uid,
      driver?.displayName || 'Driver',
      driver?.photoURL || null,
      ride.id!,
      ride.startPoint,
      ride.destination,
      ride.departureTime
    );

    return res.json(updatedRide);
  } catch (error: any) {
    console.error('Error accepting ride:', error);
    if (error.message && error.message.includes('No seats available')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to accept ride' });
  }
});

router.patch('/:id/reject', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ride = await rideService.getRide(req.params.id);
    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    if (ride.driverUid !== req.user!.uid) {
      return res.status(403).json({ error: 'Only the driver can reject rides' });
    }

    const updatedRide = await rideService.rejectRide(req.params.id, req.user!.uid);
    if (!updatedRide) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    const driver = await userService.getUser(req.user!.uid);

    await notificationService.createRequestRejectedNotification(
      ride.passengerUid,
      req.user!.uid,
      driver?.displayName || 'Driver',
      driver?.photoURL || null,
      ride.id!,
      ride.startPoint,
      ride.destination,
      ride.departureTime
    );

    return res.json(updatedRide);
  } catch (error) {
    console.error('Error rejecting ride:', error);
    return res.status(500).json({ error: 'Failed to reject ride' });
  }
});

router.patch('/:id/complete', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ride = await rideService.completeRide(req.params.id, req.user!.uid);
    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }
    return res.json(ride);
  } catch (error) {
    console.error('Error completing ride:', error);
    return res.status(500).json({ error: 'Failed to complete ride' });
  }
});

router.patch('/:id/cancel', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ride = await rideService.cancelRide(req.params.id, req.user!.uid);
    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }
    return res.json(ride);
  } catch (error) {
    console.error('Error cancelling ride:', error);
    return res.status(500).json({ error: 'Failed to cancel ride' });
  }
});

export default router;
