import { Request, Response } from 'express';
import { prisma } from '../index';
import { Prisma } from '@prisma/client';
import fs from 'fs/promises';

export const getCarriers = async (req: Request, res: Response) => {
  try {
    const { status, onboardingComplete, search, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    
    // Build filter
    const where: Prisma.CarrierWhereInput = {};
    if (status) where.status = status as any;
    if (onboardingComplete !== undefined) {
      where.onboardingComplete = onboardingComplete === 'true';
    }
    
    // Add search functionality
    if (search) {
      const searchTerm = search as string;
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { mcNumber: { contains: searchTerm, mode: 'insensitive' } },
        { dotNumber: { contains: searchTerm, mode: 'insensitive' } },
        { city: { contains: searchTerm, mode: 'insensitive' } }
      ];
    }

    // Get total count
    const total = await prisma.carrier.count({ where });

    // Get carriers with pagination
    const carriers = await prisma.carrier.findMany({
      where,
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: {
            bookings: true,
            documents: true,
            preferredRoutes: true
          }
        }
      }
    });

    return res.json({
      carriers,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get carriers error:', error);
    return res.status(500).json({ message: 'Failed to fetch carriers' });
  }
};

export const searchCarriers = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    const searchTerm = q as string;

    const carriers = await prisma.carrier.findMany({
      where: {
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { email: { contains: searchTerm, mode: 'insensitive' } },
          { mcNumber: { contains: searchTerm, mode: 'insensitive' } },
          { dotNumber: { contains: searchTerm, mode: 'insensitive' } }
        ]
      },
      take: 10
    });

    return res.json(carriers);
  } catch (error) {
    console.error('Search carriers error:', error);
    return res.status(500).json({ message: 'Search failed' });
  }
};

export const getCarrierById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const carrier = await prisma.carrier.findUnique({
      where: { id: parseInt(id) },
      include: {
        bookings: {
          include: {
            route: true
          },
          orderBy: { bookingDate: 'desc' },
          take: 10
        },
        preferredRoutes: {
          include: {
            route: true
          }
        },
        documents: {
          orderBy: { uploadedAt: 'desc' }
        }
      }
    });

    if (!carrier) {
      return res.status(404).json({ message: 'Carrier not found' });
    }

    return res.json(carrier);
  } catch (error) {
    console.error('Get carrier by id error:', error);
    return res.status(500).json({ message: 'Failed to fetch carrier' });
  }
};

export const createCarrier = async (req: Request, res: Response) => {
  try {
    const carrierData = req.body;

    // Check for duplicate MC/DOT numbers
    if (carrierData.mcNumber) {
      const existing = await prisma.carrier.findUnique({
        where: { mcNumber: carrierData.mcNumber }
      });
      if (existing) {
        return res.status(409).json({ message: 'MC number already exists' });
      }
    }

    if (carrierData.dotNumber) {
      const existing = await prisma.carrier.findUnique({
        where: { dotNumber: carrierData.dotNumber }
      });
      if (existing) {
        return res.status(409).json({ message: 'DOT number already exists' });
      }
    }

    const carrier = await prisma.carrier.create({
      data: {
        ...carrierData,
        insuranceExpiration: carrierData.insuranceExpiration 
          ? new Date(carrierData.insuranceExpiration) 
          : undefined,
        ratePerMile: carrierData.ratePerMile 
          ? parseFloat(carrierData.ratePerMile) 
          : undefined
      }
    });

    return res.status(201).json(carrier);
  } catch (error) {
    console.error('Create carrier error:', error);
    return res.status(500).json({ message: 'Failed to create carrier' });
  }
};

export const updateCarrier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check for duplicate MC/DOT numbers
    if (updateData.mcNumber) {
      const existing = await prisma.carrier.findFirst({
        where: { 
          mcNumber: updateData.mcNumber,
          NOT: { id: parseInt(id) }
        }
      });
      if (existing) {
        return res.status(409).json({ message: 'MC number already exists' });
      }
    }

    if (updateData.dotNumber) {
      const existing = await prisma.carrier.findFirst({
        where: { 
          dotNumber: updateData.dotNumber,
          NOT: { id: parseInt(id) }
        }
      });
      if (existing) {
        return res.status(409).json({ message: 'DOT number already exists' });
      }
    }

    const carrier = await prisma.carrier.update({
      where: { id: parseInt(id) },
      data: {
        ...updateData,
        insuranceExpiration: updateData.insuranceExpiration 
          ? new Date(updateData.insuranceExpiration) 
          : undefined,
        ratePerMile: updateData.ratePerMile 
          ? parseFloat(updateData.ratePerMile) 
          : undefined,
        rating: updateData.rating 
          ? parseFloat(updateData.rating) 
          : undefined
      }
    });

    return res.json(carrier);
  } catch (error) {
    console.error('Update carrier error:', error);
    return res.status(500).json({ message: 'Failed to update carrier' });
  }
};

export const deleteCarrier = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.carrier.delete({
      where: { id: parseInt(id) }
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Delete carrier error:', error);
    return res.status(500).json({ message: 'Failed to delete carrier' });
  }
};

export const uploadDocument = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { documentType } = req.body;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Create document record
    const document = await prisma.carrierDocument.create({
      data: {
        carrierId: parseInt(id),
        documentType,
        filename: file.originalname,
        filePath: file.path
      }
    });

    return res.status(201).json(document);
  } catch (error) {
    console.error('Upload document error:', error);
    // Clean up uploaded file if database operation fails
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (e) {
        console.error('Failed to delete uploaded file:', e);
      }
    }
    return res.status(500).json({ message: 'Failed to upload document' });
  }
};