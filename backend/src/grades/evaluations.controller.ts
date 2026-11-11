import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClientMeta, ClientMetaData, CurrentUser, RequirePermissions } from '../common/decorators';
import { AuthUser } from '../common/types/auth-user';
import { CreateEvaluationDto, GradeSheetDto, ListEvaluationsDto, SaveScoresDto, UpdateEvaluationDto, VoidEvaluationDto } from './dto/grades.dto';
import { EvaluationsService } from './evaluations.service';

@ApiTags('Evaluaciones y calificaciones') @ApiBearerAuth()
@Controller()
export class EvaluationsController {
  constructor(private service: EvaluationsService) {}

  @Get('grade-sheet') @RequirePermissions('grade.view')
  sheet(@Query() q: GradeSheetDto, @CurrentUser() u: AuthUser) { return this.service.sheet(q, u); }

  @Get('evaluations') @RequirePermissions('grade.view')
  list(@Query() q: ListEvaluationsDto, @CurrentUser() u: AuthUser) { return this.service.list(q, u); }

  @Post('evaluations') @RequirePermissions('grade.create')
  create(@Body() dto: CreateEvaluationDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.create(dto, u, m); }

  @Patch('evaluations/:id') @RequirePermissions('grade.edit')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEvaluationDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.update(id, dto, u, m); }

  @Post('evaluations/:id/void') @RequirePermissions('grade.edit')
  void(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VoidEvaluationDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.void(id, dto, u, m); }

  @Put('evaluations/:id/scores') @RequirePermissions('grade.edit')
  scores(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SaveScoresDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.saveScores(id, dto, u, m); }
}
