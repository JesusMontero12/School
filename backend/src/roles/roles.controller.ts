import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClientMeta, ClientMetaData, CurrentUser, RequirePermissions } from '../common/decorators';
import { AuthUser } from '../common/types/auth-user';
import { CreateRoleDto, SetRolePermissionsDto, UpdateRoleDto } from './dto/roles.dto';
import { RolesService } from './roles.service';

@ApiTags('Roles') @ApiBearerAuth()
@Controller('roles')
export class RolesController {
  constructor(private service: RolesService) {}

  @Get() @RequirePermissions('role.view')
  list() { return this.service.list(); }

  /** Lista liviana para selects (formulario y filtros de usuarios). Debe ir antes de ':id'. */
  @Get('options') @RequirePermissions('user.view')
  options() { return this.service.options(); }

  @Get(':id') @RequirePermissions('role.view')
  get(@Param('id', ParseUUIDPipe) id: string) { return this.service.get(id); }

  @Post() @RequirePermissions('role.create')
  create(@Body() dto: CreateRoleDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.create(dto, u.id, m); }

  @Patch(':id') @RequirePermissions('role.edit')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.update(id, dto, u.id, m); }

  @Put(':id/permissions') @RequirePermissions('role.edit')
  setPermissions(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetRolePermissionsDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.setPermissions(id, dto.permissionIds, u.id, m); }

  @Delete(':id') @RequirePermissions('role.delete')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.remove(id, u.id, m); }
}
