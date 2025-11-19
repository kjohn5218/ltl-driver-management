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
  async getCompletedPackets(fromDate: Date, toDate: Date): Promise<any[]> {
    const params = new URLSearchParams({
      fromDate: fromDate.toISOString(),
      toDate: toDate.toISOString()
    });

    return this.makeAuthenticatedRequest(
      'POST',
      `/api/v1/Carrier/completedpackets?${params}`,
      {}
    );
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

    const response = await this.apiClient.post(
      `/api/v1/Carrier/MonitoredCarrierData?${params}`,
      {},
      {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      }
    );

    return {
      carriers: response.data,
      pagination: response.data.pagination || { pageNumber, pageSize }
    };
  }

  /**
   * Get document (insurance, W9, etc.)
   */
  async getDocument(blobName: string): Promise<Buffer> {
    const response = await this.apiClient.post(
      `/api/v1/Carrier/GetDocument?name=${blobName}`,
      {},
      {
        headers: { Authorization: `Bearer ${this.accessToken}` },
        responseType: 'arraybuffer'
      }
    );

    return Buffer.from(response.data);
  }

  /**
   * Download and save carrier documents
   */
  async downloadCarrierDocuments(
    carrierId: number,
    mcpData: MCPCarrierData
  ): Promise<{ insurance?: string; w9?: string; agreement?: string }> {
    const uploadDir = path.join(process.cwd(), 'uploads', 'documents', 'mcp');
    await fs.mkdir(uploadDir, { recursive: true });

    const documents: { insurance?: string; w9?: string; agreement?: string } = {};

    // Download insurance certificate if available
    if (mcpData.Insurance?.BlobName) {
      try {
        const insuranceDoc = await this.getDocument(mcpData.Insurance.BlobName);
        const filename = `insurance_${carrierId}_${Date.now()}.pdf`;
        const filePath = path.join(uploadDir, filename);
        
        await fs.writeFile(filePath, insuranceDoc);
        documents.insurance = filePath;

        // Save to database
        await prisma.carrierDocument.create({
          data: {
            carrierId,
            documentType: 'MCP_INSURANCE',
            filename: 'Insurance_Certificate.pdf',
            filePath
          }
        });

        console.log(`Downloaded insurance certificate for carrier ${carrierId}`);
      } catch (error) {
        console.error('Failed to download insurance document:', error);
      }
    }

    // Add logic for W9 and agreement documents if available in MCP data
    // This would depend on the actual MCP API response structure

    return documents;
  }

  /**
   * Map MCP data to our carrier model
   */
  private mapCarrierData(mcpData: MCPCarrierData): MappedCarrierData {
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
      safetyRating: mcpData.AssureAdvantage?.[0]?.CarrierDetails?.Safety?.rating || '',
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