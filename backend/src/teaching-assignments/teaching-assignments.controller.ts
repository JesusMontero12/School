import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClientMeta, ClientMetaData, CurrentUser, RequirePermissions } from '../common/decorators';
import { AuthUser } from '../common/types/auth-user';
import { CoverageDto, CreateAssignmentDto, EndAssignmentDto, ListAssignmentsDto, ReassignDto } from './dto/teaching-assignments.dto';
import { TeachingAssignmentsService } from './teaching-assignments.service';

@ApiTags('Asignaciones docentes') @ApiBearerAuth()
@Controller('teaching-assignments')
export class TeachingAssignmentsController {
  constructor(private service: TeachingAssignmentsService) {}

  @Get() @RequirePermissions('assignment.view')
  list(@Query() q: ListAssignmentsDto, @CurrentUser() u: AuthUser) { return this.service.list(q, u); }

  @Get('coverage') @RequirePermissions('assignment.create')
  coverage(@Query() q: CoverageDto) { return this.service.coverage(q); }

  @Post() @RequirePermissions('assignment.create')
  create(@Body() dto: CreateAssignmentDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.create(dto, u.id, m); }

  @Post(':id/reassign') @RequirePermissions('assignment.edit')
  reassign(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReassignDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.reassign(id, dto, u.id, m); }

  @Post(':id/end') @RequirePermissions('assignment.edit')
  end(@Param('id', ParseUUIDPipe) id: string, @Body() dto: EndAssignmentDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.end(id, dto, u.id, m); }
}
