-- Add MCP carrier type fields
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS is_common_carrier BOOLEAN DEFAULT FALSE;
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS is_contract_carrier BOOLEAN DEFAULT FALSE;
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS is_broker BOOLEAN DEFAULT FALSE;

-- Add equipment counts
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS truck_count INT DEFAULT 0;
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS trailer_count INT DEFAULT 0;
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS driver_count INT DEFAULT 0;

-- Add MCP assessment fields
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS mcp_authority_status VARCHAR(50);
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS mcp_insurance_status VARCHAR(50);
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS mcp_operations_status VARCHAR(50);
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS mcp_safety_status VARCHAR(50);
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS mcp_packet_status VARCHAR(50);
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS mcp_total_points INT DEFAULT 0;

-- Add insurance details
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS general_liability_expiration DATE;
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS general_liability_coverage DECIMAL(12,2);
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS cargo_liability_expiration DATE;
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS cargo_liability_coverage DECIMAL(12,2);
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS auto_liability_expiration DATE;
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS auto_liability_coverage DECIMAL(12,2);