#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const API_BASE_URL = 'https://api.mycarrierpackets.com';
const OLR_DOT_NUMBER = '1790872';

async function authenticate() {
    console.log('🔐 Authenticating with MyCarrierPackets API...');
    
    const tokenResponse = await axios.post(`${API_BASE_URL}/token`, 
        new URLSearchParams({
            grant_type: 'password',
            username: process.env.MYCARRIERPACKETS_USERNAME,
            password: process.env.MYCARRIERPACKETS_PASSWORD
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
    );
    
    return tokenResponse.data.access_token;
}

async function searchCompletedPackets() {
    console.log('🔍 Searching for OLR Transportation (DOT: 1790872) in completed packets...\n');
    
    // Calculate date range - 12 months ago to today
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 12);
    
    console.log(`📅 Date range: ${startDate.toISOString()} to ${endDate.toISOString()}\n`);
    
    try {
        // Get authentication token first
        const accessToken = await authenticate();
        console.log('✅ Authenticated successfully\n');
        
        // Fetch completed packets using POST with query params
        const params = new URLSearchParams({
            fromDate: startDate.toISOString(),
            toDate: endDate.toISOString()
        });
        
        const response = await axios.post(
            `${API_BASE_URL}/api/v1/Carrier/completedpackets?${params}`,
            {}, // Empty body
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log(`📦 Total completed packets found: ${response.data.length}\n`);
        
        // Show first few packets for debugging
        if (response.data.length > 0) {
            console.log('Sample packets (first 3):');
            response.data.slice(0, 3).forEach((packet, idx) => {
                console.log(`\nPacket ${idx + 1}:`);
                console.log(`  Legal Name: ${packet.LegalName || 'N/A'}`);
                console.log(`  DOT Number: ${packet.DOTNumber || 'N/A'}`);
                console.log(`  MC Number: ${packet.MCNumber || 'N/A'}`);
            });
            console.log('\n');
        }
        
        // Search for OLR Transportation
        const olrPackets = response.data.filter(packet => {
            // Check various fields where DOT number might appear
            return (
                packet.DOTNumber?.toString() === OLR_DOT_NUMBER ||
                (packet.LegalName && packet.LegalName.toLowerCase().includes('olr')) ||
                (packet.DBAName && packet.DBAName.toLowerCase().includes('olr'))
            );
        });
        
        if (olrPackets.length === 0) {
            console.log('❌ No completed packets found for OLR Transportation\n');
            
            // Let's also check if OLR appears in any packet data
            const possibleMatches = response.data.filter(packet => {
                const packetString = JSON.stringify(packet).toLowerCase();
                return packetString.includes('olr') || packetString.includes('1790872');
            });
            
            if (possibleMatches.length > 0) {
                console.log(`🔍 Found ${possibleMatches.length} packets that might be related to OLR:\n`);
                possibleMatches.forEach((packet, index) => {
                    console.log(`\nPossible Match ${index + 1}:`);
                    console.log('Legal Name:', packet.LegalName || 'N/A');
                    console.log('DBA Name:', packet.DBAName || 'N/A');
                    console.log('DOT Number:', packet.DOTNumber || 'N/A');
                    console.log('MC Number:', packet.MCNumber || 'N/A');
                    console.log('Packet Complete:', packet.PacketComplete === true ? 'Yes' : 'No');
                    console.log('Completed Date:', packet.PacketCompleteDate || 'N/A');
                });
            }
        } else {
            console.log(`✅ Found ${olrPackets.length} completed packet(s) for OLR Transportation!\n`);
            
            for (const packet of olrPackets) {
                console.log('📋 PACKET DATA:');
                console.log('================');
                console.log(JSON.stringify(packet, null, 2));
                console.log('\n');
                
                // Update database
                console.log('💾 Updating database...');
                
                try {
                    // Find the carrier in our database
                    const carrier = await prisma.carrier.findFirst({
                        where: {
                            dotNumber: OLR_DOT_NUMBER
                        }
                    });
                    
                    if (carrier) {
                        // Update the carrier's MCP status
                        const updated = await prisma.carrier.update({
                            where: { id: carrier.id },
                            data: {
                                mcpPacketCompleted: true,
                                mcpPacketCompletedAt: packet.PacketCompleteDate ? new Date(packet.PacketCompleteDate) : new Date(),
                                mcpPacketStatus: 'Completed',
                                mcpLastSync: new Date(),
                                // Update other fields from packet data
                                name: packet.LegalName || carrier.name,
                                dbaName: packet.DBAName || carrier.dbaName,
                                mcNumber: packet.MCNumber || carrier.mcNumber
                            }
                        });
                        
                        console.log(`✅ Updated carrier ${carrier.name} (ID: ${carrier.id}) with completed packet status`);
                        console.log(`   - DOT Number: ${packet.DOTNumber}`);
                        console.log(`   - Status: Completed`);
                        console.log(`   - Completed at: ${updated.mcpPacketCompletedAt}`);
                    } else {
                        console.log(`⚠️  No carrier found in database with DOT ${OLR_DOT_NUMBER}`);
                        
                        // Let's check if there's a carrier with similar name
                        const similarCarrier = await prisma.carrier.findFirst({
                            where: {
                                name: {
                                    contains: 'OLR',
                                    mode: 'insensitive'
                                }
                            }
                        });
                        
                        if (similarCarrier) {
                            console.log(`\n🔍 Found similar carrier: ${similarCarrier.name} (DOT: ${similarCarrier.dotNumber})`);
                            console.log('   Consider updating this carrier manually if it\'s the same company.');
                        }
                    }
                } catch (dbError) {
                    console.error('❌ Database update error:', dbError);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Error searching packets:', error.response?.data || error.message);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the script
searchCompletedPackets();