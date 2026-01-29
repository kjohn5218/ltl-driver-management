/**
 * Trip Document Service
 *
 * Frontend service for trip document operations.
 */

import { api } from './api';
import { TripDocument, TripDocumentsResponse } from '../types';

export const tripDocumentService = {
  /**
   * Get all documents for a trip
   */
  getTripDocuments: async (tripId: number): Promise<TripDocumentsResponse> => {
    const response = await api.get(`/trip-documents/trip/${tripId}`);
    return response.data;
  },

  /**
   * Get document by ID
   */
  getDocumentById: async (id: number): Promise<TripDocument> => {
    const response = await api.get(`/trip-documents/${id}`);
    return response.data;
  },

  /**
   * Download document as PDF
   */
  downloadDocument: async (id: number): Promise<Blob> => {
    const response = await api.get(`/trip-documents/${id}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Download Hazmat BOL for a specific shipment
   */
  downloadHazmatBOL: async (tripId: number, proNumber: string): Promise<Blob> => {
    const response = await api.get(`/trip-documents/trip/${tripId}/hazmat-bol/${proNumber}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Get document preview data
   */
  getDocumentPreview: async (id: number): Promise<{
    documentType: string;
    documentNumber: string;
    data: any;
  }> => {
    const response = await api.get(`/trip-documents/${id}/preview`);
    return response.data;
  },

  /**
   * Generate documents for a trip (manual trigger)
   */
  generateDocuments: async (tripId: number): Promise<TripDocumentsResponse & { message: string }> => {
    const response = await api.post(`/trip-documents/trip/${tripId}/generate`);
    return response.data;
  },

  /**
   * Regenerate a specific document
   */
  regenerateDocument: async (id: number): Promise<{ message: string }> => {
    const response = await api.post(`/trip-documents/${id}/regenerate`);
    return response.data;
  },

  /**
   * Trigger download of a document
   */
  triggerDownload: async (id: number, filename: string): Promise<void> => {
    const blob = await tripDocumentService.downloadDocument(id);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  /**
   * Trigger download of Hazmat BOL
   */
  triggerHazmatBOLDownload: async (tripId: number, proNumber: string): Promise<void> => {
    const blob = await tripDocumentService.downloadHazmatBOL(tripId, proNumber);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hazmat-bol-${proNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  },

  /**
   * Open document in new tab for printing
   */
  printDocument: async (id: number): Promise<void> => {
    const blob = await tripDocumentService.downloadDocument(id);
    const url = window.URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Note: URL cleanup will happen when the new tab is closed
  },
};
