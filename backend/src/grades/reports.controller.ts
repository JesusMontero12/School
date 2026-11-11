import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { AuthUser } from '../common/types/auth-user';
import { ReportFiltersDto } from './dto/reports.dto';
import { ReportsService } from './reports.service';

@ApiTags('Reportes académicos') @ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private service: ReportsService) {}

  @Get('performance') @RequirePermissions('report.view')
  performance(@Query() q: ReportFiltersDto, @CurrentUser() u: AuthUser) { return this.service.performance(q, u); }

  @Get('students') @RequirePermissions('report.view')
  students(@Query() q: ReportFiltersDto, @CurrentUser() u: AuthUser) { return this.service.students(q, u); }

  @Get('pending') @RequirePermissions('report.view')
  pending(@Query() q: ReportFiltersDto, @CurrentUser() u: AuthUser) { return this.service.pending(q, u); }
}
