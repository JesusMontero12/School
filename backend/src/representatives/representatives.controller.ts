import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ClientMeta, ClientMetaData, CurrentUser, RequirePermissions } from '../common/decorators';
import { UploadedFileData } from '../common/storage/files.service';
import { AuthUser } from '../common/types/auth-user';
import { ListRepresentativesDto, UpdateRepresentativeDto } from './dto/representatives.dto';
import { RepresentativesService } from './representatives.service';

@ApiTags('Representantes') @ApiBearerAuth()
@Controller('representatives')
export class RepresentativesController {
  constructor(private service: RepresentativesService) {}

  @Get() @RequirePermissions('representative.view')
  list(@Query() q: ListRepresentativesDto, @CurrentUser() u: AuthUser) { return this.service.list(q, u); }

  @Get(':id') @RequirePermissions('representative.view')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) { return this.service.get(id, u); }

  @Patch(':id') @RequirePermissions('representative.edit')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRepresentativeDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.update(id, dto, u.id, m); }

  @Put(':id/photo') @RequirePermissions('representative.edit')
  @ApiConsumes('multipart/form-data') @UseInterceptors(FileInterceptor('file'))
  uploadPhoto(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: UploadedFileData, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) {
    return this.service.savePhoto(id, file, u.id, m);
  }

  @Get(':id/photo') @RequirePermissions('representative.view')
  @Header('Cache-Control', 'private, no-store')
  photo(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) { return this.service.photo(id, u); }
}
