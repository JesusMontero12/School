import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClientMeta, ClientMetaData, CurrentUser, RequirePermissions } from '../common/decorators';
import { AuthUser } from '../common/types/auth-user';
import { UpdateGradeLevelDto } from './dto/grade-levels.dto';
import { GradeLevelsService } from './grade-levels.service';

@ApiTags('Años / grados') @ApiBearerAuth()
@Controller('grade-levels')
export class GradeLevelsController {
  constructor(private service: GradeLevelsService) {}

  @Get() @RequirePermissions('grade_level.view')
  list() { return this.service.list(); }

  @Patch(':id') @RequirePermissions('grade_level.edit')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGradeLevelDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.update(id, dto, u.id, m); }
}
