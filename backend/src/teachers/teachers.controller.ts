import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClientMeta, ClientMetaData, CurrentUser, RequirePermissions } from '../common/decorators';
import { AuthUser } from '../common/types/auth-user';
import { CreateTeacherDto, ListTeachersDto, UpdateTeacherDto } from './dto/teachers.dto';
import { TeachersService } from './teachers.service';

@ApiTags('Docentes') @ApiBearerAuth()
@Controller('teachers')
export class TeachersController {
  constructor(private service: TeachersService) {}

  @Get() @RequirePermissions('teacher.view')
  list(@Query() q: ListTeachersDto) { return this.service.list(q); }

  @Get('options') @RequirePermissions('teacher.view')
  options() { return this.service.options(); }

  @Get('user-options') @RequirePermissions('teacher.edit')
  userOptions(@Query('includeUserId') includeUserId?: string) { return this.service.userOptions(includeUserId); }

  @Get(':id') @RequirePermissions('teacher.view')
  get(@Param('id', ParseUUIDPipe) id: string) { return this.service.get(id); }

  @Post() @RequirePermissions('teacher.create')
  create(@Body() dto: CreateTeacherDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.create(dto, u.id, m); }

  @Patch(':id') @RequirePermissions('teacher.edit')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTeacherDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.update(id, dto, u.id, m); }
}
