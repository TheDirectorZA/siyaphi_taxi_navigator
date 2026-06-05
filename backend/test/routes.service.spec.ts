import { Test, TestingModule } from '@nestjs/testing';
import { RoutesService } from '../../src/routes/routes.service';
import { PrismaService } from '../../src/common/prisma/prisma.service';

// Mock PrismaService to avoid DB dependency in unit tests
const mockPrisma = {
  city: { findFirst: jest.fn() },
  stop: { findMany: jest.fn() },
  route: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
};

describe('RoutesService', () => {
  let service: RoutesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<RoutesService>(RoutesService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('searchRoutes', () => {
    it('returns dataUnavailable when no active city found', async () => {
      mockPrisma.city.findFirst.mockResolvedValue(null);
      const result = await service.searchRoutes({ originQuery: 'Noord' });
      expect(result.dataUnavailable).toBe(true);
      expect(result.routes).toHaveLength(0);
    });

    it('returns empty results when no routes match', async () => {
      mockPrisma.city.findFirst.mockResolvedValue({ id: 'city-1', name: 'Joburg', slug: 'johannesburg' });
      mockPrisma.stop.findMany.mockResolvedValue([]);
      mockPrisma.route.findMany.mockResolvedValue([]);
      mockPrisma.route.count.mockResolvedValue(0);

      const result = await service.searchRoutes({ originQuery: 'Unknown Place', citySlug: 'johannesburg' });
      expect(result.routes).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('returns routes with enriched fare and eta', async () => {
      mockPrisma.city.findFirst.mockResolvedValue({ id: 'city-1', name: 'Joburg', slug: 'johannesburg' });
      mockPrisma.stop.findMany.mockResolvedValue([{ id: 'stop-1' }]);
      mockPrisma.route.count.mockResolvedValue(1);
      mockPrisma.route.findMany.mockResolvedValue([
        {
          id: 'route-1',
          name: 'Noord → Soweto',
          shortCode: 'N-SOW',
          originName: 'Noord',
          destinationName: 'Soweto',
          distanceKm: 18,
          dataConfidence: 'MEDIUM',
          updatedAt: new Date(),
          operatingHours: { weekday: '05:00-22:00' },
          frequencyMinutes: 15,
          fares: [{ minFareZAR: 14, maxFareZAR: 20, typicalFareZAR: 16, confidence: 'MEDIUM', source: 'community', updatedAt: new Date() }],
          etaConfigs: [{ baseMinutes: 45, minMinutes: 30, maxMinutes: 75, peakMultiplier: 1.45, offPeakMultiplier: 1.0, weekendMultiplier: 1.15, confidence: 'MEDIUM' }],
          stops: [
            { sequence: 1, isTerminal: true, stop: { id: 'stop-1', name: 'Noord', latitude: -26.195, longitude: 28.043, type: 'RANK' } },
          ],
        },
      ]);

      const result = await service.searchRoutes({ originQuery: 'Noord', citySlug: 'johannesburg' });
      expect(result.routes).toHaveLength(1);
      expect(result.routes[0].fare).toBeDefined();
      expect(result.routes[0].eta).toBeDefined();
      expect(result.routes[0].fare.minZAR).toBe(14);
    });
  });
});
