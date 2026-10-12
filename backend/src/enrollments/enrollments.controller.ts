import {
  Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Patch, Post, Put, Query, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ClientMeta, ClientMetaData, CurrentUser, RequirePermissions } from '../common/decorators';
import { UploadedFileData } from '../common/storage/files.service';
import { AuthUser } from '../common/types/auth-user';
import {
  ChangeEnrollmentStatusDto, CreateEnrollmentDto, ListEnrollmentsDto, LookupDto, SetEnrollmentRepresentativesDto, UpdateDocumentDto, UpdateEnrollmentDto,
} from './dto/enrollments.dto';
import { EnrollmentDocumentsService } from './enrollment-documents.service';
import { EnrollmentsService } from './enrollments.service';

const upload = () => UseInterceptors(FileInterceptor('file'));

@ApiTags('Inscripciones') @ApiBearerAuth()
@Controller('enrollments')
export class EnrollmentsController {
  constructor(private service: EnrollmentsService, private docs: EnrollmentDocumentsService) {}

  @Get() @RequirePermissions('enrollment.view')
  list(@Query() q: ListEnrollmentsDto, @CurrentUser() u: AuthUser) { return this.service.list(q, u); }

  // Búsquedas del asistente de inscripción. Deben ir antes de ':id'.
  @Get('lookup/students') @RequirePermissions('enrollment.create')
  lookupStudents(@Query() q: LookupDto) { return this.service.lookupStudents(q); }

  @Get('lookup/representatives') @RequirePermissions('enrollment.create')
  lookupRepresentatives(@Query() q: LookupDto) { return this.service.lookupRepresentatives(q); }

  @Get(':id') @RequirePermissions('enrollment.view')
  get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: AuthUser) { return this.service.get(id, u); }

  /** Flujo central: crea (o reutiliza) alumno y representantes, y registra la inscripción en una sola operación. */
  @Post() @RequirePermissions('enrollment.create')
  create(@Body() dto: CreateEnrollmentDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.create(dto, u, m); }

  @Patch(':id') @RequirePermissions('enrollment.edit')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateEnrollmentDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.update(id, dto, u, m); }

  @Patch(':id/status') @RequirePermissions('enrollment.edit')
  changeStatus(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ChangeEnrollmentStatusDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.changeStatus(id, dto, u, m); }

  @Put(':id/representatives') @RequirePermissions('enrollment.edit')
  setRepresentatives(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetEnrollmentRepresentativesDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) { return this.service.setRepresentatives(id, dto, u, m); }

  // ───────── documentos ─────────

  @Patch(':id/documents/:requirementTypeId') @RequirePermissions('enrollment.edit')
  updateDocument(
    @Param('id', ParseUUIDPipe) id: string, @Param('requirementTypeId', ParseUUIDPipe) typeId: string,
    @Body() dto: UpdateDocumentDto, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData,
  ) { return this.docs.update(id, typeId, dto, u, m); }

  @Put(':id/documents/:requirementTypeId/file') @RequirePermissions('enrollment.edit')
  @ApiConsumes('multipart/form-data') @upload()
  uploadDocumentFile(
    @Param('id', ParseUUIDPipe) id: string, @Param('requirementTypeId', ParseUUIDPipe) typeId: string,
    @UploadedFile() file: UploadedFileData, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData,
  ) { return this.docs.uploadFile(id, typeId, file, u, m); }

  @Get(':id/documents/:requirementTypeId/file') @RequirePermissions('enrollment.view')
  @Header('Cache-Control', 'private, no-store')
  documentFile(@Param('id', ParseUUIDPipe) id: string, @Param('requirementTypeId', ParseUUIDPipe) typeId: string, @CurrentUser() u: AuthUser) {
    return this.docs.streamFile(id, typeId, u);
  }

  @Delete(':id/documents/:requirementTypeId/file') @RequirePermissions('enrollment.edit')
  removeDocumentFile(
    @Param('id', ParseUUIDPipe) id: string, @Param('requirementTypeId', ParseUUIDPipe) typeId: string,
    @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData,
  ) { return this.docs.removeFile(id, typeId, u, m); }

  // ───────── fotos capturadas al inscribir ─────────

  @Put(':id/student-photo') @RequirePermissions('enrollment.edit')
  @ApiConsumes('multipart/form-data') @upload()
  studentPhoto(@Param('id', ParseUUIDPipe) id: string, @UploadedFile() file: UploadedFileData, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData) {
    return this.docs.uploadStudentPhoto(id, file, u, m);
  }

  @Put(':id/representatives/:representativeId/photo') @RequirePermissions('enrollment.edit')
  @ApiConsumes('multipart/form-data') @upload()
  representativePhoto(
    @Param('id', ParseUUIDPipe) id: string, @Param('representativeId', ParseUUIDPipe) representativeId: string,
    @UploadedFile() file: UploadedFileData, @CurrentUser() u: AuthUser, @ClientMeta() m: ClientMetaData,
  ) { return this.docs.uploadRepresentativePhoto(id, representativeId, file, u, m); }
}
