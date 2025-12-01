/**
 * Mock MyCarrierPackets Service for Development/Testing
 * This simulates MCP API responses when real credentials aren't available
 */

import { MappedCarrierData } from './mycarrierpackets.service';

// Mock carrier data for testing
const MOCK_CARRIERS = [
  {
    DOTNumber: 1234567,
    MCNumber: 'MC123456',
    LegalName: 'ABC Trucking Company',
    DBAName: 'ABC Express',
    Address1: '123 Main Street',
    Address2: 'Suite 100',
    City: 'Dallas',
    State: 'TX',
    Zipcode: '75201',
    Phone: '214-555-0100',
    Email: 'dispatch@abctrucking.com',
    SCAC: 'ABCT',
    AuthorityStatus: 'ACTIVE',
    Insurance: {
      ExpirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days from now
      BlobName: 'mock-insurance-doc-1234567'
    },
    CarrierOperationalDetail: {
      FleetSize: 25,
      TotalPowerUnits: 20
    },
    AssureAdvantage: [{
      RiskScore: 85,
      CarrierDetails: {
        Safety: {
          rating: 'SATISFACTORY'
        }
      }
    }],
    PacketComplete: true,
    PacketCompleteDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ago
  },
  {
    DOTNumber: 7654321,
    MCNumber: 'MC654321',
    LegalName: 'XYZ Transport LLC',
    DBAName: null,
    Address1: '456 Oak Avenue',
    City: 'Houston',
    State: 'TX',
    Zipcode: '77001',
    Phone: '713-555-0200',
    Email: 'info@xyztransport.com',
    SCAC: 'XYZT',
    AuthorityStatus: 'ACTIVE',
    Insurance: {
      ExpirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      BlobName: 'mock-insurance-doc-7654321'
    },
    CarrierOperationalDetail: {
      FleetSize: 10,
      TotalPowerUnits: 8
    },
    AssureAdvantage: [{
      RiskScore: 92,
      CarrierDetails: {
        Safety: {
          rating: 'SATISFACTORY'
        }
      }
    }],
    PacketComplete: false,
    PacketCompleteDate: null
  }
];

export class MockMyCarrierPacketsService {
  private mockDelay = () => new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

  async authenticate(): Promise<void> {
    await this.mockDelay();
    console.log('[MOCK] MCP authentication successful');
  }

  async previewCarrier(dotNumber: string, docketNumber?: string): Promise<any> {
    await this.mockDelay();
    console.log(`[MOCK] Previewing carrier DOT: ${dotNumber}, MC: ${docketNumber}`);
    
    const mockCarrier = MOCK_CARRIERS.find(c => c.DOTNumber.toString() === dotNumber) || {
      ...MOCK_CARRIERS[0],
      DOTNumber: parseInt(dotNumber),
      MCNumber: docketNumber || `MC${dotNumber}`,
      LegalName: `Mock Carrier ${dotNumber}`,
      Email: `carrier${dotNumber}@example.com`
    };

    return mockCarrier;
  }

  async sendInvitation(dotNumber: string, email: string, docketNumber?: string, _username?: string): Promise<any> {
    await this.mockDelay();
    console.log(`[MOCK] Sending invitation to ${email} for DOT: ${dotNumber}`);
    
    return {
      success: true,
      message: 'Mock invitation sent',
      invitationId: `mock-invite-${Date.now()}`,
      email,
      dotNumber,
      mcNumber: docketNumber
    };
  }

  async getCarrierData(dotNumber: string, docketNumber?: string): Promise<MappedCarrierData> {
    await this.mockDelay();
    const mcpData = await this.previewCarrier(dotNumber, docketNumber);
    return this.mapCarrierData(mcpData);
  }

  async getCompletedPackets(fromDate: Date, toDate: Date): Promise<any[]> {
    await this.mockDelay();
    console.log(`[MOCK] Getting completed packets from ${fromDate} to ${toDate}`);
    
    // Return some mock completed packets
    return [
      {
        DOTNumber: 1234567,
        MCNumber: 'MC123456',
        CompletedDate: new Date().toISOString(),
        CarrierName: 'ABC Trucking Company'
      }
    ];
  }

  async requestMonitoring(dotNumber: string, docketNumber?: string): Promise<any> {
    await this.mockDelay();
    console.log(`[MOCK] Requesting monitoring for DOT: ${dotNumber}`);
    
    return {
      success: true,
      message: 'Mock monitoring enabled',
      dotNumber,
      mcNumber: docketNumber
    };
  }

  async cancelMonitoring(dotNumber: string, docketNumber?: string): Promise<any> {
    await this.mockDelay();
    console.log(`[MOCK] Canceling monitoring for DOT: ${dotNumber}`);
    
    return {
      success: true,
      message: 'Mock monitoring disabled',
      dotNumber,
      mcNumber: docketNumber
    };
  }

  async getDocument(blobName: string): Promise<Buffer> {
    await this.mockDelay();
    console.log(`[MOCK] Getting document: ${blobName}`);
    
    // Return a mock PDF buffer
    const mockPdfContent = `%PDF-1.4
Mock Insurance Certificate
This is a mock document for testing purposes.
DOT: ${blobName}
%%EOF`;
    
    return Buffer.from(mockPdfContent);
  }

  async downloadCarrierDocuments(carrierId: number, _mcpData: any): Promise<any> {
    console.log(`[MOCK] Downloading documents for carrier ${carrierId}`);
    return {
      insurance: '/mock/path/to/insurance.pdf'
    };
  }

  generateIntelliviteUrl(dotNumber?: string, docketNumber?: string, username?: string): string {
    let url = 'https://mock.mycarrierpackets.com/mock-customer-id/Carrier/Intellivite';
    if (username) url += `/${username}`;
    if (dotNumber) {
      url += `/${dotNumber}`;
      if (docketNumber) url += `/${docketNumber}`;
    }
    return url;
  }

  generateCarrierViewUrl(dotNumber: string, docketNumber?: string, requestInsurance = false): string {
    let url = `https://mock.mycarrierpackets.com/CarrierInformation/DOTNumber/${dotNumber}`;
    if (docketNumber) url += `/DocketNumber/${docketNumber}`;
    if (requestInsurance) url += '?requestInsurance=true';
    return url;
  }

  private mapCarrierData(mcpData: any): MappedCarrierData {
    return {
      name: mcpData.LegalName || mcpData.DBAName || '',
      dbaName: mcpData.DBAName || '',
      dotNumber: mcpData.DOTNumber?.toString() || '',
      mcNumber: mcpData.MCNumber || '',
      scacCode: mcpData.SCAC || '',
      streetAddress1: mcpData.Address1 || '',
      streetAddress2: mcpData.Address2 || '',
      city: mcpData.City || '',
      state: mcpData.State || '',
      zipCode: mcpData.Zipcode || '',
      phone: mcpData.Phone || '',
      email: mcpData.Email || '',
      emergencyPhone: mcpData.EmergencyPhone || '',
      fleetSize: mcpData.CarrierOperationalDetail?.FleetSize || 0,
      totalPowerUnits: mcpData.CarrierOperationalDetail?.TotalPowerUnits || 0,
      safetyRating: mcpData.AssureAdvantage?.[0]?.CarrierDetails?.Safety?.rating || '',
      mcpAuthorityStatus: mcpData.AuthorityStatus || '',
      mcpRiskScore: mcpData.AssureAdvantage?.[0]?.RiskScore || null,
      mcpInsuranceExpiration: mcpData.Insurance?.ExpirationDate 
        ? new Date(mcpData.Insurance.ExpirationDate) 
        : null,
      mcpPacketCompleted: mcpData.PacketComplete === true,
      mcpPacketCompletedAt: mcpData.PacketCompleteDate 
        ? new Date(mcpData.PacketCompleteDate) 
        : null,
      _rawMcpData: mcpData
    };
  }

  async getMonitoredCarriers(
    pageNumber = 1,
    pageSize = 2500
  ): Promise<{ carriers: any[]; pagination: any }> {
    console.log(`Mock: Getting monitored carriers page ${pageNumber}`);
    
    // Return a mock list of monitored carriers
    const mockCarriers = [
      {
        DotNumber: '1234567',
        CompanyName: 'ABC Transport LLC',
        Status: 'ACTIVE',
        MonitoringStartDate: '2024-01-15',
        LastCheckedDate: new Date().toISOString(),
        HasChanges: false
      },
      {
        DotNumber: '2345678',
        CompanyName: 'XYZ Logistics Inc',
        Status: 'ACTIVE',
        MonitoringStartDate: '2024-02-20',
        LastCheckedDate: new Date().toISOString(),
        HasChanges: true,
        Changes: ['Insurance Updated', 'Authority Status Changed']
      }
    ];
    
    return {
      carriers: mockCarriers,
      pagination: {
        pageNumber,
        pageSize,
        totalPages: 1,
        totalCount: mockCarriers.length
      }
    };
  }
}

export const mockMcpService = new MockMyCarrierPacketsService();