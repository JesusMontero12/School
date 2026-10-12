import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClientMeta, ClientMetaData, CurrentUser, RequirePermissions } from '../common/decorators';
import { AuthUser } from '../common/types/auth-user';
import { CreateRequirementTypeDto, UpdateRequirementTypeDto } from './dto/requirement-types.dto';
import { RequirementTypesService } from './requirement-types.service';

@ApiTags('Requisitos de inscripción') @ApiBearerAuth()
@Controller('requirement-types')
export class RequirementTypesController {
  constructor(private service: RequirementTypesService) {}

  @Get() @RequirePermissions('requirement_type.view')
  list(@Query('active') active?: string) { return this.service.list(active === 'true'); }

  @Post() @RequirePermissions('requirement_type.create')
  create(@Body() dto: CreateRequirementTypeDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.create(dto, u.id, m); }

  @Patch(':id') @RequirePermissions('requirement_type.edit')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRequirementTypeDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.update(id, dto, u.id, m); }
}
