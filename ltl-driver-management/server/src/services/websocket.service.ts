/**
 * WebSocket Service for Real-Time GPS Tracking
 * Provides live vehicle location updates to connected clients
 */

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { log } from '../utils/logger';
import { VehicleLocationData } from './motive.service';

// Event types for type safety
export interface ServerToClientEvents {
  // Location updates
  'location:update': (data: LocationUpdatePayload) => void;
  'location:batch': (data: LocationBatchPayload) => void;
  'location:sync-complete': (data: SyncCompletePayload) => void;

  // Trip updates
  'trip:eta-update': (data: EtaUpdatePayload) => void;

  // Geofence alerts
  'geofence:alert': (data: GeofenceAlertPayload) => void;

  // Connection events
  'error': (data: { message: string; code?: string }) => void;
}

export interface ClientToServerEvents {
  // Subscribe to specific vehicles or all
  'subscribe:vehicle': (unitNumber: string) => void;
  'unsubscribe:vehicle': (unitNumber: string) => void;
  'subscribe:all-vehicles': () => void;
  'unsubscribe:all-vehicles': () => void;

  // Subscribe to trip ETAs
  'subscribe:trip': (tripId: number) => void;
  'unsubscribe:trip': (tripId: number) => void;

  // Subscribe to geofence alerts
  'subscribe:geofence-alerts': () => void;
  'unsubscribe:geofence-alerts': () => void;
  'subscribe:terminal-alerts': (terminalId: number) => void;
  'unsubscribe:terminal-alerts': (terminalId: number) => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId: number;
  email: string;
  role: string;
  subscribedVehicles: Set<string>;
  subscribedTrips: Set<number>;
  subscribedTerminals: Set<number>;
  subscribeAll: boolean;
  subscribeGeofenceAlerts: boolean;
}

// Payload types
export interface LocationUpdatePayload {
  unitNumber: string;
  latitude: number;
  longitude: number;
  speed: number | null;
  bearing: number;
  locatedAt: string;
  description: string;
  odometer: number;
  fuelPercentage: number | null;
  currentDriverName: string | null;
  currentDriverId: string | null;
}

export interface LocationBatchPayload {
  locations: LocationUpdatePayload[];
  timestamp: string;
  total: number;
}

export interface SyncCompletePayload {
  trucksUpdated: number;
  trucksNotFound: number;
  total: number;
  timestamp: string;
}

export interface EtaUpdatePayload {
  tripId: number;
  tripNumber: string;
  estimatedArrival: string | null;
  source: 'GPS' | 'PROFILE' | 'NONE';
  distanceRemaining?: number;
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
}

export interface GeofenceAlertPayload {
  type: 'APPROACHING' | 'ARRIVED' | 'DEPARTED';
  vehicleUnitNumber: string;
  terminalId: number;
  terminalCode: string;
  terminalName: string;
  distanceMiles: number;
  timestamp: string;
  tripId?: number;
  tripNumber?: string;
  driverName?: string;
}

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

class WebSocketService {
  private io: TypedServer | null = null;
  private connectedClients: Map<string, SocketData> = new Map();

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: HttpServer, corsOrigins: string[]): void {
    this.io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
      cors: {
        origin: corsOrigins,
        methods: ['GET', 'POST'],
        credentials: true
      },
      path: '/ws',
      transports: ['websocket', 'polling']
    });

    // Authentication middleware
    this.io.use(this.authenticateSocket.bind(this));

    // Connection handler
    this.io.on('connection', this.handleConnection.bind(this));

    log.lifecycle('WebSocket server initialized', { path: '/ws' });
  }

  /**
   * Authenticate socket connection using JWT
   */
  private async authenticateSocket(socket: TypedSocket, next: (err?: Error) => void): Promise<void> {
    try {
      // Get token from auth header or query param
      const token = socket.handshake.auth?.token ||
                    socket.handshake.headers?.authorization?.replace('Bearer ', '') ||
                    socket.handshake.query?.token as string;

      if (!token) {
        return next(new Error('Authentication required'));
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        log.error('WEBSOCKET', 'JWT_SECRET not configured');
        return next(new Error('Server configuration error'));
      }

      // Verify JWT token
      const decoded = jwt.verify(token, jwtSecret) as {
        userId: number;
        email: string;
        role: string;
      };

      // Attach user data to socket
      socket.data.userId = decoded.userId;
      socket.data.email = decoded.email;
      socket.data.role = decoded.role;
      socket.data.subscribedVehicles = new Set();
      socket.data.subscribedTrips = new Set();
      socket.data.subscribedTerminals = new Set();
      socket.data.subscribeAll = false;
      socket.data.subscribeGeofenceAlerts = false;

      next();
    } catch (error) {
      log.warn('WEBSOCKET', 'Authentication failed', { error: error instanceof Error ? error.message : 'Unknown' });
      next(new Error('Invalid token'));
    }
  }

  /**
   * Handle new socket connection
   */
  private handleConnection(socket: TypedSocket): void {
    const { userId, email, role } = socket.data;

    this.connectedClients.set(socket.id, socket.data);
    log.info('WEBSOCKET', 'Client connected', { socketId: socket.id, userId, email, role });

    // Handle vehicle subscriptions
    socket.on('subscribe:vehicle', (unitNumber: string) => {
      socket.data.subscribedVehicles.add(unitNumber);
      socket.join(`vehicle:${unitNumber}`);
      log.debug('WEBSOCKET', 'Subscribed to vehicle', { socketId: socket.id, unitNumber });
    });

    socket.on('unsubscribe:vehicle', (unitNumber: string) => {
      socket.data.subscribedVehicles.delete(unitNumber);
      socket.leave(`vehicle:${unitNumber}`);
      log.debug('WEBSOCKET', 'Unsubscribed from vehicle', { socketId: socket.id, unitNumber });
    });

    socket.on('subscribe:all-vehicles', () => {
      socket.data.subscribeAll = true;
      socket.join('vehicles:all');
      log.debug('WEBSOCKET', 'Subscribed to all vehicles', { socketId: socket.id });
    });

    socket.on('unsubscribe:all-vehicles', () => {
      socket.data.subscribeAll = false;
      socket.leave('vehicles:all');
      log.debug('WEBSOCKET', 'Unsubscribed from all vehicles', { socketId: socket.id });
    });

    // Handle trip ETA subscriptions
    socket.on('subscribe:trip', (tripId: number) => {
      socket.data.subscribedTrips.add(tripId);
      socket.join(`trip:${tripId}`);
      log.debug('WEBSOCKET', 'Subscribed to trip', { socketId: socket.id, tripId });
    });

    socket.on('unsubscribe:trip', (tripId: number) => {
      socket.data.subscribedTrips.delete(tripId);
      socket.leave(`trip:${tripId}`);
      log.debug('WEBSOCKET', 'Unsubscribed from trip', { socketId: socket.id, tripId });
    });

    // Handle geofence alert subscriptions
    socket.on('subscribe:geofence-alerts', () => {
      socket.data.subscribeGeofenceAlerts = true;
      socket.join('geofence:all');
      log.debug('WEBSOCKET', 'Subscribed to all geofence alerts', { socketId: socket.id });
    });

    socket.on('unsubscribe:geofence-alerts', () => {
      socket.data.subscribeGeofenceAlerts = false;
      socket.leave('geofence:all');
      log.debug('WEBSOCKET', 'Unsubscribed from geofence alerts', { socketId: socket.id });
    });

    socket.on('subscribe:terminal-alerts', (terminalId: number) => {
      socket.data.subscribedTerminals.add(terminalId);
      socket.join(`terminal:${terminalId}`);
      log.debug('WEBSOCKET', 'Subscribed to terminal alerts', { socketId: socket.id, terminalId });
    });

    socket.on('unsubscribe:terminal-alerts', (terminalId: number) => {
      socket.data.subscribedTerminals.delete(terminalId);
      socket.leave(`terminal:${terminalId}`);
      log.debug('WEBSOCKET', 'Unsubscribed from terminal alerts', { socketId: socket.id, terminalId });
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      this.connectedClients.delete(socket.id);
      log.info('WEBSOCKET', 'Client disconnected', { socketId: socket.id, userId, reason });
    });
  }

  /**
   * Broadcast location update for a single vehicle
   */
  broadcastLocationUpdate(location: VehicleLocationData): void {
    if (!this.io) return;

    const payload: LocationUpdatePayload = {
      unitNumber: location.unitNumber,
      latitude: location.latitude,
      longitude: location.longitude,
      speed: location.speed,
      bearing: location.bearing,
      locatedAt: location.locatedAt.toISOString(),
      description: location.description,
      odometer: location.odometer,
      fuelPercentage: location.fuelPercentage,
      currentDriverName: location.currentDriverName,
      currentDriverId: location.currentDriverId
    };

    // Send to specific vehicle subscribers
    this.io.to(`vehicle:${location.unitNumber}`).emit('location:update', payload);

    // Send to all-vehicles subscribers
    this.io.to('vehicles:all').emit('location:update', payload);
  }

  /**
   * Broadcast batch location updates (after sync)
   */
  broadcastLocationBatch(locations: VehicleLocationData[]): void {
    if (!this.io) return;

    const payload: LocationBatchPayload = {
      locations: locations.map(loc => ({
        unitNumber: loc.unitNumber,
        latitude: loc.latitude,
        longitude: loc.longitude,
        speed: loc.speed,
        bearing: loc.bearing,
        locatedAt: loc.locatedAt.toISOString(),
        description: loc.description,
        odometer: loc.odometer,
        fuelPercentage: loc.fuelPercentage,
        currentDriverName: loc.currentDriverName,
        currentDriverId: loc.currentDriverId
      })),
      timestamp: new Date().toISOString(),
      total: locations.length
    };

    // Send to all-vehicles subscribers
    this.io.to('vehicles:all').emit('location:batch', payload);

    // Send individual updates to specific vehicle subscribers
    for (const location of locations) {
      const singlePayload: LocationUpdatePayload = {
        unitNumber: location.unitNumber,
        latitude: location.latitude,
        longitude: location.longitude,
        speed: location.speed,
        bearing: location.bearing,
        locatedAt: location.locatedAt.toISOString(),
        description: location.description,
        odometer: location.odometer,
        fuelPercentage: location.fuelPercentage,
        currentDriverName: location.currentDriverName,
        currentDriverId: location.currentDriverId
      };
      this.io.to(`vehicle:${location.unitNumber}`).emit('location:update', singlePayload);
    }
  }

  /**
   * Broadcast sync completion status
   */
  broadcastSyncComplete(result: { trucksUpdated: number; trucksNotFound: number; total: number }): void {
    if (!this.io) return;

    const payload: SyncCompletePayload = {
      trucksUpdated: result.trucksUpdated,
      trucksNotFound: result.trucksNotFound,
      total: result.total,
      timestamp: new Date().toISOString()
    };

    this.io.to('vehicles:all').emit('location:sync-complete', payload);
  }

  /**
   * Broadcast ETA update for a trip
   */
  broadcastEtaUpdate(tripId: number, tripNumber: string, eta: {
    estimatedArrival: Date | null;
    source: 'GPS' | 'PROFILE' | 'NONE';
    distanceRemaining?: number;
    currentLocation?: { latitude: number; longitude: number };
  }): void {
    if (!this.io) return;

    const payload: EtaUpdatePayload = {
      tripId,
      tripNumber,
      estimatedArrival: eta.estimatedArrival?.toISOString() || null,
      source: eta.source,
      distanceRemaining: eta.distanceRemaining,
      currentLocation: eta.currentLocation
    };

    this.io.to(`trip:${tripId}`).emit('trip:eta-update', payload);
  }

  /**
   * Broadcast geofence alert
   */
  broadcastGeofenceAlert(alert: {
    type: 'APPROACHING' | 'ARRIVED' | 'DEPARTED';
    vehicleUnitNumber: string;
    terminalId: number;
    terminalCode: string;
    terminalName: string;
    distanceMiles: number;
    timestamp: Date;
    tripId?: number;
    tripNumber?: string;
    driverName?: string;
  }): void {
    if (!this.io) return;

    const payload: GeofenceAlertPayload = {
      type: alert.type,
      vehicleUnitNumber: alert.vehicleUnitNumber,
      terminalId: alert.terminalId,
      terminalCode: alert.terminalCode,
      terminalName: alert.terminalName,
      distanceMiles: alert.distanceMiles,
      timestamp: alert.timestamp.toISOString(),
      tripId: alert.tripId,
      tripNumber: alert.tripNumber,
      driverName: alert.driverName
    };

    // Send to all geofence alert subscribers
    this.io.to('geofence:all').emit('geofence:alert', payload);

    // Send to terminal-specific subscribers
    this.io.to(`terminal:${alert.terminalId}`).emit('geofence:alert', payload);

    // Send to vehicle subscribers
    this.io.to(`vehicle:${alert.vehicleUnitNumber}`).emit('geofence:alert', payload);

    log.info('WEBSOCKET', 'Geofence alert broadcast', {
      type: alert.type,
      vehicle: alert.vehicleUnitNumber,
      terminal: alert.terminalCode
    });
  }

  /**
   * Get connection statistics
   */
  getStats(): { connectedClients: number; rooms: string[] } {
    if (!this.io) {
      return { connectedClients: 0, rooms: [] };
    }

    const rooms = Array.from(this.io.sockets.adapter.rooms.keys())
      .filter(room =>
        room.startsWith('vehicle:') ||
        room.startsWith('trip:') ||
        room.startsWith('terminal:') ||
        room.startsWith('geofence:') ||
        room === 'vehicles:all'
      );

    return {
      connectedClients: this.connectedClients.size,
      rooms
    };
  }

  /**
   * Get the Socket.IO server instance
   */
  getIO(): TypedServer | null {
    return this.io;
  }
}

// Singleton instance
export const websocketService = new WebSocketService();
