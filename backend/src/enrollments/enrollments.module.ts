import { Module } from '@nestjs/common';
import { StorageModule } from '../common/storage/storage.module';
import { RepresentativesModule } from '../representatives/representatives.module';
import { StudentsModule } from '../students/students.module';
import { EnrollmentDocumentsService } from './enrollment-documents.service';
import { EnrollmentsController } from './enrollments.controller';
import { EnrollmentsService } from './enrollments.service';

@Module({
  imports: [StorageModule, StudentsModule, RepresentativesModule],
  controllers: [EnrollmentsController],
  providers: [EnrollmentsService, EnrollmentDocumentsService],
})
export class EnrollmentsModule {}
