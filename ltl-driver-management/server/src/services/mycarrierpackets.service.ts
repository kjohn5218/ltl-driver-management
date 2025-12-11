import axios, { AxiosInstance, AxiosError } from 'axios';
import { getMCPConfig, MCPConfig } from '../config/mcp.config';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs/promises';

// Create a separate Prisma instance to avoid circular dependencies
const prisma = new PrismaClient();

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface MCPCarrierData {
  DOTNumber?: number;
  MCNumber?: string;
  LegalName?: string;
  DBAName?: string;
  Address1?: string;
  Address2?: string;
  City?: string;
  State?: string;
  Zipcode?: string;
  Country?: string;
  Phone?: string;
  CellPhone?: string;
  Fax?: string;
  Email?: string;
  Website?: string;
  EmergencyPhone?: string;
  SCAC?: string;
  AuthorityStatus?: string;
  Insurance?: {
    ExpirationDate?: string;
    BlobName?: string;
  };
  W9?: {
    BlobName?: string;
    UploadedDate?: string;
  };
  OperatingAgreement?: {
    BlobName?: string;
    SignedDate?: string;
  };
  Documents?: Array<{
    DocumentType?: string;
    BlobName?: string;
    FileName?: string;
    UploadedDate?: string;
  }>;
  CarrierOperationalDetail?: {
    FleetSize?: number;
    TotalPowerUnits?: number;
  };
  AssureAdvantage?: Array<{
    RiskScore?: number;
    CarrierDetails?: {
      Safety?: {
        rating?: string;
      };
      RiskAssessment?: {
        Overall?: string;
      };
    };
  }>;
  PacketComplete?: boolean;
  PacketCompleteDate?: string;
  MailingAddress1?: string;
  MailingAddress2?: string;
  MailingCity?: string;
  MailingState?: string;
  MailingZipcode?: string;
  MailingCountry?: string;
}

export interface MappedCarrierData {
  name: string;
  dbaName: string;
  dotNumber: string;
  mcNumber: string;
  scacCode: string;
  streetAddress1: string;
  streetAddress2: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  email: string;
  emergencyPhone: string;
  fleetSize: number;
  totalPowerUnits: number;
  safetyRating: string;
  mcpAuthorityStatus: string;
  mcpRiskScore: number | null;
  mcpInsuranceExpiration: Date | null;
  mcpPacketCompleted: boolean;
  mcpPacketCompletedAt: Date | null;
  mcpPacketStatus?: string;
  _rawMcpData?: MCPCarrierData;
}

class MCPError extends Error {
  constructor(public statusCode: number, message: string, public details?: any) {
    super(message);
    this.name = 'MCPError';
  }
}

export class MyCarrierPacketsService {
  private apiClient: AxiosInstance;
  private config: MCPConfig;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    this.config = getMCPConfig();
    this.apiClient = axios.create({
      baseURL: this.config.apiUrl,
      timeout: 30000, // 30 second timeout
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    // Add response interceptor for error handling
    this.apiClient.interceptors.response.use(
      response => response,
      this.handleAxiosError.bind(this)
    );
  }

  private async handleAxiosError(error: AxiosError) {
    if (error.response) {
      const { status, data } = error.response;
      let message = 'MCP API request failed';
      
      if (data && typeof data === 'object' && 'message' in data) {
        message = data.message as string;
      } else if (data && typeof data === 'string') {
        message = data;
      }

      throw new MCPError(status, message, data);
    } else if (error.request) {
      throw new MCPError(0, 'No response from MCP API', error.request);
    } else {
      throw new MCPError(0, error.message);
    }
  }

  /**
   * Authenticate with MCP API and get access token
   */
  async authenticate(): Promise<void> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return;
    }

    console.log('Authenticating with MyCarrierPackets API...');

    try {
      const response = await this.apiClient.post<TokenResponse>(
        '/token',
        new URLSearchParams({
          grant_type: 'password',
          username: this.config.username,
          password: this.config.password
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.accessToken = response.data.access_token;
      // Set token expiry (expires_in is in seconds, subtract 5 minutes for safety)
      const expiryMs = (response.data.expires_in - 300) * 1000;
      this.tokenExpiry = new Date(Date.now() + expiryMs);
      
      console.log('MCP authentication successful');
    } catch (error) {
      console.error('MCP authentication failed:', error);
      throw error;
    }
  }

  /**
   * Make authenticated API request
   */
  private async makeAuthenticatedRequest<T>(
    method: 'GET' | 'POST',
    url: string,
    data?: any,
    config?: any
  ): Promise<T> {
    await this.authenticate();

    const requestConfig = {
      ...config,
      headers: {
        ...config?.headers,
        Authorization: `Bearer ${this.accessToken}`
      }
    };

    const response = method === 'GET'
      ? await this.apiClient.get<T>(url, requestConfig)
      : await this.apiClient.post<T>(url, data, requestConfig);

    return response.data;
  }

  /**
   * Preview carrier data before invitation
   */
  async previewCarrier(dotNumber: string, docketNumber?: string): Promise<MCPCarrierData> {
    const params = new URLSearchParams({ DOTNumber: dotNumber });
    if (docketNumber) params.append('docketNumber', docketNumber);

    return this.makeAuthenticatedRequest<MCPCarrierData>(
      'POST',
      `/api/v1/Carrier/PreviewCarrier?${params}`,
      {}
    );
  }

  /**
   * Send intellivite invitation
   */
  async sendInvitation(
    dotNumber: string,
    email: string,
    docketNumber?: string,
    username?: string
  ): Promise<any> {
    const params = new URLSearchParams({
      dotNumber,
      carrierEmail: email,
      username: username || this.config.username
    });
    if (docketNumber) params.append('docketNumber', docketNumber);

    return this.makeAuthenticatedRequest(
      'POST',
      `/api/v1/Carrier/EmailPacketInvitation?${params}`,
      {}
    );
  }

  /**
   * Get carrier data
   */
  async getCarrierData(dotNumber: string, docketNumber?: string): Promise<MappedCarrierData> {
    const params = new URLSearchParams({ DOTNumber: dotNumber });
    if (docketNumber) params.append('Docket', docketNumber);

    const mcpData = await this.makeAuthenticatedRequest<MCPCarrierData>(
      'POST',
      `/api/v1/Carrier/GetCarrierData?${params}`,
      {}
    );

    return this.mapCarrierData(mcpData);
  }

  /**
   * Check for completed packets
   */
  async getCompletedPackets(fromDate: Date, toDate: Date): Promise<{
    packets: Array<{
      dotNumber: string;
      mcNumber?: string;
      carrierName: string;
      completedAt: Date;
      packetData: any;
    }>;
    totalCount: number;
  }> {
    const params = new URLSearchParams({
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString()
    });

    const response = await this.makeAuthenticatedRequest<any[]>(
      'POST',
      `/api/v1/Carrier/completedpackets?${params}`,
      {}
    );

    // Map the response to a more structured format
    const packets = response.map((packet: any) => ({
      dotNumber: packet.DOTNumber?.toString() || '',
      mcNumber: packet.MCNumber || undefined,
      carrierName: packet.LegalName || packet.DBAName || 'Unknown',
      completedAt: new Date(packet.PacketCompleteDate || packet.CompletedDate || new Date()),
      packetData: packet
    }));

    return {
      packets,
      totalCount: packets.length
    };
  }

  /**
   * Check and sync completed packets
   * This method checks for recently completed packets and updates local carrier records
   */
  async checkAndSyncCompletedPackets(
    fromDate?: Date,
    toDate?: Date
  ): Promise<{
    checked: number;
    synced: number;
    newPackets: number;
    errors: number;
    details: Array<{
      dotNumber: string;
      carrierName: string;
      status: 'synced' | 'new' | 'error';
      message?: string;
    }>;
  }> {
    // Default to last 7 days if no date range provided
    const endDate = toDate || new Date();
    const startDate = fromDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    console.log(`Checking completed packets from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    const results = {
      checked: 0,
      synced: 0,
      newPackets: 0,
      errors: 0,
      details: [] as Array<{
        dotNumber: string;
        carrierName: string;
        status: 'synced' | 'new' | 'error';
        message?: string;
      }>
    };

    try {
      const { packets } = await this.getCompletedPackets(startDate, endDate);
      results.checked = packets.length;

      for (const packet of packets) {
        try {
          const dotNumber = packet.dotNumber;
          
          if (!dotNumber) {
            results.errors++;
            results.details.push({
              dotNumber: 'unknown',
              carrierName: packet.carrierName,
              status: 'error',
              message: 'Missing DOT number'
            });
            continue;
          }

          // Check if carrier exists in our database
          const existingCarrier = await prisma.carrier.findFirst({
            where: { dotNumber }
          });

          if (existingCarrier) {
            // Update existing carrier with packet completion
            const mappedData = this.mapCarrierData(packet.packetData);
            
            await prisma.carrier.update({
              where: { id: existingCarrier.id },
              data: {
                mcpPacketCompleted: true,
                mcpPacketCompletedAt: packet.completedAt,
                mcpLastSync: new Date(),
                // Update other fields from packet data
                name: mappedData.name || existingCarrier.name,
                dbaName: mappedData.dbaName || existingCarrier.dbaName,
                mcpInsuranceExpiration: mappedData.mcpInsuranceExpiration,
                mcpAuthorityStatus: mappedData.mcpAuthorityStatus,
                mcpRiskScore: mappedData.mcpRiskScore,
                mcpSafetyRating: mappedData.safetyRating,
                mcpPacketStatus: 'Completed', // Set to completed since this is from completed packets endpoint
                // Update insurance coverage details
                autoLiabilityExpiration: (mappedData as any).autoLiabilityExpiration || existingCarrier.autoLiabilityExpiration,
                autoLiabilityCoverage: (mappedData as any).autoLiabilityCoverage || existingCarrier.autoLiabilityCoverage,
                generalLiabilityExpiration: (mappedData as any).generalLiabilityExpiration || existingCarrier.generalLiabilityExpiration,
                generalLiabilityCoverage: (mappedData as any).generalLiabilityCoverage || existingCarrier.generalLiabilityCoverage,
                cargoLiabilityExpiration: (mappedData as any).cargoLiabilityExpiration || existingCarrier.cargoLiabilityExpiration,
                cargoLiabilityCoverage: (mappedData as any).cargoLiabilityCoverage || existingCarrier.cargoLiabilityCoverage
              }
            });

            // Try to download documents if available
            if (packet.packetData) {
              try {
                await this.downloadCarrierDocuments(existingCarrier.id, packet.packetData);
              } catch (docError) {
                console.error(`Failed to download documents for carrier ${existingCarrier.id}:`, docError);
              }
            }

            results.synced++;
            results.details.push({
              dotNumber,
              carrierName: packet.carrierName,
              status: 'synced',
              message: `Packet completed on ${packet.completedAt.toLocaleDateString()}`
            });
          } else {
            // New carrier packet - log for manual review
            results.newPackets++;
            results.details.push({
              dotNumber,
              carrierName: packet.carrierName,
              status: 'new',
              message: 'Carrier not found in database - manual review needed'
            });
          }
        } catch (error) {
          results.errors++;
          results.details.push({
            dotNumber: packet.dotNumber,
            carrierName: packet.carrierName,
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      console.log(`Completed packets check finished. Checked: ${results.checked}, Synced: ${results.synced}, New: ${results.newPackets}, Errors: ${results.errors}`);
      return results;
    } catch (error) {
      console.error('Failed to check completed packets:', error);
      throw error;
    }
  }

  /**
   * Add carrier to monitoring
   */
  async requestMonitoring(dotNumber: string, docketNumber?: string): Promise<any> {
    const body = {
      DOTNumber: dotNumber,
      DocketNumber: docketNumber
    };

    return this.makeAuthenticatedRequest(
      'POST',
      '/api/v1/Carrier/RequestMonitoring',
      body
    );
  }

  /**
   * Remove carrier from monitoring
   */
  async cancelMonitoring(dotNumber: string, docketNumber?: string): Promise<any> {
    const body = {
      DOTNumber: dotNumber,
      DocketNumber: docketNumber
    };

    return this.makeAuthenticatedRequest(
      'POST',
      '/api/v1/Carrier/CancelMonitoring',
      body
    );
  }

  /**
   * Get monitored carriers list
   */
  async getMonitoredCarriers(
    pageNumber = 1,
    pageSize = 2500
  ): Promise<{ carriers: any[]; pagination: any }> {
    await this.authenticate(); // Ensure we have a valid token
    
    const params = new URLSearchParams({
      pageNumber: pageNumber.toString(),
      pageSize: pageSize.toString()
    });

    const response = await this.apiClient.post(
      `/api/v1/Carrier/MonitoredCarriers?${params}`,
      {},
      {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      }
    );

    return {
      carriers: response.data,
      pagination: response.headers['x-pagination'] 
        ? JSON.parse(response.headers['x-pagination'])
        : { pageNumber, pageSize, totalPages: 1, totalCount: response.data.length }
    };
  }

  /**
   * Get carrier changes (for batch updates)
   */
  async getCarrierChanges(
    fromDate: Date,
    toDate: Date,
    pageNumber = 1,
    pageSize = 250
  ): Promise<{ carriers: any[]; pagination: any }> {
    const params = new URLSearchParams({
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString(),
      pageNumber: pageNumber.toString(),
      pageSize: pageSize.toString()
    });

    const response = await this.apiClient.post(
      `/api/v1/Carrier/CarriersChanges?${params}`,
      {},
      {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      }
    );

    return {
      carriers: response.data,
      pagination: response.headers['x-pagination']
        ? JSON.parse(response.headers['x-pagination'])
        : { pageNumber, pageSize, totalPages: 1, totalCount: response.data.length }
    };
  }

  /**
   * Get monitored carrier data (batch)
   */
  async getMonitoredCarrierData(
    pageNumber = 1,
    pageSize = 250
  ): Promise<{ carriers: any[]; pagination: any }> {
    const params = new URLSearchParams({
      pageNumber: pageNumber.toString(),
      pageSize: pageSize.toString()
    });

    const response = await this.makeAuthenticatedRequest<any>(
      'POST',
      `/api/v1/Carrier/MonitoredCarrierData?${params}`,
      {}
    );

    // The API returns a paginated response with data in the 'data' field
    return {
      carriers: response.data || [],
      pagination: {
        pageNumber: response.pageNumber,
        pageSize: response.pageSize,
        totalPages: response.totalPages,
        totalCount: response.totalCount,
        hasMore: response.pageNumber < response.totalPages
      }
    };
  }

  /**
   * Get document (insurance, W9, etc.)
   */
  async getDocument(blobName: string): Promise<{
    buffer: Buffer;
    contentType: string;
    fileName: string;
  }> {
    try {
      await this.authenticate();
      
      const response = await this.apiClient.post(
        `/api/v1/Carrier/GetDocument?name=${encodeURIComponent(blobName)}`,
        {},
        {
          headers: { Authorization: `Bearer ${this.accessToken}` },
          responseType: 'arraybuffer'
        }
      );

      // Extract content type from headers
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      
      // Try to determine file extension from content type or blob name
      let fileName = blobName;
      if (blobName.indexOf('.') === -1) {
        // No extension in blob name, try to determine from content type
        const extension = this.getFileExtensionFromContentType(contentType);
        fileName = `${blobName}${extension}`;
      }

      return {
        buffer: Buffer.from(response.data),
        contentType,
        fileName
      };
    } catch (error) {
      console.error(`Failed to download document ${blobName}:`, error);
      throw new MCPError(
        error instanceof MCPError ? error.statusCode : 500,
        `Failed to download document: ${blobName}`,
        error
      );
    }
  }

  /**
   * Helper to determine file extension from content type
   */
  private getFileExtensionFromContentType(contentType: string): string {
    const mimeToExt: { [key: string]: string } = {
      'application/pdf': '.pdf',
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'text/plain': '.txt',
      'application/octet-stream': ''
    };
    
    return mimeToExt[contentType.toLowerCase()] || '';
  }

  /**
   * Download and save carrier documents
   */
  async downloadCarrierDocuments(
    carrierId: number,
    mcpData: MCPCarrierData
  ): Promise<{
    downloaded: number;
    failed: number;
    documents: Array<{
      type: string;
      fileName: string;
      status: 'success' | 'failed';
      error?: string;
    }>;
  }> {
    const uploadDir = path.join(process.cwd(), 'uploads', 'documents', 'mcp', carrierId.toString());
    await fs.mkdir(uploadDir, { recursive: true });

    const results = {
      downloaded: 0,
      failed: 0,
      documents: [] as Array<{
        type: string;
        fileName: string;
        status: 'success' | 'failed';
        error?: string;
      }>
    };

    // Helper function to download and save a document
    const downloadAndSaveDocument = async (
      blobName: string,
      documentType: string,
      displayName: string
    ) => {
      try {
        const { buffer, fileName } = await this.getDocument(blobName);
        const timestamp = Date.now();
        const safeFileName = fileName.replace(/[^a-z0-9.-]/gi, '_');
        const localFileName = `${documentType.toLowerCase()}_${timestamp}_${safeFileName}`;
        const filePath = path.join(uploadDir, localFileName);
        
        await fs.writeFile(filePath, buffer);

        // Check if document already exists in database
        const existingDoc = await prisma.carrierDocument.findFirst({
          where: {
            carrierId,
            documentType,
            filename: displayName
          }
        });

        if (!existingDoc) {
          // Save to database
          await prisma.carrierDocument.create({
            data: {
              carrierId,
              documentType,
              filename: displayName,
              filePath
            }
          });
        } else {
          // Update existing document
          await prisma.carrierDocument.update({
            where: { id: existingDoc.id },
            data: {
              filePath,
              uploadedAt: new Date()
            }
          });
        }

        results.downloaded++;
        results.documents.push({
          type: documentType,
          fileName: displayName,
          status: 'success'
        });

        console.log(`Downloaded ${documentType} for carrier ${carrierId}: ${fileName}`);
      } catch (error) {
        results.failed++;
        results.documents.push({
          type: documentType,
          fileName: displayName,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        console.error(`Failed to download ${documentType} for carrier ${carrierId}:`, error);
      }
    };

    // Download insurance certificate
    if (mcpData.Insurance?.BlobName) {
      await downloadAndSaveDocument(
        mcpData.Insurance.BlobName,
        'MCP_INSURANCE',
        'Insurance Certificate'
      );
    }

    // Download W9
    if (mcpData.W9?.BlobName) {
      await downloadAndSaveDocument(
        mcpData.W9.BlobName,
        'MCP_W9',
        'W9 Tax Form'
      );
    }

    // Download Operating Agreement
    if (mcpData.OperatingAgreement?.BlobName) {
      await downloadAndSaveDocument(
        mcpData.OperatingAgreement.BlobName,
        'MCP_OPERATING_AGREEMENT',
        'Operating Agreement'
      );
    }

    // Download other documents
    if (mcpData.Documents && Array.isArray(mcpData.Documents)) {
      for (const doc of mcpData.Documents) {
        if (doc.BlobName) {
          const docType = doc.DocumentType || 'OTHER';
          const fileName = doc.FileName || doc.BlobName;
          await downloadAndSaveDocument(
            doc.BlobName,
            `MCP_${docType.toUpperCase().replace(/\s+/g, '_')}`,
            fileName
          );
        }
      }
    }

    console.log(`Document download summary for carrier ${carrierId}: Downloaded ${results.downloaded}, Failed ${results.failed}`);
    return results;
  }

  /**
   * Sync all documents for a specific carrier
   */
  async syncCarrierDocuments(carrierId: number, dotNumber: string, mcNumber?: string): Promise<{
    success: boolean;
    downloaded: number;
    failed: number;
    documents: Array<{
      type: string;
      fileName: string;
      status: 'success' | 'failed';
      error?: string;
    }>;
  }> {
    try {
      console.log(`Syncing documents for carrier ${carrierId} (DOT: ${dotNumber})`);
      
      // Get carrier data from MCP
      const mcpData = await this.getCarrierData(dotNumber, mcNumber);
      
      // Download all available documents
      const results = await this.downloadCarrierDocuments(carrierId, mcpData._rawMcpData || {});
      
      return {
        success: true,
        ...results
      };
    } catch (error) {
      console.error(`Failed to sync documents for carrier ${carrierId}:`, error);
      return {
        success: false,
        downloaded: 0,
        failed: 0,
        documents: [{
          type: 'ERROR',
          fileName: 'N/A',
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        }]
      };
    }
  }

  /**
   * Map monitored carrier data to our carrier model
   */
  private mapMonitoredCarrierData(mcpData: any): MappedCarrierData & {
    autoLiabilityExpiration?: Date | null;
    autoLiabilityCoverage?: number | null;
    generalLiabilityExpiration?: Date | null;
    generalLiabilityCoverage?: number | null;
    cargoLiabilityExpiration?: Date | null;
    cargoLiabilityCoverage?: number | null;
    mcpPacketStatus?: string;
  } {
    // Extract insurance coverage details from CertData
    let insuranceExpiration: Date | null = null;
    let autoLiabilityExpiration: Date | null = null;
    let autoLiabilityCoverage: number | null = null;
    let generalLiabilityExpiration: Date | null = null;
    let generalLiabilityCoverage: number | null = null;
    let cargoLiabilityExpiration: Date | null = null;
    let cargoLiabilityCoverage: number | null = null;
    
    if (mcpData.CertData?.Certificate?.[0]?.Coverage) {
      const coverages = mcpData.CertData.Certificate[0].Coverage;
      
      // Auto Liability
      const autoInsurance = coverages.find((c: any) => c.type === 'Auto' || c.type === 'Auto Liability');
      if (autoInsurance) {
        if (autoInsurance.expirationDate) {
          autoLiabilityExpiration = new Date(autoInsurance.expirationDate);
          insuranceExpiration = autoLiabilityExpiration; // Keep backward compatibility
        }
        if (autoInsurance.limit) {
          autoLiabilityCoverage = parseFloat(autoInsurance.limit) || null;
        }
      }
      
      // General Liability
      const generalInsurance = coverages.find((c: any) => c.type === 'General' || c.type === 'General Liability');
      if (generalInsurance) {
        if (generalInsurance.expirationDate) {
          generalLiabilityExpiration = new Date(generalInsurance.expirationDate);
        }
        if (generalInsurance.limit) {
          generalLiabilityCoverage = parseFloat(generalInsurance.limit) || null;
        }
      }
      
      // Cargo Liability
      const cargoInsurance = coverages.find((c: any) => 
        c.type === 'Cargo' || 
        c.type === 'Cargo Liability' || 
        c.type?.toLowerCase().includes('cargo')
      );
      if (cargoInsurance) {
        if (cargoInsurance.expirationDate) {
          cargoLiabilityExpiration = new Date(cargoInsurance.expirationDate);
        }
        if (cargoInsurance.limit) {
          cargoLiabilityCoverage = parseFloat(cargoInsurance.limit) || null;
        }
      }
    }

    return {
      // Basic info from Identity
      name: mcpData.Identity?.legalName || mcpData.Identity?.dbaName || '',
      dbaName: mcpData.Identity?.dbaName || '',
      dotNumber: mcpData.dotNumber?.Value?.toString() || '',
      mcNumber: mcpData.docketNumber || '',
      scacCode: '', // Not in monitored data
      
      // Address from Identity
      streetAddress1: mcpData.Identity?.businessStreet || '',
      streetAddress2: '',
      city: mcpData.Identity?.businessCity || '',
      state: mcpData.Identity?.businessState || '',
      zipCode: mcpData.Identity?.businessZipCode || '',
      
      // Contact from Identity
      phone: mcpData.Identity?.businessPhone || mcpData.Identity?.cellPhone || '',
      email: mcpData.Identity?.emailAddress || '',
      emergencyPhone: '', // Not in monitored data
      
      // Equipment details
      fleetSize: parseInt(mcpData.Equipment?.trucksTotal || '0') || 0,
      totalPowerUnits: parseInt(mcpData.Equipment?.totalPower || '0') || 0,
      
      // Safety and authority
      safetyRating: mcpData.Safety?.rating || '',
      mcpAuthorityStatus: mcpData.Authority?.commonAuthority || mcpData.Authority?.contractAuthority || '',
      
      // Risk assessment
      mcpRiskScore: mcpData.RiskAssessmentDetails?.TotalPoints || null,
      
      // Insurance
      mcpInsuranceExpiration: insuranceExpiration,
      
      // Packet status
      mcpPacketCompleted: false, // This would need to be determined separately
      mcpPacketCompletedAt: null,
      mcpPacketStatus: undefined, // Don't set a default - preserve existing value
      
      // Insurance coverage details
      autoLiabilityExpiration,
      autoLiabilityCoverage,
      generalLiabilityExpiration,
      generalLiabilityCoverage,
      cargoLiabilityExpiration,
      cargoLiabilityCoverage,
      
      _rawMcpData: mcpData
    };
  }

  /**
   * Map MCP data to our carrier model
   */
  private mapCarrierData(mcpData: MCPCarrierData): MappedCarrierData & {
    autoLiabilityExpiration?: Date | null;
    autoLiabilityCoverage?: number | null;
    generalLiabilityExpiration?: Date | null;
    generalLiabilityCoverage?: number | null;
    cargoLiabilityExpiration?: Date | null;
    cargoLiabilityCoverage?: number | null;
    mcpPacketStatus?: string;
  } {
    // Extract insurance details if available
    let autoLiabilityExpiration: Date | null = null;
    let autoLiabilityCoverage: number | null = null;
    let generalLiabilityExpiration: Date | null = null;
    let generalLiabilityCoverage: number | null = null;
    let cargoLiabilityExpiration: Date | null = null;
    let cargoLiabilityCoverage: number | null = null;
    
    // For now, we'll use the general insurance expiration for all types
    // MCP may provide more detailed data in the future
    const insuranceExpiration = mcpData.Insurance?.ExpirationDate 
      ? new Date(mcpData.Insurance.ExpirationDate) 
      : null;
    
    // Set all insurance expirations to the same date for now
    if (insuranceExpiration) {
      autoLiabilityExpiration = insuranceExpiration;
      generalLiabilityExpiration = insuranceExpiration;
      cargoLiabilityExpiration = insuranceExpiration;
    }
    
    return {
      // Basic info
      name: mcpData.LegalName || mcpData.DBAName || '',
      dbaName: mcpData.DBAName || '',
      dotNumber: mcpData.DOTNumber?.toString() || '',
      mcNumber: mcpData.MCNumber || '',
      scacCode: mcpData.SCAC || '',
      
      // Address
      streetAddress1: mcpData.Address1 || '',
      streetAddress2: mcpData.Address2 || '',
      city: mcpData.City || '',
      state: mcpData.State || '',
      zipCode: mcpData.Zipcode || '',
      
      // Contact
      phone: mcpData.Phone || mcpData.CellPhone || '',
      email: mcpData.Email || '',
      emergencyPhone: mcpData.EmergencyPhone || '',
      
      // Equipment
      fleetSize: mcpData.CarrierOperationalDetail?.FleetSize || 0,
      totalPowerUnits: mcpData.CarrierOperationalDetail?.TotalPowerUnits || 0,
      
      // Safety & compliance
      // Use Risk Assessment Overall rating if Safety rating is "Not Rated" or empty
      safetyRating: (() => {
        const safetyRating = mcpData.AssureAdvantage?.[0]?.CarrierDetails?.Safety?.rating;
        const riskAssessmentOverall = mcpData.AssureAdvantage?.[0]?.CarrierDetails?.RiskAssessment?.Overall;
        
        // Log the values for debugging
        const companyName = mcpData.LegalName || mcpData.DBAName || '';
        if (companyName && companyName.includes('OLR')) {
          console.log(`MCP Safety Rating for ${companyName}: Safety="${safetyRating}", RiskAssessment="${riskAssessmentOverall}"`);
        }
        
        // Check if safety rating is missing, empty, or "Not Rated" (case-insensitive)
        if (!safetyRating || safetyRating.trim() === '' || safetyRating.toUpperCase() === 'NOT RATED') {
          // Fall back to Risk Assessment Overall if available
          return riskAssessmentOverall || '';
        }
        
        return safetyRating;
      })(),
      mcpAuthorityStatus: mcpData.AuthorityStatus || '',
      mcpRiskScore: mcpData.AssureAdvantage?.[0]?.RiskScore || null,
      
      // Insurance
      mcpInsuranceExpiration: mcpData.Insurance?.ExpirationDate 
        ? new Date(mcpData.Insurance.ExpirationDate) 
        : null,
      
      // Packet status
      mcpPacketCompleted: mcpData.PacketComplete === true,
      mcpPacketCompletedAt: mcpData.PacketCompleteDate 
        ? new Date(mcpData.PacketCompleteDate) 
        : null,
      mcpPacketStatus: mcpData.PacketComplete === true ? 'Completed' : 'Not Completed',
      
      // Insurance coverage details
      autoLiabilityExpiration,
      autoLiabilityCoverage,
      generalLiabilityExpiration,
      generalLiabilityCoverage,
      cargoLiabilityExpiration,
      cargoLiabilityCoverage,
        
      // Raw data for reference
      _rawMcpData: mcpData
    };
  }

  /**
   * Generate intellivite URL
   */
  generateIntelliviteUrl(dotNumber?: string, docketNumber?: string, username?: string): string {
    let url = `${this.config.frontendUrl}/${this.config.customerId}/Carrier/Intellivite`;
    
    if (username) {
      url += `/${username}`;
    }
    
    if (dotNumber) {
      url += `/${dotNumber}`;
      if (docketNumber) {
        url += `/${docketNumber}`;
      }
    }
    
    return url;
  }

  /**
   * Generate carrier view URL
   */
  generateCarrierViewUrl(dotNumber: string, docketNumber?: string, requestInsurance = false): string {
    let url = `${this.config.frontendUrl}/CarrierInformation/DOTNumber/${dotNumber}`;
    
    if (docketNumber) {
      url += `/DocketNumber/${docketNumber}`;
    }
    
    if (requestInsurance) {
      url += '?requestInsurance=true';
    }
    
    return url;
  }

  /**
   * Request insurance certificate from carrier
   * This sends a request to the carrier to upload their insurance certificate
   */
  async requestInsuranceCertificate(
    dotNumber: string, 
    docketNumber?: string,
    recipientEmail?: string,
    notes?: string
  ): Promise<{
    success: boolean;
    message: string;
    requestUrl: string;
    requestId?: string;
  }> {
    try {
      console.log(`Requesting insurance certificate for DOT: ${dotNumber}`);
      
      // Generate the request URL
      const requestUrl = this.generateCarrierViewUrl(dotNumber, docketNumber, true);
      
      // Log the insurance request in our database
      const carrier = await prisma.carrier.findFirst({
        where: { dotNumber }
      });
      
      if (carrier) {
        // Log the request (you can add a table for this later if needed)
        console.log(`Insurance request logged for carrier ${carrier.id} (${carrier.name})`);
        
        // Update carrier record to track last sync
        await prisma.carrier.update({
          where: { id: carrier.id },
          data: {
            mcpLastSync: new Date()
          }
        });
      }
      
      // If email is provided, we could send a notification
      if (recipientEmail && carrier?.email) {
        try {
          const { sendEmail } = await import('../services/notification.service');
          const emailContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Insurance Certificate Request</h2>
              
              <p>Dear ${carrier.contactPerson || carrier.name},</p>
              
              <p>We are requesting an updated certificate of insurance for your records with CrossCountry Freight Solutions.</p>
              
              <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Please click the link below to upload your current insurance certificate:</strong></p>
                <div style="margin: 20px 0; text-align: center;">
                  <a href="${requestUrl}" 
                     style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    Upload Insurance Certificate
                  </a>
                </div>
              </div>
              
              ${notes ? `<p><strong>Additional Notes:</strong> ${notes}</p>` : ''}
              
              <p>Please ensure your insurance certificate includes:</p>
              <ul>
                <li>Current effective dates</li>
                <li>Liability coverage limits</li>
                <li>Cargo coverage limits</li>
                <li>CrossCountry Freight Solutions listed as certificate holder</li>
              </ul>
              
              <p>If you have any questions, please contact us at (800) 521-0287.</p>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
              
              <p style="color: #999; font-size: 12px;">
                This is an automated request from CrossCountry Freight Solutions.
              </p>
            </div>
          `;
          
          await sendEmail({
            to: carrier.email,
            subject: 'Insurance Certificate Request - CrossCountry Freight Solutions',
            html: emailContent
          });
          
          console.log(`Insurance request email sent to ${carrier.email}`);
        } catch (emailError) {
          console.error('Failed to send insurance request email:', emailError);
          // Continue - email failure shouldn't stop the request
        }
      }
      
      return {
        success: true,
        message: 'Insurance certificate request generated successfully',
        requestUrl,
        requestId: carrier?.id?.toString()
      };
    } catch (error) {
      console.error('Failed to request insurance certificate:', error);
      throw new MCPError(
        500, 
        'Failed to request insurance certificate',
        error
      );
    }
  }

  /**
   * Sync packet status for a specific carrier
   * Fetches the actual carrier data to get accurate packet status
   */
  async syncCarrierPacketStatus(carrierId: number, dotNumber: string, mcNumber?: string): Promise<{
    success: boolean;
    packetStatus: string | null;
    packetCompleted: boolean;
    packetCompletedAt: Date | null;
    error?: string;
  }> {
    try {
      console.log(`Syncing packet status for carrier ${carrierId} (DOT: ${dotNumber})`);
      
      // Get fresh carrier data from MCP
      const carrierData = await this.getCarrierData(dotNumber, mcNumber);
      
      // First check if this carrier appears in completed packets
      let finalPacketStatus = {
        completed: carrierData.mcpPacketCompleted,
        completedAt: carrierData.mcpPacketCompletedAt,
        status: carrierData.mcpPacketStatus || (carrierData.mcpPacketCompleted ? 'Completed' : 'Not Completed')
      };

      // Check completed packets endpoint for more accurate data
      try {
        const endDate = new Date();
        const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // Check last year
        const { packets } = await this.getCompletedPackets(startDate, endDate);
        
        const completedPacket = packets.find(p => p.dotNumber === dotNumber);
        if (completedPacket) {
          console.log(`Found carrier ${dotNumber} in completed packets - overriding packet status`);
          finalPacketStatus = {
            completed: true,
            completedAt: completedPacket.completedAt,
            status: 'Completed'
          };
        }
      } catch (error) {
        console.warn('Failed to check completed packets endpoint:', error);
      }

      // Update carrier with accurate packet status
      await prisma.carrier.update({
        where: { id: carrierId },
        data: {
          mcpPacketCompleted: finalPacketStatus.completed,
          mcpPacketCompletedAt: finalPacketStatus.completedAt,
          mcpPacketStatus: finalPacketStatus.status,
          mcpLastSync: new Date()
        }
      });
      
      return {
        success: true,
        packetStatus: finalPacketStatus.status,
        packetCompleted: finalPacketStatus.completed,
        packetCompletedAt: finalPacketStatus.completedAt
      };
    } catch (error) {
      console.error(`Failed to sync packet status for carrier ${carrierId}:`, error);
      return {
        success: false,
        packetStatus: null,
        packetCompleted: false,
        packetCompletedAt: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Batch update carriers from MCP MonitoredCarrierData endpoint
   * This method fetches all monitored carriers and updates local database
   */
  async batchUpdateCarriers(): Promise<{
    processed: number;
    updated: number;
    errors: number;
    details: Array<{dotNumber: string; status: 'updated' | 'error'; message?: string}>
  }> {
    console.log('Starting batch carrier update from MCP...');
    
    const results = {
      processed: 0,
      updated: 0,
      errors: 0,
      details: [] as Array<{dotNumber: string; status: 'updated' | 'error'; message?: string}>
    };

    try {
      let pageNumber = 1;
      let hasMorePages = true;
      const pageSize = 500; // Max allowed by API

      while (hasMorePages) {
        console.log(`Fetching page ${pageNumber} of carriers...`);
        
        let carriers: any[] = [];
        let pagination: any = {};
        
        try {
          const result = await this.getMonitoredCarrierData(pageNumber, pageSize);
          carriers = result.carriers;
          pagination = result.pagination;
        } catch (error: any) {
          console.error('Error fetching monitored carrier data:', error);
          console.error('Error details:', {
            message: error.message,
            statusCode: error.statusCode,
            details: error.details,
            stack: error.stack
          });
          throw error;
        }
        
        // Process each carrier
        for (const mcpCarrier of carriers) {
          results.processed++;
          
          try {
            // MonitoredCarrierData has a different structure
            const dotNumber = mcpCarrier.dotNumber?.Value?.toString() || mcpCarrier.dotNumber?.toString() || '';
            
            if (!dotNumber) {
              results.errors++;
              results.details.push({
                dotNumber: 'unknown',
                status: 'error',
                message: 'Missing DOT number'
              });
              continue;
            }

            // Map the carrier data using the monitored data format
            const mappedData = this.mapMonitoredCarrierData(mcpCarrier);

            // Update carrier in database
            const existingCarrier = await prisma.carrier.findFirst({
              where: { dotNumber }
            });

            if (existingCarrier) {
              // Update existing carrier
              await prisma.carrier.update({
                where: { id: existingCarrier.id },
                data: {
                  name: mappedData.name,
                  dbaName: mappedData.dbaName,
                  mcNumber: mappedData.mcNumber,
                  scacCode: mappedData.scacCode,
                  streetAddress1: mappedData.streetAddress1,
                  streetAddress2: mappedData.streetAddress2,
                  city: mappedData.city,
                  state: mappedData.state,
                  zipCode: mappedData.zipCode,
                  phone: mappedData.phone,
                  email: mappedData.email,
                  emergencyPhone: mappedData.emergencyPhone,
                  fleetSize: mappedData.fleetSize,
                  totalPowerUnits: mappedData.totalPowerUnits,
                  safetyRating: mappedData.safetyRating,
                  mcpSafetyRating: mappedData.safetyRating,
                  mcpAuthorityStatus: mappedData.mcpAuthorityStatus,
                  mcpRiskScore: mappedData.mcpRiskScore,
                  mcpInsuranceExpiration: mappedData.mcpInsuranceExpiration,
                  mcpPacketCompleted: mappedData.mcpPacketCompleted,
                  mcpPacketCompletedAt: mappedData.mcpPacketCompletedAt,
                  ...(mappedData.mcpPacketStatus !== undefined && { mcpPacketStatus: mappedData.mcpPacketStatus }),
                  mcpLastSync: new Date(),
                  // Update insurance coverage details
                  autoLiabilityExpiration: (mappedData as any).autoLiabilityExpiration || existingCarrier.autoLiabilityExpiration,
                  autoLiabilityCoverage: (mappedData as any).autoLiabilityCoverage || existingCarrier.autoLiabilityCoverage,
                  generalLiabilityExpiration: (mappedData as any).generalLiabilityExpiration || existingCarrier.generalLiabilityExpiration,
                  generalLiabilityCoverage: (mappedData as any).generalLiabilityCoverage || existingCarrier.generalLiabilityCoverage,
                  cargoLiabilityExpiration: (mappedData as any).cargoLiabilityExpiration || existingCarrier.cargoLiabilityExpiration,
                  cargoLiabilityCoverage: (mappedData as any).cargoLiabilityCoverage || existingCarrier.cargoLiabilityCoverage
                }
              });

              // Download updated documents if insurance certificate is available
              if (mcpCarrier.CertData?.Certificate?.[0]?.BlobName && 
                  (!existingCarrier.mcpInsuranceExpiration || 
                   existingCarrier.mcpInsuranceExpiration.getTime() !== mappedData.mcpInsuranceExpiration?.getTime())) {
                // TODO: Implement document download for monitored data format
                console.log(`Insurance certificate available for carrier ${existingCarrier.id}, download needed`);
              }

              results.updated++;
              results.details.push({
                dotNumber,
                status: 'updated'
              });
            } else {
              // Skip carriers not in our system
              console.log(`Carrier ${dotNumber} not found in local database, skipping...`);
            }
          } catch (error) {
            results.errors++;
            results.details.push({
              dotNumber: mcpCarrier.DOTNumber?.toString() || 'unknown',
              status: 'error',
              message: error instanceof Error ? error.message : 'Unknown error'
            });
            console.error(`Error processing carrier ${mcpCarrier.DOTNumber}:`, error);
          }
        }

        // Check if there are more pages
        if (pagination && pagination.hasMore) {
          pageNumber++;
        } else {
          hasMorePages = false;
        }
      }

      console.log(`Batch update completed. Processed: ${results.processed}, Updated: ${results.updated}, Errors: ${results.errors}`);
      return results;
    } catch (error) {
      console.error('Batch update failed:', error);
      throw error;
    }
  }
}

// Import mock service
import { mockMcpService } from './mycarrierpackets.mock.service';
import { isMCPConfigured } from '../config/mcp.config';

// Export singleton instance - use mock if not configured
export const mcpService = isMCPConfigured() 
  ? new MyCarrierPacketsService()
  : mockMcpService as any;

// Log which service is being used
if (!isMCPConfigured()) {
  console.log('⚠️  MCP not configured - using mock service for development');
}