/**
 * MyCarrierPackets API Configuration
 */

export interface MCPConfig {
  apiKey: string;
  username: string;
  password: string;
  customerId: string;
  apiUrl: string;
  frontendUrl: string;
}

class MCPConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MCPConfigError';
  }
}

export const getMCPConfig = (): MCPConfig => {
  const config: MCPConfig = {
    apiKey: process.env.MYCARRIERPACKETS_API_KEY || '',
    username: process.env.MYCARRIERPACKETS_USERNAME || '',
    password: process.env.MYCARRIERPACKETS_PASSWORD || '',
    customerId: process.env.MYCARRIERPACKETS_CUSTOMER_ID || '',
    apiUrl: process.env.MYCARRIERPACKETS_API_URL || 'https://api.mycarrierpackets.com',
    frontendUrl: process.env.MYCARRIERPACKETS_FRONTEND_URL || 'https://mycarrierpackets.com'
  };

  // Validate required fields
  const requiredFields: (keyof MCPConfig)[] = ['apiKey', 'username', 'password'];
  const missingFields = requiredFields.filter(field => !config[field]);

  if (missingFields.length > 0) {
    throw new MCPConfigError(
      `Missing required MyCarrierPackets configuration: ${missingFields.join(', ')}. ` +
      `Please check your .env file and ensure all MCP variables are set.`
    );
  }

  return config;
};

// Check if MCP is configured (doesn't throw, just returns boolean)
export const isMCPConfigured = (): boolean => {
  try {
    getMCPConfig();
    return true;
  } catch (error) {
    return false;
  }
};

// Log configuration status (for debugging)
export const logMCPConfigStatus = (): void => {
  console.log('MyCarrierPackets Configuration Status:');
  console.log('- API URL:', process.env.MYCARRIERPACKETS_API_URL || 'Not set (using default)');
  console.log('- Customer ID:', process.env.MYCARRIERPACKETS_CUSTOMER_ID || 'Not set');
  console.log('- Username:', process.env.MYCARRIERPACKETS_USERNAME ? '✓ Set' : '✗ Not set');
  console.log('- Password:', process.env.MYCARRIERPACKETS_PASSWORD ? '✓ Set' : '✗ Not set');
  console.log('- API Key:', process.env.MYCARRIERPACKETS_API_KEY ? '✓ Set' : '✗ Not set');
  console.log('- Configuration valid:', isMCPConfigured() ? '✓ Yes' : '✗ No');
};