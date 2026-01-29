/**
 * Script to populate leg order for multi-leg routes
 *
 * Multi-leg routes have multiple entries with the same name, each representing
 * a different leg of the journey. This script:
 * 1. Identifies multi-leg routes (same name, multiple entries)
 * 2. Determines the leg sequence by following the origin->destination chain
 * 3. Calculates day offset for overnight legs
 * 4. Updates the routes with legOrder, dayOffset, and isMultiLeg
 *
 * Run with: npx ts-node src/scripts/populateMultiLegOrder.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface RouteWithTimes {
  id: number;
  name: string;
  origin: string;
  destination: string;
  departureTime: string | null;
  arrivalTime: string | null;
}

// Parse time string (HH:MM:SS or HH:MM) to minutes from midnight
function parseTimeToMinutes(time: string | null): number {
  if (!time) return 0;
  const parts = time.split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  return hours * 60 + minutes;
}

// Extract potential terminal codes from route name (e.g., "DENCPRMSP1" -> ["DEN", "CPR", "MSP"])
function extractTerminalCodesFromName(routeName: string): string[] {
  // Remove trailing numbers
  const baseName = routeName.replace(/\d+$/, '');

  // Common terminal code lengths are 2-4 characters
  // Try to split the name into 3-letter codes first
  const codes: string[] = [];
  let remaining = baseName;

  while (remaining.length >= 3) {
    codes.push(remaining.substring(0, 3));
    remaining = remaining.substring(3);
  }

  return codes;
}

// Determine leg order by building the chain from origin to destination
function buildLegChain(routes: RouteWithTimes[]): RouteWithTimes[] {
  if (routes.length <= 1) return routes;

  const routeName = routes[0].name;

  // Find all origins and destinations
  const origins = new Set(routes.map(r => r.origin));
  const destinations = new Set(routes.map(r => r.destination));

  // The starting terminal is an origin that isn't anyone's destination
  let startingTerminals = [...origins].filter(o => !destinations.has(o));

  // If multiple starting terminals, prefer the one that matches the route name prefix
  if (startingTerminals.length > 1) {
    const nameTerminals = extractTerminalCodesFromName(routeName);
    const preferredStart = startingTerminals.find(t => nameTerminals[0]?.toUpperCase() === t.toUpperCase());
    if (preferredStart) {
      startingTerminals = [preferredStart];
      console.log(`    Multiple starting terminals found, preferring ${preferredStart} based on route name`);
    }
  }

  // If we can't find a clear starting point, try to use the route name to determine start
  if (startingTerminals.length === 0) {
    const nameTerminals = extractTerminalCodesFromName(routeName);
    const potentialStart = [...origins].find(o => nameTerminals[0]?.toUpperCase() === o.toUpperCase());
    if (potentialStart) {
      startingTerminals = [potentialStart];
      console.log(`    No clear starting terminal, using ${potentialStart} from route name`);
    } else {
      console.log('    Could not find starting terminal, using time-based ordering');
      return routes.sort((a, b) => parseTimeToMinutes(a.departureTime) - parseTimeToMinutes(b.departureTime));
    }
  }

  const startingTerminal = startingTerminals[0];
  const chain: RouteWithTimes[] = [];

  // Build a map of origin -> routes (there might be multiple routes from same origin)
  const routeMap = new Map<string, RouteWithTimes[]>();
  for (const route of routes) {
    const existing = routeMap.get(route.origin) || [];
    existing.push(route);
    routeMap.set(route.origin, existing);
  }

  // Follow the chain
  let currentOrigin = startingTerminal;
  const visited = new Set<number>();
  let lastDepartureMinutes = -1;

  while (routeMap.has(currentOrigin) && chain.length < routes.length) {
    const possibleRoutes = routeMap.get(currentOrigin)!.filter(r => !visited.has(r.id));
    if (possibleRoutes.length === 0) break;

    // If multiple routes from same origin, pick the one with departure time after last arrival
    // or the earliest departure if this is the first leg
    let route: RouteWithTimes;
    if (possibleRoutes.length === 1) {
      route = possibleRoutes[0];
    } else {
      // Sort by departure time and pick appropriately
      possibleRoutes.sort((a, b) => parseTimeToMinutes(a.departureTime) - parseTimeToMinutes(b.departureTime));
      if (lastDepartureMinutes === -1) {
        // First leg - prefer evening departure (after 18:00 / 1080 minutes)
        route = possibleRoutes.find(r => parseTimeToMinutes(r.departureTime) >= 1080) || possibleRoutes[0];
      } else {
        // Pick the first one that departs after or close to the expected time
        route = possibleRoutes[0];
      }
    }

    visited.add(route.id);
    chain.push(route);
    lastDepartureMinutes = parseTimeToMinutes(route.departureTime);
    currentOrigin = route.destination;
  }

  // If we didn't get all routes, add the remaining ones at the end
  if (chain.length < routes.length) {
    const remainingRoutes = routes.filter(r => !visited.has(r.id));
    console.log(`    Warning: ${remainingRoutes.length} routes not in main chain, adding as separate legs`);

    // Try to order remaining routes as their own chain(s)
    const orderedRemaining = remainingRoutes.sort((a, b) =>
      parseTimeToMinutes(a.departureTime) - parseTimeToMinutes(b.departureTime)
    );
    chain.push(...orderedRemaining);
  }

  return chain;
}

// Calculate day offsets based on departure/arrival times
function calculateDayOffsets(chain: RouteWithTimes[]): Map<number, number> {
  const dayOffsets = new Map<number, number>();
  let currentDayOffset = 0;
  let lastArrivalMinutes = -1;

  for (let i = 0; i < chain.length; i++) {
    const route = chain[i];
    const departureMinutes = parseTimeToMinutes(route.departureTime);

    // If this leg's departure is earlier than the previous leg's departure,
    // it means we've crossed midnight
    if (i > 0 && departureMinutes < parseTimeToMinutes(chain[i-1].departureTime)) {
      // Check if it's a significant time jump (e.g., from 21:30 to 02:45)
      // vs a small variation
      if (parseTimeToMinutes(chain[i-1].departureTime) > 720 && departureMinutes < 720) {
        currentDayOffset++;
      }
    }

    // Also check if arrival time from previous leg suggests overnight
    if (i > 0 && lastArrivalMinutes > -1) {
      const arrivalMinutes = parseTimeToMinutes(chain[i-1].arrivalTime);
      // If previous arrival is after midnight (small number) and previous departure
      // was before midnight (large number), it crossed midnight
      if (arrivalMinutes < parseTimeToMinutes(chain[i-1].departureTime)) {
        // Arrival crossed midnight
        if (departureMinutes >= arrivalMinutes) {
          // Departure is after arrival, same day
        } else {
          // Departure is before previous arrival time, likely next day
          currentDayOffset++;
        }
      }
    }

    dayOffsets.set(route.id, currentDayOffset);
    lastArrivalMinutes = parseTimeToMinutes(route.arrivalTime);
  }

  return dayOffsets;
}

async function populateMultiLegOrder() {
  console.log('Starting multi-leg route order population...\n');

  try {
    // Get all routes grouped by name
    const allRoutes = await prisma.route.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        origin: true,
        destination: true,
        departureTime: true,
        arrivalTime: true
      },
      orderBy: { name: 'asc' }
    });

    // Group routes by name
    const routesByName = new Map<string, RouteWithTimes[]>();
    for (const route of allRoutes) {
      const existing = routesByName.get(route.name) || [];
      existing.push(route);
      routesByName.set(route.name, existing);
    }

    console.log(`Found ${routesByName.size} unique route names\n`);

    let multiLegCount = 0;
    let singleLegCount = 0;
    let updatedRoutes = 0;

    for (const [name, routes] of routesByName) {
      if (routes.length === 1) {
        // Single leg route - mark as not multi-leg
        singleLegCount++;
        await prisma.route.update({
          where: { id: routes[0].id },
          data: {
            legOrder: 1,
            dayOffset: 0,
            isMultiLeg: false
          }
        });
        updatedRoutes++;
        continue;
      }

      // Multi-leg route
      multiLegCount++;
      console.log(`Processing multi-leg route: ${name} (${routes.length} legs)`);

      // Build the leg chain
      const chain = buildLegChain(routes);

      // Calculate day offsets
      const dayOffsets = calculateDayOffsets(chain);

      // Update each route with its leg order
      for (let i = 0; i < chain.length; i++) {
        const route = chain[i];
        const dayOffset = dayOffsets.get(route.id) || 0;

        await prisma.route.update({
          where: { id: route.id },
          data: {
            legOrder: i + 1,
            dayOffset: dayOffset,
            isMultiLeg: true
          }
        });

        console.log(`  Leg ${i + 1}: ${route.origin} -> ${route.destination} (Day +${dayOffset}, Depart: ${route.departureTime})`);
        updatedRoutes++;
      }
      console.log('');
    }

    console.log('--- Summary ---');
    console.log(`Single-leg routes: ${singleLegCount}`);
    console.log(`Multi-leg routes: ${multiLegCount}`);
    console.log(`Total routes updated: ${updatedRoutes}`);

  } catch (error) {
    console.error('Error populating multi-leg order:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
populateMultiLegOrder()
  .then(() => {
    console.log('\nMulti-leg order population complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nMulti-leg order population failed:', error);
    process.exit(1);
  });
