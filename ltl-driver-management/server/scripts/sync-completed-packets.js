const { PrismaClient } = require('@prisma/client');
const { mcpService } = require('../dist/services/mycarrierpackets.service');

const prisma = new PrismaClient();

async function syncCompletedPackets() {
  console.log('=== Syncing Completed Packet Status ===');
  console.log(`Started at: ${new Date().toISOString()}\n`);

  try {
    // Get all carriers that are monitored or have DOT numbers
    const carriers = await prisma.carrier.findMany({
      where: {
        OR: [
          { mcpMonitored: true },
          { dotNumber: { not: null } }
        ]
      },
      select: {
        id: true,
        name: true,
        dotNumber: true,
        mcNumber: true,
        mcpMonitored: true,
        mcpPacketCompleted: true,
        mcpPacketCompletedAt: true,
        mcpPacketStatus: true
      }
    });

    console.log(`Found ${carriers.length} carriers to check (monitored or with DOT numbers)\n`);

    // Set date range for 1 year
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 1);

    console.log(`Checking completed packets from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}\n`);

    // Get completed packets from MCP
    let completedPackets;
    try {
      const result = await mcpService.getCompletedPackets(startDate, endDate);
      completedPackets = result.packets;
      console.log(`Found ${completedPackets.length} completed packets in MCP\n`);
    } catch (error) {
      console.error('Failed to fetch completed packets from MCP:', error);
      process.exit(1);
    }

    // Create a map of completed packets by DOT number for faster lookup
    const completedPacketsMap = new Map();
    completedPackets.forEach(packet => {
      if (packet.dotNumber) {
        completedPacketsMap.set(packet.dotNumber, packet);
      }
    });

    // Track update results
    const results = {
      totalCarriers: carriers.length,
      alreadyCompleted: 0,
      newlyCompleted: 0,
      notCompleted: 0,
      errors: 0,
      updatedCarriers: []
    };

    // Process each carrier
    console.log('Processing carriers...\n');
    
    for (const carrier of carriers) {
      try {
        if (!carrier.dotNumber) {
          results.notCompleted++;
          continue;
        }

        const completedPacket = completedPacketsMap.get(carrier.dotNumber);

        if (completedPacket) {
          // Check if we need to update
          if (!carrier.mcpPacketCompleted || carrier.mcpPacketStatus !== 'Completed') {
            // Update carrier with completed packet info
            await prisma.carrier.update({
              where: { id: carrier.id },
              data: {
                mcpPacketCompleted: true,
                mcpPacketCompletedAt: completedPacket.completedAt,
                mcpPacketStatus: 'Completed',
                mcpLastSync: new Date()
              }
            });

            results.newlyCompleted++;
            results.updatedCarriers.push({
              id: carrier.id,
              name: carrier.name,
              dotNumber: carrier.dotNumber,
              previousStatus: carrier.mcpPacketStatus || 'Not Set',
              completedAt: completedPacket.completedAt
            });

            console.log(`✓ Updated: ${carrier.name} (DOT: ${carrier.dotNumber}) - Packet completed on ${completedPacket.completedAt.toLocaleDateString()}`);
          } else {
            results.alreadyCompleted++;
          }
        } else {
          // Not in completed packets list
          if (carrier.mcpPacketCompleted && carrier.mcpPacketStatus === 'Completed') {
            // Currently marked as completed but not in the list
            // This might be a data inconsistency - log it but don't change
            console.log(`⚠️  Warning: ${carrier.name} (DOT: ${carrier.dotNumber}) marked as completed locally but not found in MCP completed packets`);
          }
          results.notCompleted++;
        }
      } catch (error) {
        console.error(`✗ Error processing carrier ${carrier.name} (ID: ${carrier.id}):`, error.message);
        results.errors++;
      }
    }

    // Print summary
    console.log('\n=== Sync Summary ===');
    console.log(`Total carriers checked: ${results.totalCarriers}`);
    console.log(`Already completed: ${results.alreadyCompleted}`);
    console.log(`Newly updated to completed: ${results.newlyCompleted}`);
    console.log(`Not completed: ${results.notCompleted}`);
    console.log(`Errors: ${results.errors}`);

    if (results.updatedCarriers.length > 0) {
      console.log('\n=== Updated Carriers ===');
      console.table(results.updatedCarriers.map(c => ({
        ID: c.id,
        Name: c.name,
        'DOT Number': c.dotNumber,
        'Previous Status': c.previousStatus,
        'Completed Date': c.completedAt.toLocaleDateString()
      })));
    }

    // Show current packet status distribution
    console.log('\n=== Current Packet Status Distribution ===');
    const statusCounts = await prisma.carrier.groupBy({
      by: ['mcpPacketStatus'],
      where: {
        OR: [
          { mcpMonitored: true },
          { dotNumber: { not: null } }
        ]
      },
      _count: {
        mcpPacketStatus: true
      }
    });

    statusCounts.forEach(item => {
      console.log(`- ${item.mcpPacketStatus || 'Not Set'}: ${item._count.mcpPacketStatus}`);
    });

    console.log(`\nCompleted at: ${new Date().toISOString()}`);

  } catch (error) {
    console.error('Fatal error during sync:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the sync
syncCompletedPackets().catch(console.error);