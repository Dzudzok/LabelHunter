-- Allow LP imports alongside Nextis imports
-- Make nextis_id nullable (LP shipments don't have a nextis_id)
ALTER TABLE delivery_notes ALTER COLUMN nextis_id DROP NOT NULL;

-- Add LP-specific shipment ID for deduplication
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS lp_id INTEGER UNIQUE;

-- Add source column to distinguish import origin
ALTER TABLE delivery_notes ADD COLUMN IF NOT EXISTS source VARCHAR(10) DEFAULT 'nextis';

-- Index for LP lookups
CREATE INDEX IF NOT EXISTS idx_dn_lp_id ON delivery_notes(lp_id);
CREATE INDEX IF NOT EXISTS idx_dn_source ON delivery_notes(source);
