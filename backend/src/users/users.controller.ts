import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClientMeta, ClientMetaData, CurrentUser, RequirePermissions } from '../common/decorators';
import { AuthUser } from '../common/types/auth-user';
import { CreateUserDto, ListUsersDto, SetUserRolesDto, SetUserStatusDto, UpdateUserDto } from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('Users') @ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private service: UsersService) {}

  @Get() @RequirePermissions('user.view')
  list(@Query() q: ListUsersDto) { return this.service.list(q); }

  @Get(':id') @RequirePermissions('user.view')
  get(@Param('id', ParseUUIDPipe) id: string) { return this.service.get(id); }

  @Post() @RequirePermissions('user.create')
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: AuthUser, @ClientMeta() meta: ClientMetaData) { return this.service.create(dto, actor, meta); }

  @Patch(':id') @RequirePermissions('user.edit')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto, @CurrentUser() actor: AuthUser, @ClientMeta() meta: ClientMetaData) { return this.service.update(id, dto, actor, meta); }

  @Patch(':id/status') @RequirePermissions('user.edit')
  status(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetUserStatusDto, @CurrentUser() actor: AuthUser, @ClientMeta() meta: ClientMetaData) { return this.service.setStatus(id, dto.isActive, actor, meta); }

  @Put(':id/roles') @RequirePermissions('user.edit')
  roles(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetUserRolesDto, @CurrentUser() actor: AuthUser, @ClientMeta() meta: ClientMetaData) { return this.service.setRoles(id, dto.roleIds, actor, meta); }

  @Delete(':id') @RequirePermissions('user.delete')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: AuthUser, @ClientMeta() meta: ClientMetaData) { return this.service.remove(id, actor, meta); }
}
