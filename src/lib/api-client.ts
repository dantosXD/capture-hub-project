/**
 * API Client functions for server mutations
 * Designed to work with useOptimisticMutation hook
 */

import { WSEventType, type WSEvent } from './ws-events';
import { fetchWithOfflineQueue } from './offline-queue';

export interface APIError {
  message: string;
  status?: number;
  code?: string;
}

/**
 * Base API client with error handling and offline support
 */
class APIClient {
  private baseURL: string;

  constructor() {
    if (typeof window !== 'undefined') {
      // Use the current page's protocol, hostname, and port
      const port = window.location.port ? `:${window.location.port}` : '';
      this.baseURL = `${window.location.protocol}//${window.location.hostname}${port}`;
    } else {
      // Default to port 3000 for server-side rendering
      this.baseURL = 'http://localhost:3000';
    }
  }

  private async handleResponse(response: Response): Promise<any> {
    if (!response.ok) {
      let message = 'Request failed';
      try {
        const errorData = await response.json();
        message = errorData.error || errorData.message || message;
      } catch {
        message = response.statusText || message;
      }
      throw new Error(message);
    }
    return response.json();
  }

  private async request(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;

    // Use offline queue for mutation requests when offline
    const method = options.method || 'GET';
    if (method !== 'GET' && typeof window !== 'undefined') {
      try {
        const response = await fetchWithOfflineQueue(url, options);
        return this.handleResponse(response);
      } catch (error: any) {
        // If offline queue handled the error, throw it
        if (error.message?.includes('OFFLINE:')) {
          throw error;
        }
        // Otherwise, re-throw
        throw error;
      }
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    return this.handleResponse(response);
  }

  // Capture Item API
  async createCaptureItem(data: any): Promise<any> {
    return this.request('/api/capture', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCaptureItem(id: string, data: any): Promise<any> {
    return this.request(`/api/capture/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCaptureItem(id: string): Promise<void> {
    await this.request(`/api/capture/${id}`, {
      method: 'DELETE',
    });
  }

  async bulkUpdateItems(itemIds: string[], changes: any): Promise<any> {
    return this.request('/api/inbox/assign', {
      method: 'POST',
      body: JSON.stringify({ itemIds, changes }),
    });
  }

  // Project API
  async createProject(data: any): Promise<any> {
    return this.request('/api/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateProject(id: string, data: any): Promise<any> {
    return this.request(`/api/projects/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteProject(id: string): Promise<void> {
    await this.request(`/api/projects/${id}`, {
      method: 'DELETE',
    });
  }

  // Template API
  async createTemplate(data: any): Promise<any> {
    return this.request('/api/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Link API
  async createLink(data: any): Promise<any> {
    return this.request('/api/links', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteLink(sourceId: string, targetId: string): Promise<void> {
    await this.request('/api/links', {
      method: 'DELETE',
      body: JSON.stringify({ sourceId, targetId }),
    });
  }

  // OCR API
  async processOCR(imageData: string): Promise<{ extractedText: string }> {
    return this.request('/api/capture/ocr', {
      method: 'POST',
      body: JSON.stringify({ imageData }),
    });
  }

  // Web Capture API
  async extractWebpage(url: string): Promise<any> {
    return this.request('/api/capture/webpage', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  // Stats API
  async getStats(type: 'capture' | 'inbox' | 'processing' | 'all' = 'all'): Promise<any> {
    return this.request(`/api/stats?type=${type}`, {
      method: 'GET',
    });
  }

  // Search API
  async search(query: string, options: { aiEnhanced?: boolean } = {}): Promise<any> {
    const params = new URLSearchParams({
      q: query,
      ...(options.aiEnhanced && { ai: 'true' }),
    });
    return this.request(`/api/search?${params}`, {
      method: 'GET',
    });
  }
}

// Global API client instance
export const apiClient = new APIClient();

/**
 * Capture Item mutations for use with optimistic updates
 */
export const captureItemMutations = {
  create: async (data: any) => {
    return apiClient.createCaptureItem(data);
  },

  update: async (id: string, data: any) => {
    return apiClient.updateCaptureItem(id, data);
  },

  delete: async (id: string) => {
    return apiClient.deleteCaptureItem(id);
  },

  bulkUpdate: async (itemIds: string[], changes: any) => {
    return apiClient.bulkUpdateItems(itemIds, changes);
  },
};

/**
 * Project mutations for use with optimistic updates
 */
export const projectMutations = {
  create: async (data: any) => {
    return apiClient.createProject(data);
  },

  update: async (id: string, data: any) => {
    return apiClient.updateProject(id, data);
  },

  delete: async (id: string) => {
    return apiClient.deleteProject(id);
  },
};

/**
 * Link mutations for use with optimistic updates
 */
export const linkMutations = {
  create: async (data: any) => {
    return apiClient.createLink(data);
  },

  delete: async (sourceId: string, targetId: string) => {
    return apiClient.deleteLink(sourceId, targetId);
  },
};

/**
 * Optimistic mutation helpers that integrate with WebSocket
 * These functions return promises and handle broadcasting automatically
 */
export async function createCaptureItemWithOptimism(
  data: any,
  wsSend?: (type: string, data?: any) => void
): Promise<any> {
  // The API will broadcast the WebSocket event, but for optimistic updates
  // we might want to broadcast locally first
  const result = await captureItemMutations.create(data);

  // WebSocket event is already broadcast by the API endpoint
  // No need to send again from client

  return result;
}

export async function updateCaptureItemWithOptimism(
  id: string,
  data: any,
  previousState: any,
  wsSend?: (type: string, data?: any) => void
): Promise<any> {
  const result = await captureItemMutations.update(id, data);

  // WebSocket event is already broadcast by the API endpoint
  return result;
}

export async function deleteCaptureItemWithOptimism(
  id: string,
  wsSend?: (type: string, data?: any) => void
): Promise<void> {
  await captureItemMutations.delete(id);

  // WebSocket event is already broadcast by the API endpoint
}
