import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class FaresService {
  constructor(private prisma: PrismaService) {}

  async getFareForRoute(routeId: string) {
    const fare = await this.prisma.fareRange.findFirst({
      where: { routeId, effectiveTo: null },
      orderBy: { createdAt: 'desc' },
    });

    if (!fare) {
      return {
        available: false,
        message: 'Fare data not available for this route. Ask the driver or other commuters.',
        fallbackTip: 'Carry R10–R30 for most short city routes in Joburg.',
      };
    }

    const dataAgeDays = Math.floor(
      (Date.now() - new Date(fare.updatedAt).getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      available: true,
      minZAR: fare.minFareZAR,
      maxZAR: fare.maxFareZAR,
      typicalZAR: fare.typicalFareZAR,
      currency: fare.currency,
      confidence: fare.confidence,
      source: fare.source,
      dataAgeDays,
      isStale: dataAgeDays > 60,
      disclaimer: 'Fares are community estimates and may vary. Always confirm with the driver.',
    };
  }

  async getFaresForSync(cityId: string) {
    return this.prisma.fareRange.findMany({
      where: { route: { cityId }, effectiveTo: null },
      include: { route: { select: { id: true, shortCode: true } } },
    });
  }
}
