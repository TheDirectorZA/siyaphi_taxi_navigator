import { Test, TestingModule } from '@nestjs/testing';
import { ReportsModerationService } from '../../src/reports/reports.moderation.service';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { ReportType } from '@prisma/client';

const mockPrisma = {
  device: { findUnique: jest.fn() },
  crowdReport: { findMany: jest.fn() },
};

const mockConfig = {
  get: jest.fn((key: string, fallback: string) => {
    const map: Record<string, string> = {
      REPORT_DUPLICATE_WINDOW_MINUTES: '10',
      REPORT_DUPLICATE_RADIUS_METERS: '200',
    };
    return map[key] ?? fallback;
  }),
};

describe('ReportsModerationService', () => {
  let service: ReportsModerationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsModerationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get<ReportsModerationService>(ReportsModerationService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('computeInitialTrustScore', () => {
    it('returns 0.3 for unknown device', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(null);
      const score = await service.computeInitialTrustScore('unknown-device', ReportType.DELAY);
      expect(score).toBe(0.3);
    });

    it('increases trust for established device', async () => {
      mockPrisma.device.findUnique.mockResolvedValue({
        id: 'device-1', trustScore: 0.7, reportCount: 10,
      });
      const score = await service.computeInitialTrustScore('device-1', ReportType.DELAY);
      expect(score).toBeGreaterThan(0.7);
    });
  });

  describe('determineInitialStatus', () => {
    it('always marks SAFETY_INCIDENT as PENDING', () => {
      const status = service.determineInitialStatus(0.9, ReportType.SAFETY_INCIDENT);
      expect(status).toBe('PENDING');
    });

    it('auto-approves high-trust non-safety reports', () => {
      const status = service.determineInitialStatus(0.8, ReportType.DELAY);
      expect(status).toBe('APPROVED');
    });

    it('flags low-trust reports', () => {
      const status = service.determineInitialStatus(0.2, ReportType.DELAY);
      expect(status).toBe('FLAGGED');
    });
  });

  describe('findDuplicate', () => {
    it('returns null when no similar recent reports exist', async () => {
      mockPrisma.crowdReport.findMany.mockResolvedValue([]);
      const result = await service.findDuplicate(ReportType.DELAY, -26.19, 28.04);
      expect(result).toBeNull();
    });

    it('detects duplicate within radius', async () => {
      mockPrisma.crowdReport.findMany.mockResolvedValue([
        { id: 'report-1', latitude: -26.1901, longitude: 28.0401 },
      ]);
      const result = await service.findDuplicate(ReportType.DELAY, -26.1902, 28.0402);
      expect(result).toBe('report-1');
    });

    it('does not flag reports outside radius as duplicates', async () => {
      mockPrisma.crowdReport.findMany.mockResolvedValue([
        { id: 'report-far', latitude: -26.25, longitude: 28.08 },
      ]);
      const result = await service.findDuplicate(ReportType.DELAY, -26.19, 28.04);
      expect(result).toBeNull();
    });
  });
});
