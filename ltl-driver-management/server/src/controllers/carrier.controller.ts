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

export const inviteCarrier = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    // Check if carrier with this email already exists
    const existingCarrier = await prisma.carrier.findFirst({
      where: { email }
    });
    
    if (existingCarrier) {
      return res.status(400).json({ message: 'A carrier with this email already exists' });
    }
    
    // Import email service
    const { sendEmail } = await import('../services/notification.service');
    
    // Generate a unique registration token
    const registrationToken = Buffer.from(`${email}:${Date.now()}`).toString('base64');
    const registrationLink = `${process.env.FRONTEND_URL}/register/carrier?token=${encodeURIComponent(registrationToken)}`;
    
    // Send invitation email
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">PLEASE CLICK THE LINK BELOW TO REGISTER</h2>
        
        <p>TO WHOM IT MAY CONCERN:</p>
        
        <p>Thank you for your interest in registering with CrossCountry Freight Solutions, Inc.</p>
        
        <p>In order to set you up as a carrier in our system, you must register via the link below.</p>
        
        <div style="margin: 30px 0; text-align: center;">
          <a href="${registrationLink}" 
             style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Complete Your Registration
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">
          Or copy and paste this link into your browser:<br>
          ${registrationLink}
        </p>
        
        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        
        <p style="color: #999; font-size: 12px;">
          This invitation link will expire in 7 days. If you have any questions, please contact us at (800) 521-0287.
        </p>
      </div>
    `;
    
    await sendEmail({
      to: email,
      subject: 'Carrier Registration Invitation - CrossCountry Freight Solutions',
      html: emailContent
    });
    
    // Store the invitation in the database (optional - for tracking)
    // You might want to create a CarrierInvitation model to track these
    
    return res.status(200).json({ 
      message: 'Invitation sent successfully',
      email 
    });
  } catch (error) {
    console.error('Invite carrier error:', error);
    return res.status(500).json({ message: 'Failed to send invitation' });
  }
};