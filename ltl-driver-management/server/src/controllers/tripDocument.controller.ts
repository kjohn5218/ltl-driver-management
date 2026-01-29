/**
 * Trip Document Controller
 *
 * Handles HTTP requests for trip document operations.
 */

import { Request, Response } from 'express';
import { tripDocumentService } from '../services/tripDocument.service';

/**
 * Get all documents for a trip
 */
export const getTripDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const tripId = parseInt(req.params.tripId, 10);

    if (isNaN(tripId)) {
      res.status(400).json({ message: 'Invalid trip ID' });
      return;
    }

    const result = await tripDocumentService.getTripDocuments(tripId);
    res.json(result);
  } catch (error) {
    console.error('Error getting trip documents:', error);
    res.status(500).json({ message: 'Failed to get trip documents' });
  }
};

/**
 * Get document by ID
 */
export const getDocumentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const documentId = parseInt(req.params.id, 10);

    if (isNaN(documentId)) {
      res.status(400).json({ message: 'Invalid document ID' });
      return;
    }

    const document = await tripDocumentService.getDocumentById(documentId);

    if (!document) {
      res.status(404).json({ message: 'Document not found' });
      return;
    }

    res.json(document);
  } catch (error) {
    console.error('Error getting document:', error);
    res.status(500).json({ message: 'Failed to get document' });
  }
};

/**
 * Download document as PDF
 */
export const downloadDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const documentId = parseInt(req.params.id, 10);

    if (isNaN(documentId)) {
      res.status(400).json({ message: 'Invalid document ID' });
      return;
    }

    const document = await tripDocumentService.getDocumentById(documentId);

    if (!document) {
      res.status(404).json({ message: 'Document not found' });
      return;
    }

    let pdfBuffer: Buffer;
    let filename: string;

    if (document.documentType === 'LINEHAUL_MANIFEST') {
      pdfBuffer = await tripDocumentService.generateManifestPDF(documentId);
      filename = `linehaul-manifest-${document.documentNumber}.pdf`;
    } else if (document.documentType === 'PLACARD_SHEET') {
      pdfBuffer = await tripDocumentService.generatePlacardSheetPDF(documentId);
      filename = `placard-info-${document.documentNumber}.pdf`;
    } else {
      res.status(400).json({ message: 'Unsupported document type for download' });
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ message: 'Failed to download document' });
  }
};

/**
 * Download Hazmat BOL PDF
 */
export const downloadHazmatBOL = async (req: Request, res: Response): Promise<void> => {
  try {
    const tripId = parseInt(req.params.tripId, 10);
    const proNumber = req.params.proNumber;

    if (isNaN(tripId)) {
      res.status(400).json({ message: 'Invalid trip ID' });
      return;
    }

    if (!proNumber) {
      res.status(400).json({ message: 'Pro number is required' });
      return;
    }

    const pdfBuffer = await tripDocumentService.generateHazmatBOLPDF(tripId, proNumber);
    const filename = `hazmat-bol-${proNumber}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Error downloading hazmat BOL:', error);
    res.status(500).json({ message: 'Failed to download hazmat BOL' });
  }
};

/**
 * Generate documents for a trip (manual trigger)
 */
export const generateDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const tripId = parseInt(req.params.tripId, 10);

    if (isNaN(tripId)) {
      res.status(400).json({ message: 'Invalid trip ID' });
      return;
    }

    await tripDocumentService.generateAllDocuments(tripId);
    const result = await tripDocumentService.getTripDocuments(tripId);

    res.json({
      message: 'Documents generated successfully',
      ...result,
    });
  } catch (error) {
    console.error('Error generating documents:', error);
    res.status(500).json({ message: 'Failed to generate documents' });
  }
};

/**
 * Regenerate a specific document
 */
export const regenerateDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const documentId = parseInt(req.params.id, 10);

    if (isNaN(documentId)) {
      res.status(400).json({ message: 'Invalid document ID' });
      return;
    }

    await tripDocumentService.regenerateDocument(documentId);

    res.json({ message: 'Document regenerated successfully' });
  } catch (error) {
    console.error('Error regenerating document:', error);
    res.status(500).json({ message: 'Failed to regenerate document' });
  }
};

/**
 * Get document preview (HTML)
 */
export const getDocumentPreview = async (req: Request, res: Response): Promise<void> => {
  try {
    const documentId = parseInt(req.params.id, 10);

    if (isNaN(documentId)) {
      res.status(400).json({ message: 'Invalid document ID' });
      return;
    }

    const document = await tripDocumentService.getDocumentById(documentId);

    if (!document) {
      res.status(404).json({ message: 'Document not found' });
      return;
    }

    // For preview, we return the document data which can be rendered on the frontend
    res.json({
      documentType: document.documentType,
      documentNumber: document.documentNumber,
      data: document.manifestData || document.placardData,
    });
  } catch (error) {
    console.error('Error getting document preview:', error);
    res.status(500).json({ message: 'Failed to get document preview' });
  }
};
