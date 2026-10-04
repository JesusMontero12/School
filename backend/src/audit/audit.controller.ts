import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../common/decorators';
import { PaginationDto } from '../common/dto/pagination.dto';
import { AuditService } from './audit.service';

@ApiTags('Audit') @ApiBearerAuth()
@Controller('audit-logs')
export class AuditController {
  constructor(private service: AuditService) {}
  @Get() @RequirePermissions('audit.view')
  list(@Query() q: PaginationDto) { return this.service.list(q); }
}
