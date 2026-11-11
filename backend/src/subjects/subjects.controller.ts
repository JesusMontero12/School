import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClientMeta, ClientMetaData, CurrentUser, RequirePermissions } from '../common/decorators';
import { AuthUser } from '../common/types/auth-user';
import { CreateSubjectDto, ListSubjectsDto, SetTermSettingDto, UpdateSubjectDto } from './dto/subjects.dto';
import { SubjectsService } from './subjects.service';

@ApiTags('Materias') @ApiBearerAuth()
@Controller('subjects')
export class SubjectsController {
  constructor(private service: SubjectsService) {}

  @Get() @RequirePermissions('subject.view')
  list(@Query() q: ListSubjectsDto) { return this.service.list(q); }

  @Get('options') @RequirePermissions('subject.view')
  options() { return this.service.options(); }

  /** Matriz materia × momento con la configuración de la prueba de lapso. */
  @Get('term-settings') @RequirePermissions('subject.view')
  termSettings(@Query('schoolYearId', ParseUUIDPipe) schoolYearId: string) { return this.service.termSettings(schoolYearId); }

  @Put(':subjectId/term-settings/:termId') @RequirePermissions('subject.edit')
  setTermSetting(
    @Param('subjectId', ParseUUIDPipe) subjectId: string, @Param('termId', ParseUUIDPipe) termId: string,
    @Body() dto: SetTermSettingDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData,
  ) { return this.service.setTermSetting(subjectId, termId, dto, u.id, m); }

  @Get(':id') @RequirePermissions('subject.view')
  get(@Param('id', ParseUUIDPipe) id: string) { return this.service.get(id); }

  @Post() @RequirePermissions('subject.create')
  create(@Body() dto: CreateSubjectDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.create(dto, u.id, m); }

  @Patch(':id') @RequirePermissions('subject.edit')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSubjectDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.update(id, dto, u.id, m); }
}
