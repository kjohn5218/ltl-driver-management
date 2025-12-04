-- Update existing carriers with mcpPacketStatus based on mcpPacketCompleted
UPDATE "Carrier"
SET "mcpPacketStatus" = CASE 
    WHEN "mcpPacketCompleted" = true THEN 'Completed'
    ELSE 'Not Completed'
END
WHERE "mcpPacketStatus" IS NULL;