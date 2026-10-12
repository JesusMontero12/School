import { Body, Controller, Get, Header, Param, ParseUUIDPipe, Patch, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ClientMeta, ClientMetaData, CurrentUser, RequirePermissions } from '../common/decorators';
import { PaginationDto } from '../common/dto/pagination.dto';
import { UploadedFileData } from '../common/storage/files.service';
import { AuthUser } from '../common/types/auth-user';
import { ListStudentsDto, UpdateStudentDto } from './dto/students.dto';
import { StudentPhotosService } from './student-photos.service';
import { StudentsService } from './students.service';

@ApiTags('Alumnos') @ApiBearerAuth()
@Controller('students')
export class StudentsController {
  constructor(private service: StudentsService, private photos: StudentPhotosService) {}

  @Get() @RequirePermissions('student.view')
  list(@Query() q: ListStudentsDto, @CurrentUser() u: AuthUser) { return this.service.list(q, u); }

  @Get(':id') @RequirePermissions('student.view')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) { return this.service.get(id, u); }

  @Patch(':id') @RequirePermissions('student.edit')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStudentDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.update(id, dto, u.id, m); }

  @Get(':id/history') @RequirePermissions('student.view')
  history(@Param('id', ParseUUIDPipe) id: string, @Query() q: PaginationDto, @CurrentUser() u: AuthUser) { return this.service.history(id, q, u); }

  /** Foto del alumno para un año/grado (JPG/PNG). Reemplaza la anterior de ese grado. */
  @Put(':id/photos/:gradeLevelId') @RequirePermissions('student.edit')
  @ApiConsumes('multipart/form-data') @UseInterceptors(FileInterceptor('file'))
  uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string, @Param('gradeLevelId', ParseUUIDPipe) gradeLevelId: string,
    @UploadedFile() file: UploadedFileData, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData,
  ) { return this.photos.saveFromProfile(id, gradeLevelId, file, u.id, m); }

  @Get(':id/photos/:gradeLevelId/file') @RequirePermissions('student.view')
  @Header('Cache-Control', 'private, no-store')
  async photoFile(@Param('id', ParseUUIDPipe) id: string, @Param('gradeLevelId', ParseUUIDPipe) gradeLevelId: string, @CurrentUser() u: AuthUser) {
    await this.service.assertVisible(id, u);
    return this.photos.stream(id, gradeLevelId);
  }
}
