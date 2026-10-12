import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClientMeta, ClientMetaData, CurrentUser, RequirePermissions } from '../common/decorators';
import { AuthUser } from '../common/types/auth-user';
import { CreateSectionDto, ListSectionsDto, UpdateSectionDto } from './dto/sections.dto';
import { SectionsService } from './sections.service';

@ApiTags('Secciones') @ApiBearerAuth()
@Controller('sections')
export class SectionsController {
  constructor(private service: SectionsService) {}

  @Get() @RequirePermissions('section.view')
  list(@Query() q: ListSectionsDto) { return this.service.list(q); }

  @Get(':id') @RequirePermissions('section.view')
  get(@Param('id', ParseUUIDPipe) id: string, @Query('schoolYearId') schoolYearId?: string) { return this.service.get(id, schoolYearId); }

  @Post() @RequirePermissions('section.create')
  create(@Body() dto: CreateSectionDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.create(dto, u.id, m); }

  @Patch(':id') @RequirePermissions('section.edit')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSectionDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.update(id, dto, u.id, m); }

  @Delete(':id') @RequirePermissions('section.delete')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.remove(id, u.id, m); }
}
