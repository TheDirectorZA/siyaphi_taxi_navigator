import { PrismaClient, DataConfidence, StopType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Siyaphi database...');

  // ── City ──────────────────────────────────────────────
  const joburg = await prisma.city.upsert({
    where: { slug: 'johannesburg' },
    update: {},
    create: {
      name: 'Johannesburg',
      slug: 'johannesburg',
      countryCode: 'ZA',
      isActive: true,
      boundingBox: {
        minLat: -26.35,
        minLng: 27.85,
        maxLat: -25.65,
        maxLng: 28.25,
      },
    },
  });

  // ── Stops / Ranks ─────────────────────────────────────
  const stopsData = [
    {
      name: 'Noord Taxi Rank',
      aliases: ['Noord', 'Noord Street', 'Park Station Noord'],
      type: StopType.RANK,
      latitude: -26.1952,
      longitude: 28.0436,
      landmark: 'Near Park Station, Johannesburg CBD',
      dataConfidence: DataConfidence.HIGH,
    },
    {
      name: 'Park Station',
      aliases: ['Park Station Rank', 'Joubert Street'],
      type: StopType.RANK,
      latitude: -26.1973,
      longitude: 28.0432,
      landmark: 'Johannesburg main train station',
      dataConfidence: DataConfidence.HIGH,
    },
    {
      name: 'Bree Taxi Rank',
      aliases: ['Bree Street', 'Bree'],
      type: StopType.RANK,
      latitude: -26.2001,
      longitude: 28.0398,
      landmark: 'Bree Street, Johannesburg CBD',
      dataConfidence: DataConfidence.HIGH,
    },
    {
      name: 'Soweto Highway Rank',
      aliases: ['Soweto Rank', 'SW Rank'],
      type: StopType.RANK,
      latitude: -26.2673,
      longitude: 27.8585,
      landmark: 'Vilakazi Street area, Soweto',
      dataConfidence: DataConfidence.MEDIUM,
    },
    {
      name: 'Sandton City Rank',
      aliases: ['Sandton', 'Sandton Taxi Rank'],
      type: StopType.RANK,
      latitude: -26.1076,
      longitude: 28.0567,
      landmark: 'Sandton City Shopping Centre',
      dataConfidence: DataConfidence.HIGH,
    },
    {
      name: 'Alexandra Rank',
      aliases: ['Alex', 'Alexandra'],
      type: StopType.RANK,
      latitude: -26.1041,
      longitude: 28.0887,
      landmark: 'Alexandra Township entrance',
      dataConfidence: DataConfidence.MEDIUM,
    },
    {
      name: 'Bara Taxi Rank',
      aliases: ['Bara', 'Chris Hani Baragwanath'],
      type: StopType.RANK,
      latitude: -26.2701,
      longitude: 27.9395,
      landmark: 'Chris Hani Baragwanath Hospital, Soweto',
      dataConfidence: DataConfidence.MEDIUM,
    },
    {
      name: 'Randburg Taxi Rank',
      aliases: ['Randburg', 'Bram Fischer Drive'],
      type: StopType.RANK,
      latitude: -26.0927,
      longitude: 27.9879,
      landmark: 'Randburg CBD',
      dataConfidence: DataConfidence.MEDIUM,
    },
    {
      name: 'Midrand Taxi Rank',
      aliases: ['Midrand', 'Old Pretoria Road Midrand'],
      type: StopType.STOP,
      latitude: -25.9978,
      longitude: 28.1268,
      landmark: 'Midrand CBD near Gallagher Estate',
      dataConfidence: DataConfidence.LOW,
    },
    {
      name: 'Roodepoort Taxi Rank',
      aliases: ['Roodepoort', 'Rooi'],
      type: StopType.RANK,
      latitude: -26.1629,
      longitude: 27.8696,
      landmark: 'Roodepoort CBD',
      dataConfidence: DataConfidence.MEDIUM,
    },
  ];

  const stops: Record<string, any> = {};
  for (const s of stopsData) {
    const stop = await prisma.stop.upsert({
      where: { id: `seed-stop-${s.name.toLowerCase().replace(/\s+/g, '-')}` },
      update: {},
      create: {
        id: `seed-stop-${s.name.toLowerCase().replace(/\s+/g, '-')}`,
        cityId: joburg.id,
        ...s,
      },
    });
    stops[s.name] = stop;
  }

  // ── Routes ────────────────────────────────────────────
  const routesData = [
    {
      name: 'Noord → Soweto',
      shortCode: 'N-SOW',
      originName: 'Noord Taxi Rank',
      destinationName: 'Soweto Highway Rank',
      distanceKm: 18.5,
      operatingHours: { weekday: '05:00-22:00', saturday: '06:00-20:00', sunday: '07:00-18:00' },
      frequencyMinutes: 15,
      dataConfidence: DataConfidence.MEDIUM,
      originStop: 'Noord Taxi Rank',
      destStop: 'Soweto Highway Rank',
      viaStops: ['Bree Taxi Rank', 'Bara Taxi Rank'],
      fare: { min: 14, max: 20, typical: 16 },
      eta: { base: 45, min: 30, max: 75 },
    },
    {
      name: 'Noord → Sandton',
      shortCode: 'N-SAN',
      originName: 'Noord Taxi Rank',
      destinationName: 'Sandton City Rank',
      distanceKm: 22.0,
      operatingHours: { weekday: '05:30-21:00', saturday: '07:00-19:00', sunday: '08:00-17:00' },
      frequencyMinutes: 20,
      dataConfidence: DataConfidence.HIGH,
      originStop: 'Noord Taxi Rank',
      destStop: 'Sandton City Rank',
      viaStops: ['Alexandra Rank'],
      fare: { min: 16, max: 22, typical: 18 },
      eta: { base: 50, min: 35, max: 90 },
    },
    {
      name: 'Bree → Randburg',
      shortCode: 'B-RAN',
      originName: 'Bree Taxi Rank',
      destinationName: 'Randburg Taxi Rank',
      distanceKm: 14.0,
      operatingHours: { weekday: '05:00-21:30', saturday: '06:00-19:00', sunday: '07:30-17:00' },
      frequencyMinutes: 10,
      dataConfidence: DataConfidence.MEDIUM,
      originStop: 'Bree Taxi Rank',
      destStop: 'Randburg Taxi Rank',
      viaStops: [],
      fare: { min: 12, max: 18, typical: 14 },
      eta: { base: 35, min: 25, max: 60 },
    },
    {
      name: 'Park Station → Soweto (Bara)',
      shortCode: 'PS-SOW',
      originName: 'Park Station',
      destinationName: 'Bara Taxi Rank',
      distanceKm: 16.0,
      operatingHours: { weekday: '05:00-22:00', saturday: '06:00-20:00', sunday: '07:00-18:00' },
      frequencyMinutes: 12,
      dataConfidence: DataConfidence.MEDIUM,
      originStop: 'Park Station',
      destStop: 'Bara Taxi Rank',
      viaStops: ['Soweto Highway Rank'],
      fare: { min: 14, max: 19, typical: 16 },
      eta: { base: 40, min: 28, max: 70 },
    },
    {
      name: 'Noord → Midrand',
      shortCode: 'N-MID',
      originName: 'Noord Taxi Rank',
      destinationName: 'Midrand Taxi Rank',
      distanceKm: 35.0,
      operatingHours: { weekday: '05:30-20:00', saturday: '07:00-18:00', sunday: null },
      frequencyMinutes: 30,
      dataConfidence: DataConfidence.LOW,
      originStop: 'Noord Taxi Rank',
      destStop: 'Midrand Taxi Rank',
      viaStops: ['Sandton City Rank'],
      fare: { min: 22, max: 32, typical: 26 },
      eta: { base: 65, min: 45, max: 110 },
    },
    {
      name: 'Roodepoort → Bree',
      shortCode: 'ROO-B',
      originName: 'Roodepoort Taxi Rank',
      destinationName: 'Bree Taxi Rank',
      distanceKm: 20.0,
      operatingHours: { weekday: '05:00-21:00', saturday: '06:30-19:00', sunday: '08:00-16:00' },
      frequencyMinutes: 18,
      dataConfidence: DataConfidence.MEDIUM,
      originStop: 'Roodepoort Taxi Rank',
      destStop: 'Bree Taxi Rank',
      viaStops: [],
      fare: { min: 15, max: 21, typical: 17 },
      eta: { base: 45, min: 32, max: 75 },
    },
  ];

  for (const r of routesData) {
    const existing = await prisma.route.findFirst({ where: { shortCode: r.shortCode, cityId: joburg.id } });
    if (existing) continue;

    const route = await prisma.route.create({
      data: {
        cityId: joburg.id,
        name: r.name,
        shortCode: r.shortCode,
        originName: r.originName,
        destinationName: r.destinationName,
        distanceKm: r.distanceKm,
        operatingHours: r.operatingHours,
        frequencyMinutes: r.frequencyMinutes,
        dataConfidence: r.dataConfidence,
        isActive: true,
        publishedAt: new Date(),
      },
    });

    // Route stops (origin, via, destination)
    const allStopNames = [r.originStop, ...r.viaStops, r.destStop];
    for (let i = 0; i < allStopNames.length; i++) {
      const stop = stops[allStopNames[i]];
      if (!stop) continue;
      await prisma.routeStop.create({
        data: {
          routeId: route.id,
          stopId: stop.id,
          sequence: i + 1,
          isTerminal: i === 0 || i === allStopNames.length - 1,
          minutesFromOrigin: i === 0 ? 0 : null,
        },
      });
    }

    // Fare range
    await prisma.fareRange.create({
      data: {
        routeId: route.id,
        minFareZAR: r.fare.min,
        maxFareZAR: r.fare.max,
        typicalFareZAR: r.fare.typical,
        confidence: r.dataConfidence,
        source: 'community',
      },
    });

    // ETA config
    await prisma.etaConfig.create({
      data: {
        routeId: route.id,
        baseMinutes: r.eta.base,
        minMinutes: r.eta.min,
        maxMinutes: r.eta.max,
        peakMultiplier: 1.45,
        offPeakMultiplier: 1.0,
        weekendMultiplier: 1.15,
        confidence: r.dataConfidence,
      },
    });

    // Seed a sample route version snapshot
    await prisma.routeVersion.create({
      data: {
        routeId: route.id,
        version: 1,
        snapshot: { name: r.name, fareMin: r.fare.min, fareMax: r.fare.max },
        changedBy: 'seed',
        changeNote: 'Initial seed data',
      },
    });
  }

  // ── Sync Manifests ────────────────────────────────────
  await prisma.syncManifest.upsert({
    where: { cityId: joburg.id },
    update: { generatedAt: new Date() },
    create: {
      cityId: joburg.id,
      routesHash: 'seed-v1-routes',
      stopsHash: 'seed-v1-stops',
      faresHash: 'seed-v1-fares',
      version: 1,
    },
  });

  // ── Sample crowd reports ──────────────────────────────
  await prisma.crowdReport.createMany({
    data: [
      {
        deviceId: 'seed-device-001',
        cityId: joburg.id,
        type: 'DELAY',
        severity: 'MEDIUM',
        description: 'Long queue at Noord rank, taxis filling slowly',
        latitude: -26.1952,
        longitude: 28.0436,
        status: 'APPROVED',
        trustScore: 0.7,
        upvotes: 5,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      },
      {
        deviceId: 'seed-device-002',
        cityId: joburg.id,
        type: 'RANK_CONGESTION',
        severity: 'HIGH',
        description: 'Bree rank very busy, taxis fighting for space',
        latitude: -26.2001,
        longitude: 28.0398,
        status: 'APPROVED',
        trustScore: 0.8,
        upvotes: 12,
        expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000),
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ Seed complete.');
  console.log(`   City: ${joburg.name}`);
  console.log(`   Stops: ${Object.keys(stops).length}`);
  console.log(`   Routes: ${routesData.length}`);
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
