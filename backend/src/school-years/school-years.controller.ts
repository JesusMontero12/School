import { Body, Controller, Get, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClientMeta, ClientMetaData, CurrentUser, RequirePermissions } from '../common/decorators';
import { AuthUser } from '../common/types/auth-user';
import {
  ChangeSchoolYearStatusDto, ChangeTermStatusDto, CreateSchoolYearDto, ListSchoolYearsDto, UpdateSchoolYearDto,
} from './dto/school-years.dto';
import { SchoolYearsService } from './school-years.service';

@ApiTags('Años escolares') @ApiBearerAuth()
@Controller('school-years')
export class SchoolYearsController {
  constructor(private service: SchoolYearsService) {}

  @Get() @RequirePermissions('school_year.view')
  list(@Query() q: ListSchoolYearsDto) { return this.service.list(q); }

  /** Lista liviana para selects. Debe ir antes de ':id'. */
  @Get('options') @RequirePermissions('school_year.view')
  options() { return this.service.options(); }

  @Get(':id') @RequirePermissions('school_year.view')
  get(@Param('id', ParseUUIDPipe) id: string) { return this.service.get(id); }

  @Post() @RequirePermissions('school_year.create')
  create(@Body() dto: CreateSchoolYearDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.create(dto, u.id, m); }

  @Patch(':id') @RequirePermissions('school_year.edit')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSchoolYearDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.update(id, dto, u.id, m); }

  @Patch(':id/status') @RequirePermissions('school_year.edit')
  changeStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeSchoolYearStatusDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.changeStatus(id, dto, u.id, m); }

  @Patch(':id/terms/:number/status') @RequirePermissions('school_year.edit')
  changeTermStatus(
    @Param('id', ParseUUIDPipe) id: string, @Param('number', ParseIntPipe) number: number,
    @Body() dto: ChangeTermStatusDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData,
  ) { return this.service.changeTermStatus(id, number, dto, u.id, m); }
}
