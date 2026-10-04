import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RequirePermissions } from '../common/decorators';
import { PermissionsService } from './permissions.service';

@ApiTags('Permissions') @ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(private service: PermissionsService) {}
  @Get() @RequirePermissions('permission.view')
  list() { return this.service.listGrouped(); }
}
