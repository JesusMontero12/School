import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '../common/decorators';
import { AuthUser } from '../common/types/auth-user';
import { ListReportCardsDto } from './dto/report-cards.dto';
import { ReportCardsService } from './report-cards.service';

@ApiTags('Boletines') @ApiBearerAuth()
@Controller('report-cards')
export class ReportCardsController {
  constructor(private service: ReportCardsService) {}

  @Get() @RequirePermissions('grade.view')
  list(@Query() q: ListReportCardsDto, @CurrentUser() u: AuthUser) { return this.service.list(q, u); }

  @Get(':enrollmentId') @RequirePermissions('grade.view')
  get(@Param('enrollmentId', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) { return this.service.get(id, u); }
}
