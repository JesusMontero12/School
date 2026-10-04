import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';
import { PaginationDto, paginated } from '../common/dto/pagination.dto';

export interface AuditEntry {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(private prisma: PrismaService) {}

  /** Nunca debe romper la operación principal. */
  async log(entry: AuditEntry) {
    try { await this.prisma.auditLog.create({ data: entry }); }
    catch (e) { this.logger.error('No se pudo registrar auditoría', e as Error); }
  }

  async list(q: PaginationDto) {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' }, skip: (q.page - 1) * q.limit, take: q.limit,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.auditLog.count(),
    ]);
    return paginated(rows, total, q);
  }
}
