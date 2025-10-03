-- Create carrier_agreements table
CREATE TABLE IF NOT EXISTS carrier_agreements (
  id SERIAL PRIMARY KEY,
  carrier_id INTEGER NOT NULL,
  agreement_version VARCHAR(255) NOT NULL,
  agreement_title VARCHAR(255) NOT NULL,
  signed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  signed_by VARCHAR(255) NOT NULL,
  signed_by_title VARCHAR(255) NOT NULL,
  ip_address VARCHAR(255) NOT NULL,
  user_agent TEXT,
  geolocation TEXT,
  username VARCHAR(255) NOT NULL,
  affidavit_pdf_path TEXT,
  agreement_pdf_path TEXT,
  agreement_hash TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_carrier_agreements_carrier FOREIGN KEY (carrier_id) REFERENCES carriers(id) ON DELETE CASCADE
);

-- Create index on carrier_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_carrier_agreements_carrier_id ON carrier_agreements(carrier_id);

-- Add column to carriers table if it doesn't exist
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS contact_person_title VARCHAR(255);