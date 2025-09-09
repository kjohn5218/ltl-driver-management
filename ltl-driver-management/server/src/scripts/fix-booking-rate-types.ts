import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface BookingAnalysis {
  id: number;
  currentRateType: string;
  rate: number;
  baseRate?: number;
  notes?: string;
  route?: { distance: number };
  calculatedRatePerMile?: number;
  suggestedRateType: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reason: string;
}

async function analyzeBookings() {
  console.log('🔍 Analyzing bookings for incorrect rate types...\n');
  
  const bookings = await prisma.booking.findMany({
    where: {
      rateType: 'FLAT_RATE'
    },
    include: {
      route: true
    }
  });

  const analyses: BookingAnalysis[] = [];

  for (const booking of bookings) {
    const analysis: BookingAnalysis = {
      id: booking.id,
      currentRateType: booking.rateType,
      rate: Number(booking.rate),
      baseRate: booking.baseRate ? Number(booking.baseRate) : undefined,
      notes: booking.notes || undefined,
      route: booking.route ? { distance: Number(booking.route.distance) } : undefined,
      calculatedRatePerMile: 0,
      suggestedRateType: 'FLAT_RATE',
      confidence: 'LOW',
      reason: 'Unknown'
    };

    // Check if this is a multi-leg booking
    if (booking.notes?.includes('--- Multi-Leg Booking ---')) {
      // Parse multi-leg booking
      const legMatches = booking.notes.match(/Leg \d+: .+ → .+ \(\$(.+)\)/g);
      if (legMatches && legMatches.length > 1) {
        analysis.suggestedRateType = 'MILE_FSC'; // Most multi-leg bookings use FSC
        analysis.confidence = 'HIGH';
        analysis.reason = `Multi-leg booking with ${legMatches.length} legs - should preserve calculation method`;
      }
    } 
    // Check single route bookings with suspicious rate-per-mile ratios
    else if (booking.route?.distance) {
      const ratePerMile = Number(booking.rate) / Number(booking.route.distance);
      analysis.calculatedRatePerMile = Math.round(ratePerMile * 100) / 100;

      // If rate per mile is a common carrier rate (between $1.50-$4.00), it's likely calculated
      if (ratePerMile >= 1.50 && ratePerMile <= 4.00) {
        // Check if the rate suggests FSC was applied (common FSC rates: 25-35%)
        const baseRateEstimate = ratePerMile / 1.30; // Assuming ~30% FSC
        if (baseRateEstimate >= 1.80 && baseRateEstimate <= 2.50) {
          analysis.suggestedRateType = 'MILE_FSC';
          analysis.confidence = 'MEDIUM';
          analysis.reason = `Rate of $${ratePerMile.toFixed(2)}/mile suggests calculated rate with FSC`;
        } else {
          analysis.suggestedRateType = 'MILE';
          analysis.confidence = 'MEDIUM';
          analysis.reason = `Rate of $${ratePerMile.toFixed(2)}/mile suggests per-mile calculation`;
        }
      }
      // Very round numbers might be true flat rates
      else if (Number(booking.rate) % 50 === 0 || Number(booking.rate) % 25 === 0) {
        analysis.suggestedRateType = 'FLAT_RATE';
        analysis.confidence = 'HIGH';
        analysis.reason = `Round number ($${booking.rate}) suggests genuine flat rate`;
      }
    }

    analyses.push(analysis);
  }

  return analyses;
}

async function displayAnalysis() {
  const analyses = await analyzeBookings();
  
  console.log(`📊 Analysis Results (${analyses.length} bookings analyzed):\n`);
  
  const needsFixing = analyses.filter(a => a.suggestedRateType !== 'FLAT_RATE');
  console.log(`🔧 Bookings needing rate type correction: ${needsFixing.length}\n`);

  // Group by confidence level
  const highConfidence = needsFixing.filter(a => a.confidence === 'HIGH');
  const mediumConfidence = needsFixing.filter(a => a.confidence === 'MEDIUM');

  console.log('🎯 HIGH CONFIDENCE CORRECTIONS:');
  highConfidence.forEach(analysis => {
    console.log(`  📦 Booking #${analysis.id}: FLAT_RATE → ${analysis.suggestedRateType}`);
    console.log(`     💰 Rate: $${analysis.rate} (${analysis.calculatedRatePerMile ? `$${analysis.calculatedRatePerMile}/mile` : 'Multi-leg'})`);
    console.log(`     📝 Reason: ${analysis.reason}\n`);
  });

  console.log('⚠️  MEDIUM CONFIDENCE CORRECTIONS:');
  mediumConfidence.forEach(analysis => {
    console.log(`  📦 Booking #${analysis.id}: FLAT_RATE → ${analysis.suggestedRateType}`);
    console.log(`     💰 Rate: $${analysis.rate} ($${analysis.calculatedRatePerMile}/mile)`);
    console.log(`     📝 Reason: ${analysis.reason}\n`);
  });

  return { highConfidence, mediumConfidence };
}

async function fixBookings(bookingIds: number[], newRateType: string, dryRun: boolean = true) {
  console.log(`${dryRun ? '🧪 DRY RUN:' : '💾 FIXING:'} Updating ${bookingIds.length} bookings to ${newRateType}\n`);

  for (const id of bookingIds) {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { route: true }
    });

    if (!booking) continue;

    let updateData: any = {
      rateType: newRateType as any
    };

    // Calculate proper baseRate and fscRate based on new rate type
    if (newRateType === 'MILE' && booking.route?.distance) {
      updateData.baseRate = Number(booking.rate) / Number(booking.route.distance);
    } else if (newRateType === 'MILE_FSC' && booking.route?.distance) {
      // Assume 30% FSC and calculate base rate
      const totalPerMile = Number(booking.rate) / Number(booking.route.distance);
      updateData.baseRate = totalPerMile / 1.30; // Remove ~30% FSC
      updateData.fscRate = 30.0; // Default FSC rate
    }

    console.log(`  📦 Booking #${id}: ${booking.rateType} → ${newRateType}`);
    if (updateData.baseRate) {
      console.log(`     📊 Base Rate: $${Number(updateData.baseRate).toFixed(2)}/mile`);
    }

    if (!dryRun) {
      await prisma.booking.update({
        where: { id },
        data: updateData
      });
      console.log('     ✅ Updated');
    } else {
      console.log('     🧪 Would update (dry run)');
    }
    console.log('');
  }
}

async function main() {
  try {
    console.log('🚀 Starting booking rate type analysis and fix utility\n');
    
    const { highConfidence, mediumConfidence } = await displayAnalysis();

    console.log('\n' + '='.repeat(60));
    console.log('📋 RECOMMENDED ACTIONS:');
    console.log('='.repeat(60));

    if (highConfidence.length > 0) {
      console.log(`\n1. Fix ${highConfidence.length} HIGH CONFIDENCE bookings:`);
      console.log(`   Booking IDs: ${highConfidence.map(a => a.id).join(', ')}`);
    }

    if (mediumConfidence.length > 0) {
      console.log(`\n2. Review ${mediumConfidence.length} MEDIUM CONFIDENCE bookings:`);
      console.log(`   Booking IDs: ${mediumConfidence.map(a => a.id).join(', ')}`);
    }

    console.log('\n💡 To fix high confidence bookings, run:');
    console.log('   npx ts-node src/scripts/fix-booking-rate-types.ts --fix-high-confidence');
    
    console.log('\n⚠️  To fix all bookings, run:');
    console.log('   npx ts-node src/scripts/fix-booking-rate-types.ts --fix-all');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Command line handling
const args = process.argv.slice(2);

if (args.includes('--fix-high-confidence')) {
  // Fix high confidence bookings
  analyzeBookings().then(async (analyses) => {
    const highConfidence = analyses.filter(a => a.confidence === 'HIGH' && a.suggestedRateType !== 'FLAT_RATE');
    const mileBookings = highConfidence.filter(a => a.suggestedRateType === 'MILE').map(a => a.id);
    const mileFscBookings = highConfidence.filter(a => a.suggestedRateType === 'MILE_FSC').map(a => a.id);

    if (mileBookings.length > 0) {
      await fixBookings(mileBookings, 'MILE', false);
    }
    if (mileFscBookings.length > 0) {
      await fixBookings(mileFscBookings, 'MILE_FSC', false);
    }
  });
} else if (args.includes('--fix-all')) {
  // Fix all suggested bookings
  analyzeBookings().then(async (analyses) => {
    const needsFixing = analyses.filter(a => a.suggestedRateType !== 'FLAT_RATE');
    const mileBookings = needsFixing.filter(a => a.suggestedRateType === 'MILE').map(a => a.id);
    const mileFscBookings = needsFixing.filter(a => a.suggestedRateType === 'MILE_FSC').map(a => a.id);

    if (mileBookings.length > 0) {
      await fixBookings(mileBookings, 'MILE', false);
    }
    if (mileFscBookings.length > 0) {
      await fixBookings(mileFscBookings, 'MILE_FSC', false);
    }
  });
} else {
  // Just run analysis
  main();
}