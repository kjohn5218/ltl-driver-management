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
        drivers: {
          where: { active: true },
          orderBy: { name: 'asc' }
        },
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
    
    console.log('Get carrier by ID request - id param:', id);
    
    if (!id) {
      return res.status(400).json({ message: 'Carrier ID is required' });
    }
    
    const carrierId = parseInt(id);
    if (isNaN(carrierId)) {
      return res.status(400).json({ message: 'Invalid carrier ID' });
    }
    
    console.log('Parsed carrier ID:', carrierId);
    
    const carrier = await prisma.carrier.findUnique({
      where: { id: carrierId },
      include: {
        drivers: {
          where: { active: true },
          orderBy: { name: 'asc' }
        },
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
    const userId = (req as any).user?.id;
    
    // Check if carrier with this email already exists
    const existingCarrier = await prisma.carrier.findFirst({
      where: { email }
    });
    
    if (existingCarrier) {
      return res.status(400).json({ message: 'A carrier with this email already exists' });
    }
    
    // Check if there's already a pending invitation
    const existingInvitation = await prisma.carrierInvitation.findFirst({
      where: { 
        email,
        status: 'PENDING',
        expiresAt: { gt: new Date() }
      }
    });
    
    if (existingInvitation) {
      return res.status(409).json({ message: 'An active invitation already exists for this email' });
    }
    
    // Import email service
    const { sendEmail } = await import('../services/notification.service');
    
    // Generate a unique registration token
    const registrationToken = Buffer.from(`${email}:${Date.now()}`).toString('base64');
    const registrationLink = `${process.env.FRONTEND_URL}/register/carrier?token=${encodeURIComponent(registrationToken)}`;
    
    // Set expiration (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    // Create invitation record
    const invitation = await prisma.carrierInvitation.create({
      data: {
        email,
        token: registrationToken,
        expiresAt,
        createdBy: userId
      },
      include: {
        createdByUser: {
          select: { name: true, email: true }
        }
      }
    });
    
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
    
    return res.status(200).json({ 
      message: 'Invitation sent successfully',
      email,
      invitation: {
        id: invitation.id,
        sentAt: invitation.sentAt,
        expiresAt: invitation.expiresAt
      }
    });
  } catch (error) {
    console.error('Invite carrier error:', error);
    return res.status(500).json({ message: 'Failed to send invitation' });
  }
};

export const validateInvitation = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    
    if (!token) {
      return res.status(400).json({ message: 'Token is required' });
    }
    
    try {
      // Decode the token
      const decoded = Buffer.from(decodeURIComponent(token), 'base64').toString();
      const [email, timestampStr] = decoded.split(':');
      const timestamp = parseInt(timestampStr);
      
      if (!email || !timestamp) {
        return res.status(400).json({ message: 'Invalid token format' });
      }
      
      // Check if token is expired (7 days)
      const expirationTime = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
      if (Date.now() - timestamp > expirationTime) {
        return res.status(400).json({ message: 'Token has expired' });
      }
      
      // Check if carrier with this email already exists
      const existingCarrier = await prisma.carrier.findFirst({
        where: { email }
      });
      
      if (existingCarrier) {
        return res.status(400).json({ message: 'Carrier with this email already registered' });
      }
      
      return res.status(200).json({ 
        message: 'Token is valid',
        email 
      });
    } catch (decodeError) {
      return res.status(400).json({ message: 'Invalid token format' });
    }
  } catch (error) {
    console.error('Validate invitation error:', error);
    return res.status(500).json({ message: 'Failed to validate invitation' });
  }
};

export const registerCarrier = async (req: Request, res: Response) => {
  try {
    console.log('=== Carrier Registration Request ===');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file ? { filename: req.file.filename, originalname: req.file.originalname, size: req.file.size } : 'No file');
    console.log('======================================');
    
    const {
      token,
      name,
      contactPerson,
      phone,
      email,
      mcNumber,
      dotNumber,
      streetAddress1,
      streetAddress2,
      city,
      state,
      zipCode,
      safetyRating,
      taxId,
      ratePerMile,
      rating,
      remittanceContact,
      remittanceEmail,
      factoringCompany,
      insuranceExpiration
    } = req.body;
    
    const insuranceFile = req.file;
    
    // Validate token first
    if (!token) {
      console.log('❌ Registration failed: No token provided');
      return res.status(400).json({ message: 'Registration token is required' });
    }
    
    console.log('🔍 Token validation - received token:', token);
    
    try {
      // Decode the token
      const decoded = Buffer.from(decodeURIComponent(token), 'base64').toString();
      console.log('🔓 Decoded token:', decoded);
      
      const [tokenEmail, timestampStr] = decoded.split(':');
      const timestamp = parseInt(timestampStr);
      
      console.log('📧 Token email:', tokenEmail);
      console.log('⏰ Token timestamp:', timestamp);
      console.log('📧 Form email:', email);
      
      if (!tokenEmail || !timestamp) {
        console.log('❌ Registration failed: Invalid token format');
        return res.status(400).json({ message: 'Invalid registration token' });
      }
      
      // Check if token is expired (7 days)
      const expirationTime = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
      if (Date.now() - timestamp > expirationTime) {
        console.log('❌ Registration failed: Token expired');
        return res.status(400).json({ message: 'Registration token has expired' });
      }
      
      // Validate that the email matches the token (case insensitive)
      if (email.toLowerCase().trim() !== tokenEmail.toLowerCase().trim()) {
        console.log('❌ Registration failed: Email mismatch');
        console.log('Token email:', tokenEmail);
        console.log('Form email:', email);
        return res.status(400).json({ message: 'Email does not match invitation' });
      }
      
      console.log('✅ Token validation passed');
    } catch (decodeError) {
      console.log('❌ Registration failed: Token decode error:', decodeError);
      return res.status(400).json({ message: 'Invalid registration token' });
    }
    
    // Validate required fields
    const requiredFields = {
      name: 'Carrier name',
      contactPerson: 'Contact person',
      phone: 'Phone',
      email: 'Email',
      streetAddress1: 'Street address',
      city: 'City',
      state: 'State',
      zipCode: 'Zip code',
      mcNumber: 'MC Number',
      dotNumber: 'DOT Number'
    };
    
    const missingFields = [];
    for (const [field, label] of Object.entries(requiredFields)) {
      if (!req.body[field] || !req.body[field].trim()) {
        console.log(`Missing or empty field: ${field} (${label}) = "${req.body[field]}"`);
        missingFields.push(label);
      }
    }
    
    if (!insuranceFile) {
      console.log('Missing insurance file');
      missingFields.push('Insurance document');
    }
    
    if (missingFields.length > 0) {
      console.log('Registration failed - missing fields:', missingFields);
      return res.status(400).json({ 
        message: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }
    
    // Check for duplicate MC/DOT numbers
    if (mcNumber) {
      const existingMC = await prisma.carrier.findUnique({
        where: { mcNumber }
      });
      if (existingMC) {
        return res.status(409).json({ message: 'MC number already exists' });
      }
    }

    if (dotNumber) {
      const existingDOT = await prisma.carrier.findUnique({
        where: { dotNumber }
      });
      if (existingDOT) {
        return res.status(409).json({ message: 'DOT number already exists' });
      }
    }
    
    // Check if carrier with this email already exists (case insensitive)
    const existingCarrier = await prisma.carrier.findFirst({
      where: { 
        email: {
          equals: email.toLowerCase().trim(),
          mode: 'insensitive'
        }
      }
    });
    
    if (existingCarrier) {
      console.log('❌ Registration failed: Carrier with this email already exists');
      return res.status(409).json({ message: 'Carrier with this email already exists' });
    }
    
    // Create the carrier with status PENDING and onboardingComplete false
    const carrierData = {
      name: name.trim(),
      contactPerson: contactPerson.trim(),
      phone: phone.trim(),
      email: email.toLowerCase().trim(),
      mcNumber: mcNumber.trim(),
      dotNumber: dotNumber.trim(),
      streetAddress1: streetAddress1.trim(),
      streetAddress2: streetAddress2 ? streetAddress2.trim() : undefined,
      city: city.trim(),
      state: state.trim(),
      zipCode: zipCode.trim(),
      status: 'PENDING' as const,
      carrierType: undefined, // Will be set by admin during review
      safetyRating: safetyRating || undefined,
      taxId: taxId ? taxId.trim() : undefined,
      ratePerMile: ratePerMile ? parseFloat(ratePerMile) : undefined,
      rating: rating ? parseFloat(rating) : undefined,
      remittanceContact: remittanceContact ? remittanceContact.trim() : undefined,
      remittanceEmail: remittanceEmail ? remittanceEmail.trim() : undefined,
      factoringCompany: factoringCompany ? factoringCompany.trim() : undefined,
      onboardingComplete: false,
      insuranceExpiration: insuranceExpiration ? new Date(insuranceExpiration) : undefined
    };
    
    const carrier = await prisma.carrier.create({
      data: carrierData
    });
    
    // Save the insurance document
    if (insuranceFile) {
      await prisma.carrierDocument.create({
        data: {
          carrierId: carrier.id,
          documentType: 'INSURANCE',
          filename: insuranceFile.originalname,
          filePath: insuranceFile.path
        }
      });
    }
    
    // Send notification to admin about new registration
    const { sendEmail } = await import('../services/notification.service');
    
    const adminEmailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Carrier Registration</h2>
        
        <p>A new carrier has completed their registration and is awaiting review.</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #495057;">Carrier Details:</h3>
          <ul style="list-style: none; padding: 0;">
            <li><strong>Name:</strong> ${carrier.name}</li>
            <li><strong>Contact:</strong> ${carrier.contactPerson}</li>
            <li><strong>Email:</strong> ${carrier.email}</li>
            <li><strong>Phone:</strong> ${carrier.phone}</li>
            <li><strong>MC#:</strong> ${carrier.mcNumber}</li>
            <li><strong>DOT#:</strong> ${carrier.dotNumber}</li>
            <li><strong>Location:</strong> ${carrier.city}, ${carrier.state}</li>
          </ul>
        </div>
        
        <p>Please log in to the system to review and complete the onboarding process.</p>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/carriers" 
             style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
            Review Carrier
          </a>
        </div>
      </div>
    `;
    
    // Send to admin email (you may want to make this configurable)
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@ccfs.com';
    await sendEmail({
      to: adminEmail,
      subject: `New Carrier Registration - ${carrier.name}`,
      html: adminEmailContent
    });
    
    // Mark invitation as registered if it exists
    try {
      await prisma.carrierInvitation.updateMany({
        where: {
          email: carrier.email!,
          status: 'PENDING'
        },
        data: {
          status: 'REGISTERED',
          registeredAt: new Date()
        }
      });
    } catch (invitationUpdateError) {
      console.error('Failed to update invitation status:', invitationUpdateError);
      // Continue execution - don't fail registration due to this
    }
    
    return res.status(201).json({ 
      message: 'Registration submitted successfully',
      carrierId: carrier.id 
    });
  } catch (error) {
    console.error('Register carrier error:', error);
    
    // Clean up uploaded file if database operation fails
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (e) {
        console.error('Failed to delete uploaded file:', e);
      }
    }
    
    return res.status(500).json({ message: 'Failed to submit registration' });
  }
};

// Get carrier invitations
export const getCarrierInvitations = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    // First, clean up expired invitations automatically
    await cleanupExpiredInvitations();
    
    const where: any = {};
    if (status) {
      where.status = status as string;
    }
    
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    
    const [invitations, total] = await Promise.all([
      prisma.carrierInvitation.findMany({
        where,
        include: {
          createdByUser: {
            select: { name: true, email: true }
          }
        },
        orderBy: { sentAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum
      }),
      prisma.carrierInvitation.count({ where })
    ]);

    return res.json({
      invitations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Get carrier invitations error:', error);
    return res.status(500).json({ message: 'Failed to fetch invitations' });
  }
};

// Clean up expired invitations automatically
export const cleanupExpiredInvitations = async () => {
  try {
    const now = new Date();
    
    // Find all pending invitations that have expired
    const expiredInvitations = await prisma.carrierInvitation.findMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          lt: now
        }
      }
    });
    
    if (expiredInvitations.length > 0) {
      // Update expired invitations to EXPIRED status
      await prisma.carrierInvitation.updateMany({
        where: {
          status: 'PENDING',
          expiresAt: {
            lt: now
          }
        },
        data: {
          status: 'EXPIRED',
          updatedAt: now
        }
      });
      
      console.log(`✅ Cleaned up ${expiredInvitations.length} expired invitation(s)`);
    }
    
    return expiredInvitations.length;
  } catch (error) {
    console.error('Error cleaning up expired invitations:', error);
    return 0;
  }
};

// Cancel carrier invitation
export const cancelCarrierInvitation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const invitation = await prisma.carrierInvitation.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!invitation) {
      return res.status(404).json({ message: 'Invitation not found' });
    }
    
    if (invitation.status !== 'PENDING') {
      return res.status(400).json({ message: 'Only pending invitations can be cancelled' });
    }
    
    const updatedInvitation = await prisma.carrierInvitation.update({
      where: { id: parseInt(id) },
      data: {
        status: 'CANCELLED',
        updatedAt: new Date()
      }
    });
    
    return res.json({
      message: 'Invitation cancelled successfully',
      invitation: updatedInvitation
    });
  } catch (error) {
    console.error('Cancel carrier invitation error:', error);
    return res.status(500).json({ message: 'Failed to cancel invitation' });
  }
};

// Driver management functions
export const addCarrierDriver = async (req: Request, res: Response) => {
  try {
    const { carrierId } = req.params;
    const { name, phoneNumber, email, licenseNumber } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ message: 'Driver name is required' });
    }

    // Check if carrier exists
    const carrier = await prisma.carrier.findUnique({
      where: { id: parseInt(carrierId) }
    });

    if (!carrier) {
      return res.status(404).json({ message: 'Carrier not found' });
    }

    const driver = await prisma.carrierDriver.create({
      data: {
        carrierId: parseInt(carrierId),
        name,
        phoneNumber,
        email,
        licenseNumber
      }
    });

    return res.status(201).json(driver);
  } catch (error) {
    console.error('Add carrier driver error:', error);
    return res.status(500).json({ message: 'Failed to add driver' });
  }
};

export const updateCarrierDriver = async (req: Request, res: Response) => {
  try {
    const { carrierId, driverId } = req.params;
    const { name, phoneNumber, email, licenseNumber, active } = req.body;

    const driver = await prisma.carrierDriver.update({
      where: { 
        id: parseInt(driverId),
        carrierId: parseInt(carrierId)
      },
      data: {
        name,
        phoneNumber,
        email,
        licenseNumber,
        active
      }
    });

    return res.json(driver);
  } catch (error) {
    console.error('Update carrier driver error:', error);
    return res.status(500).json({ message: 'Failed to update driver' });
  }
};

export const deleteCarrierDriver = async (req: Request, res: Response) => {
  try {
    const { carrierId, driverId } = req.params;

    await prisma.carrierDriver.delete({
      where: { 
        id: parseInt(driverId),
        carrierId: parseInt(carrierId)
      }
    });

    return res.status(204).send();
  } catch (error) {
    console.error('Delete carrier driver error:', error);
    return res.status(500).json({ message: 'Failed to delete driver' });
  }
};

export const getCarrierDrivers = async (req: Request, res: Response) => {
  try {
    const { carrierId } = req.params;

    const drivers = await prisma.carrierDriver.findMany({
      where: { 
        carrierId: parseInt(carrierId),
        active: true
      },
      orderBy: { name: 'asc' }
    });

    return res.json(drivers);
  } catch (error) {
    console.error('Get carrier drivers error:', error);
    return res.status(500).json({ message: 'Failed to get drivers' });
  }
};