const { PrismaClient } = require('@prisma/client');
const { mcpService } = require('../dist/services/mycarrierpackets.service');

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  mode: 'all', // all, monitored, dot-only, specific
  dotNumber: null,
  days: 365,
  dryRun: false,
  verbose: false
};

// Process arguments
for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--mode':
      options.mode = args[++i];
      break;
    case '--dot':
      options.dotNumber = args[++i];
      break;
    case '--days':
      options.days = parseInt(args[++i]);
      break;
    case '--dry-run':
      options.dryRun = true;
      break;
    case '--verbose':
      options.verbose = true;
      break;
    case '--help':
      showHelp();
      process.exit(0);
  }
}

function showHelp() {
  console.log(`
Sync Packet Status Script

This script syncs completed packet status from MyCarrierPackets for carriers.

Usage:
  node sync-packet-status.js [options]

Options:
  --mode <mode>     Sync mode: all, monitored, dot-only, specific (default: all)
                    - all: All carriers with DOT numbers or monitored status
                    - monitored: Only carriers marked as monitored
                    - dot-only: Only carriers with DOT numbers (not necessarily monitored)
                    - specific: Sync a specific carrier (requires --dot)
  
  --dot <number>    DOT number for specific carrier sync (required for mode=specific)
  
  --days <number>   Number of days to look back for completed packets (default: 365)
  
  --dry-run         Show what would be updated without making changes
  
  --verbose         Show detailed information for each carrier
  
  --help            Show this help message

Examples:
  # Sync all carriers for the past year
  node sync-packet-status.js

  # Sync only monitored carriers for the past 30 days
  node sync-packet-status.js --mode monitored --days 30

  # Sync a specific carrier
  node sync-packet-status.js --mode specific --dot 1234567

  # Dry run to see what would be updated
  node sync-packet-status.js --dry-run --verbose
  `);
}

async function syncPacketStatus() {
  console.log('=== MCP Packet Status Sync ===');
  console.log(`Mode: ${options.mode}`);
  console.log(`Days to check: ${options.days}`);
  console.log(`Dry run: ${options.dryRun}`);
  console.log(`Started at: ${new Date().toISOString()}\n`);

  try {
    // Build query based on mode
    let whereClause = {};
    switch (options.mode) {
      case 'monitored':
        whereClause = { mcpMonitored: true };
        break;
      case 'dot-only':
        whereClause = { 
          dotNumber: { not: null },
          mcpMonitored: false 
        };
        break;
      case 'specific':
        if (!options.dotNumber) {
          console.error('Error: --dot is required when using --mode specific');
          process.exit(1);
        }
        whereClause = { dotNumber: options.dotNumber };
        break;
      case 'all':
      default:
        whereClause = {
          OR: [
            { mcpMonitored: true },
            { dotNumber: { not: null } }
          ]
        };
    }

    // Get carriers to check
    const carriers = await prisma.carrier.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        dotNumber: true,
        mcNumber: true,
        mcpMonitored: true,
        mcpPacketCompleted: true,
        mcpPacketCompletedAt: true,
        mcpPacketStatus: true,
        mcpLastSync: true
      },
      orderBy: { name: 'asc' }
    });

    if (carriers.length === 0) {
      console.log('No carriers found matching the criteria.');
      return;
    }

    console.log(`Found ${carriers.length} carrier(s) to check\n`);

    // Set date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - options.days);

    console.log(`Fetching completed packets from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}...`);

    // Get completed packets from MCP
    let completedPackets;
    try {
      const result = await mcpService.getCompletedPackets(startDate, endDate);
      completedPackets = result.packets;
      console.log(`Found ${completedPackets.length} completed packets in MCP\n`);
    } catch (error) {
      console.error('Failed to fetch completed packets from MCP:', error.message);
      if (error.statusCode) {
        console.error(`API Status Code: ${error.statusCode}`);
      }
      process.exit(1);
    }

    // Create a map for faster lookup
    const completedPacketsMap = new Map();
    completedPackets.forEach(packet => {
      if (packet.dotNumber) {
        completedPacketsMap.set(packet.dotNumber, packet);
      }
    });

    // Track results
    const results = {
      totalCarriers: carriers.length,
      alreadyCompleted: 0,
      newlyCompleted: 0,
      statusUpdated: 0,
      notInMCP: 0,
      noChanges: 0,
      errors: 0,
      updatedCarriers: [],
      errorDetails: []
    };

    // Process each carrier
    console.log('Processing carriers...\n');
    
    for (const carrier of carriers) {
      try {
        if (!carrier.dotNumber) {
          if (options.verbose) {
            console.log(`⚠️  Skipping ${carrier.name} - No DOT number`);
          }
          results.noChanges++;
          continue;
        }

        const completedPacket = completedPacketsMap.get(carrier.dotNumber);
        const currentStatus = {
          completed: carrier.mcpPacketCompleted,
          completedAt: carrier.mcpPacketCompletedAt,
          status: carrier.mcpPacketStatus
        };

        if (completedPacket) {
          // Found in completed packets
          const needsUpdate = !carrier.mcpPacketCompleted || 
                            carrier.mcpPacketStatus !== 'Completed' ||
                            !carrier.mcpPacketCompletedAt;

          if (needsUpdate) {
            if (options.dryRun) {
              console.log(`[DRY RUN] Would update: ${carrier.name} (DOT: ${carrier.dotNumber})`);
              console.log(`  Current: Completed=${currentStatus.completed}, Status="${currentStatus.status}"`);
              console.log(`  New: Completed=true, Status="Completed", CompletedAt=${completedPacket.completedAt.toLocaleDateString()}`);
            } else {
              await prisma.carrier.update({
                where: { id: carrier.id },
                data: {
                  mcpPacketCompleted: true,
                  mcpPacketCompletedAt: completedPacket.completedAt,
                  mcpPacketStatus: 'Completed',
                  mcpLastSync: new Date()
                }
              });

              console.log(`✓ Updated: ${carrier.name} (DOT: ${carrier.dotNumber})`);
              if (options.verbose) {
                console.log(`  Packet completed on: ${completedPacket.completedAt.toLocaleDateString()}`);
                console.log(`  Previous status: ${currentStatus.status || 'Not Set'}`);
              }
            }

            if (!carrier.mcpPacketCompleted) {
              results.newlyCompleted++;
            } else {
              results.statusUpdated++;
            }

            results.updatedCarriers.push({
              id: carrier.id,
              name: carrier.name,
              dotNumber: carrier.dotNumber,
              previousStatus: currentStatus.status || 'Not Set',
              previousCompleted: currentStatus.completed,
              completedAt: completedPacket.completedAt,
              action: carrier.mcpPacketCompleted ? 'Status Updated' : 'Newly Completed'
            });
          } else {
            results.alreadyCompleted++;
            if (options.verbose) {
              console.log(`✓ Already completed: ${carrier.name} (DOT: ${carrier.dotNumber})`);
            }
          }
        } else {
          // Not found in completed packets
          results.notInMCP++;
          
          if (options.verbose) {
            if (carrier.mcpPacketCompleted) {
              console.log(`⚠️  ${carrier.name} (DOT: ${carrier.dotNumber}) - Marked as completed locally but not found in MCP`);
            } else {
              console.log(`○ ${carrier.name} (DOT: ${carrier.dotNumber}) - Not completed`);
            }
          }

          // Optionally update status to "Not Completed" if it's currently "Completed" but not in MCP
          if (carrier.mcpPacketStatus === 'Completed' && !completedPacketsMap.has(carrier.dotNumber)) {
            if (options.verbose) {
              console.log(`  Note: Carrier marked as completed but not in MCP completed list`);
            }
          }
        }
      } catch (error) {
        console.error(`✗ Error processing ${carrier.name} (ID: ${carrier.id}):`, error.message);
        results.errors++;
        results.errorDetails.push({
          carrierId: carrier.id,
          carrierName: carrier.name,
          error: error.message
        });
      }
    }

    // Print detailed results
    console.log('\n=== Sync Summary ===');
    console.log(`Total carriers checked: ${results.totalCarriers}`);
    console.log(`Already completed (no changes): ${results.alreadyCompleted}`);
    console.log(`Newly marked as completed: ${results.newlyCompleted}`);
    console.log(`Status corrected: ${results.statusUpdated}`);
    console.log(`Not in MCP completed list: ${results.notInMCP}`);
    console.log(`Errors: ${results.errors}`);

    if (options.dryRun) {
      console.log('\n⚠️  DRY RUN - No changes were made to the database');
    }

    // Show updated carriers
    if (results.updatedCarriers.length > 0 && !options.dryRun) {
      console.log('\n=== Updated Carriers ===');
      console.table(results.updatedCarriers.map(c => ({
        ID: c.id,
        Name: c.name.substring(0, 30) + (c.name.length > 30 ? '...' : ''),
        'DOT Number': c.dotNumber,
        'Previous Status': c.previousStatus,
        'Action': c.action,
        'Completed Date': c.completedAt.toLocaleDateString()
      })));
    }

    // Show errors if any
    if (results.errorDetails.length > 0) {
      console.log('\n=== Errors ===');
      results.errorDetails.forEach(err => {
        console.log(`- Carrier ${err.carrierName} (ID: ${err.carrierId}): ${err.error}`);
      });
    }

    // Show current distribution
    if (!options.dryRun) {
      console.log('\n=== Current Packet Status Distribution ===');
      const statusCounts = await prisma.carrier.groupBy({
        by: ['mcpPacketStatus'],
        where: whereClause,
        _count: {
          mcpPacketStatus: true
        },
        orderBy: {
          _count: {
            mcpPacketStatus: 'desc'
          }
        }
      });

      statusCounts.forEach(item => {
        console.log(`- ${item.mcpPacketStatus || 'Not Set'}: ${item._count.mcpPacketStatus}`);
      });

      // Show completion rate
      const completedCount = statusCounts.find(s => s.mcpPacketStatus === 'Completed')?._count.mcpPacketStatus || 0;
      const totalCount = statusCounts.reduce((sum, s) => sum + s._count.mcpPacketStatus, 0);
      const completionRate = totalCount > 0 ? ((completedCount / totalCount) * 100).toFixed(1) : 0;
      console.log(`\nCompletion Rate: ${completionRate}% (${completedCount}/${totalCount})`);
    }

    console.log(`\nCompleted at: ${new Date().toISOString()}`);

  } catch (error) {
    console.error('\nFatal error during sync:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the sync
syncPacketStatus().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});