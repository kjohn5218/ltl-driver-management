#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOLRStatus() {
    try {
        const olr = await prisma.carrier.findFirst({
            where: { dotNumber: '1790872' },
            select: {
                id: true,
                name: true,
                dotNumber: true,
                mcNumber: true,
                mcpPacketCompleted: true,
                mcpPacketStatus: true,
                mcpPacketCompletedAt: true,
                mcpLastSync: true
            }
        });
        
        if (olr) {
            console.log('\n✅ OLR Transportation Status:');
            console.log('================================');
            console.log(`ID: ${olr.id}`);
            console.log(`Name: ${olr.name}`);
            console.log(`DOT Number: ${olr.dotNumber}`);
            console.log(`MC Number: ${olr.mcNumber}`);
            console.log(`\nMCP Packet Status:`);
            console.log(`  - Completed: ${olr.mcpPacketCompleted ? 'YES ✅' : 'NO ❌'}`);
            console.log(`  - Status: ${olr.mcpPacketStatus}`);
            console.log(`  - Completed At: ${olr.mcpPacketCompletedAt ? olr.mcpPacketCompletedAt.toLocaleString() : 'N/A'}`);
            console.log(`  - Last Sync: ${olr.mcpLastSync ? olr.mcpLastSync.toLocaleString() : 'N/A'}`);
        } else {
            console.log('❌ OLR Transportation not found in database');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkOLRStatus();