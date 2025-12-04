# MCP Sync Scripts

This directory contains scripts for syncing data with MyCarrierPackets (MCP) API.

## Available Scripts

### 1. sync-packet-status.js

Comprehensive script for syncing completed packet statuses from MCP. This is the main script you should use for packet status synchronization.

**Features:**
- Fetches completed packets from MCP for a specified date range
- Updates carrier records with accurate packet status
- Supports multiple sync modes (all, monitored, dot-only, specific)
- Includes dry-run mode for testing
- Provides detailed sync summary and statistics

**Usage:**
```bash
# Sync all carriers for the past year (default)
npm run sync:packets

# Or run directly
node scripts/sync-packet-status.js

# Sync only monitored carriers
node scripts/sync-packet-status.js --mode monitored

# Sync carriers with DOT numbers (not monitored)
node scripts/sync-packet-status.js --mode dot-only

# Sync a specific carrier
node scripts/sync-packet-status.js --mode specific --dot 1234567

# Check past 30 days only
node scripts/sync-packet-status.js --days 30

# Dry run to preview changes
node scripts/sync-packet-status.js --dry-run --verbose

# Show help
node scripts/sync-packet-status.js --help
```

### 2. sync-completed-packets.js

Simpler script focused on syncing completed packets for all carriers with DOT numbers or monitored status.

**Usage:**
```bash
node scripts/sync-completed-packets.js
```

### 3. check-packet-status.js

Utility script to check the current distribution of packet statuses in the database.

**Usage:**
```bash
node scripts/check-packet-status.js
```

### 4. update-packet-status.js

Legacy script that updates packet status based on the mcpPacketCompleted field.

**Usage:**
```bash
node scripts/update-packet-status.js
```

## Prerequisites

Before running these scripts:

1. Ensure the TypeScript code is compiled:
   ```bash
   npm run build
   ```

2. Set up environment variables:
   - `DATABASE_URL`: PostgreSQL connection string
   - `MCP_API_URL`: MyCarrierPackets API URL
   - `MCP_USERNAME`: MCP username
   - `MCP_PASSWORD`: MCP password
   - `MCP_CUSTOMER_ID`: Your MCP customer ID

## Scheduling

For production use, consider running the sync script regularly:

```bash
# Add to crontab for daily sync at 2 AM
0 2 * * * cd /path/to/project && node scripts/sync-packet-status.js >> logs/mcp-sync.log 2>&1

# Or use a task scheduler like node-cron in your application
```

## Logging

The scripts output detailed information to stdout. In production, redirect to log files:

```bash
node scripts/sync-packet-status.js >> logs/sync-$(date +\%Y-\%m-\%d).log 2>&1
```

## Error Handling

The scripts include comprehensive error handling:
- API authentication failures
- Network timeouts
- Invalid data handling
- Database connection issues

If errors occur, the scripts will:
1. Log detailed error information
2. Continue processing remaining carriers
3. Provide error summary at the end
4. Exit with appropriate status codes

## Performance Considerations

- The MCP API has rate limits. The scripts handle this gracefully.
- For large datasets, use `--mode` to process specific subsets
- The scripts process carriers sequentially to avoid overwhelming the API
- Database updates are performed individually for better error isolation

## Troubleshooting

1. **Authentication failures**: Check MCP credentials in environment variables
2. **No carriers found**: Verify carriers have DOT numbers or are marked as monitored
3. **Timeout errors**: The API timeout is set to 30 seconds. For slow connections, you may need to modify the timeout in the service
4. **Database errors**: Ensure DATABASE_URL is correct and database is accessible