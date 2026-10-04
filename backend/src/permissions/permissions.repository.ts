import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class PermissionsRepository {
  constructor(private prisma: PrismaService) {}
  findAll() { return this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] }); }
  countByIds(ids: string[]) { return this.prisma.permission.count({ where: { id: { in: ids } } }); }
}
