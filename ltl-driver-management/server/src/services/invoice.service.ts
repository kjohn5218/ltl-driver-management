import { PrismaClient, InvoiceStatus, BookingStatus } from '@prisma/client';
import { format } from 'date-fns';

const prisma = new PrismaClient();

export class InvoiceService {
  // Generate invoice number in format: INV-YYYYMM-XXXX
  async generateInvoiceNumber(): Promise<string> {
    const now = new Date();
    const yearMonth = format(now, 'yyyyMM');
    
    // Get the last invoice number for this month
    const lastInvoice = await prisma.invoice.findFirst({
      where: {
        invoiceNumber: {
          startsWith: `INV-${yearMonth}-`
        }
      },
      orderBy: {
        invoiceNumber: 'desc'
      }
    });
    
    let sequence = 1;
    if (lastInvoice) {
      const lastSequence = parseInt(lastInvoice.invoiceNumber.split('-').pop() || '0');
      sequence = lastSequence + 1;
    }
    
    return `INV-${yearMonth}-${sequence.toString().padStart(4, '0')}`;
  }

  // Create invoice from completed booking
  async createInvoice(bookingId: number) {
    // Check if invoice already exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { bookingId }
    });
    
    if (existingInvoice) {
      throw new Error('Invoice already exists for this booking');
    }
    
    // Get booking details with line items and documents
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        carrier: true,
        route: true,
        lineItems: true,
        documents: true,
        childBookings: {
          include: {
            lineItems: true,
            documents: true
          }
        }
      }
    });
    
    if (!booking) {
      throw new Error('Booking not found');
    }
    
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new Error('Invoice can only be generated for completed bookings');
    }
    
    // Calculate total amounts
    const baseAmount = Number(booking.rate) || 0;
    
    // Calculate line items total (including child bookings)
    let lineItemsAmount = 0;
    const allLineItems = [...booking.lineItems];
    
    // Add line items from child bookings
    if (booking.childBookings && booking.childBookings.length > 0) {
      booking.childBookings.forEach(childBooking => {
        allLineItems.push(...childBooking.lineItems);
      });
    }
    
    lineItemsAmount = allLineItems.reduce((sum, item) => sum + Number(item.amount), 0);
    
    const totalAmount = baseAmount + lineItemsAmount;
    
    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber();
    
    // Create invoice with carrier address information
    const invoice = await prisma.invoice.create({
      data: {
        bookingId,
        invoiceNumber,
        amount: totalAmount,
        baseAmount,
        lineItemsAmount,
        status: InvoiceStatus.PENDING,
        // Capture carrier address information at time of invoice creation
        carrierName: booking.carrier?.name || null,
        carrierContactPerson: booking.carrier?.contactPerson || null,
        carrierPhone: booking.carrier?.phone || null,
        carrierEmail: booking.carrier?.email || null,
        carrierStreetAddress1: booking.carrier?.streetAddress1 || null,
        carrierStreetAddress2: booking.carrier?.streetAddress2 || null,
        carrierCity: booking.carrier?.city || null,
        carrierState: booking.carrier?.state || null,
        carrierZipCode: booking.carrier?.zipCode || null
      },
      include: {
        booking: {
          include: {
            carrier: true,
            route: true
          }
        }
      }
    });
    
    return invoice;
  }

  // Get invoice with full details
  async getInvoice(id: number) {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        booking: {
          include: {
            carrier: true,
            route: true,
            lineItems: {
              include: {
                creator: true
              }
            },
            documents: true,
            childBookings: {
              include: {
                lineItems: {
                  include: {
                    creator: true
                  }
                },
                documents: true
              }
            }
          }
        },
        attachments: true
      }
    });
    
    return invoice;
  }

  // List invoices with filters
  async listInvoices(filters: {
    status?: InvoiceStatus;
    fromDate?: Date;
    toDate?: Date;
    carrierId?: number;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    
    if (filters.status) {
      where.status = filters.status;
    }
    
    if (filters.fromDate || filters.toDate) {
      where.createdAt = {};
      if (filters.fromDate) {
        where.createdAt.gte = filters.fromDate;
      }
      if (filters.toDate) {
        where.createdAt.lte = filters.toDate;
      }
    }
    
    if (filters.carrierId) {
      where.booking = {
        carrierId: filters.carrierId
      };
    }
    
    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          booking: {
            include: {
              carrier: true,
              route: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: filters.offset || 0,
        take: filters.limit || 100
      }),
      prisma.invoice.count({ where })
    ]);
    
    return { invoices, total };
  }

  // Update invoice status
  async updateInvoiceStatus(id: number, status: InvoiceStatus, userId?: string) {
    const updateData: any = { status };
    
    if (status === InvoiceStatus.SENT_TO_AP) {
      updateData.sentToAPAt = new Date();
      updateData.sentToAPBy = userId || 'System';
    }
    
    if (status === InvoiceStatus.PAID) {
      updateData.paidAt = new Date();
    }
    
    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData
    });
    
    return invoice;
  }

  // Update multiple invoices status
  async updateInvoicesStatus(ids: number[], status: InvoiceStatus, userId?: string) {
    const updateData: any = { status };
    
    if (status === InvoiceStatus.SENT_TO_AP) {
      updateData.sentToAPAt = new Date();
      updateData.sentToAPBy = userId || 'System';
    }
    
    if (status === InvoiceStatus.PAID) {
      updateData.paidAt = new Date();
    }
    
    await prisma.invoice.updateMany({
      where: {
        id: {
          in: ids
        }
      },
      data: updateData
    });
  }

  // Add attachment to invoice
  async addAttachment(invoiceId: number, attachment: {
    documentType: string;
    documentId?: number;
    filename: string;
    filePath: string;
    fileSize?: number;
    mimeType?: string;
  }) {
    const invoiceAttachment = await prisma.invoiceAttachment.create({
      data: {
        invoiceId,
        ...attachment
      }
    });
    
    return invoiceAttachment;
  }

  // Copy booking documents to invoice attachments
  async copyBookingDocuments(invoiceId: number) {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        booking: {
          include: {
            documents: true,
            lineItems: true,
            childBookings: {
              include: {
                documents: true
              }
            }
          }
        }
      }
    });
    
    if (!invoice) {
      throw new Error('Invoice not found');
    }
    
    const attachments = [];
    
    // Add rate confirmation PDF if exists
    if (invoice.booking.signedPdfPath) {
      attachments.push({
        invoiceId,
        documentType: 'rate_confirmation',
        filename: `rate-confirmation-${invoice.booking.id}.pdf`,
        filePath: invoice.booking.signedPdfPath
      });
    }
    
    // Add all booking documents
    const allDocuments = [...invoice.booking.documents];
    
    // Add documents from child bookings
    if (invoice.booking.childBookings) {
      invoice.booking.childBookings.forEach(child => {
        allDocuments.push(...child.documents);
      });
    }
    
    for (const doc of allDocuments) {
      attachments.push({
        invoiceId,
        documentType: doc.documentType,
        documentId: doc.id,
        filename: doc.filename,
        filePath: doc.filePath
      });
    }
    
    // Add line item receipts
    const lineItemsWithReceipts = invoice.booking.lineItems.filter(item => item.receiptPath);
    for (const item of lineItemsWithReceipts) {
      attachments.push({
        invoiceId,
        documentType: 'receipt',
        filename: `receipt-${item.id}.pdf`,
        filePath: item.receiptPath!
      });
    }
    
    // Create all attachments
    if (attachments.length > 0) {
      await prisma.invoiceAttachment.createMany({
        data: attachments
      });
    }
    
    return attachments.length;
  }

  // Delete invoice
  async deleteInvoice(id: number) {
    // Delete attachments will cascade
    await prisma.invoice.delete({
      where: { id }
    });
  }
}

export default new InvoiceService();