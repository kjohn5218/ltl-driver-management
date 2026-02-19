import { api } from './api';

// Types for Linehaul Lanes
export interface LinehaulLaneLocation {
  id: number;
  code: string;
  name: string;
  city: string | null;
}

export interface LinehaulLaneStep {
  id: number;
  laneId: number;
  sequence: number;
  terminalLocationId: number;
  transitDays: number;
  departDeadline: string | null;
  terminalLocation: LinehaulLaneLocation;
}

export interface LinehaulLane {
  id: number;
  originLocationId: number;
  destinationLocationId: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  originLocation: LinehaulLaneLocation;
  destinationLocation: LinehaulLaneLocation;
  routingSteps: LinehaulLaneStep[];
}

export interface LinehaulLaneFilters {
  originLocationId?: number;
  active?: boolean;
  page?: number;
  limit?: number;
}

export interface LinehaulLanesResponse {
  lanes: LinehaulLane[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateLinehaulLaneInput {
  originLocationId: number;
  destinationLocationId: number;
  active?: boolean;
  routingSteps?: {
    sequence?: number;
    terminalLocationId: number;
    transitDays?: number;
    departDeadline?: string | null;
  }[];
}

export interface UpdateLinehaulLaneInput {
  originLocationId?: number;
  destinationLocationId?: number;
  active?: boolean;
  routingSteps?: {
    sequence?: number;
    terminalLocationId: number;
    transitDays?: number;
    departDeadline?: string | null;
  }[];
}

export const linehaulLaneService = {
  // Get all linehaul lanes with optional filtering
  getLanes: async (filters?: LinehaulLaneFilters): Promise<LinehaulLanesResponse> => {
    const params = new URLSearchParams();
    if (filters?.originLocationId) params.append('originLocationId', filters.originLocationId.toString());
    if (filters?.active !== undefined) params.append('active', filters.active.toString());
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await api.get(`/linehaul-lanes?${params.toString()}`);
    return response.data;
  },

  // Get unique origin locations for dropdown
  getOriginLocations: async (): Promise<LinehaulLaneLocation[]> => {
    const response = await api.get('/linehaul-lanes/origins');
    return response.data;
  },

  // Get single linehaul lane by ID
  getLaneById: async (id: number): Promise<LinehaulLane> => {
    const response = await api.get(`/linehaul-lanes/${id}`);
    return response.data;
  },

  // Create a new linehaul lane
  createLane: async (data: CreateLinehaulLaneInput): Promise<LinehaulLane> => {
    const response = await api.post('/linehaul-lanes', data);
    return response.data;
  },

  // Update an existing linehaul lane
  updateLane: async (id: number, data: UpdateLinehaulLaneInput): Promise<LinehaulLane> => {
    const response = await api.put(`/linehaul-lanes/${id}`, data);
    return response.data;
  },

  // Delete a linehaul lane
  deleteLane: async (id: number): Promise<void> => {
    await api.delete(`/linehaul-lanes/${id}`);
  }
};
