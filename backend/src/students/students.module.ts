import { Module } from '@nestjs/common';
import { StorageModule } from '../common/storage/storage.module';
import { StudentPhotosService } from './student-photos.service';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [StorageModule],
  controllers: [StudentsController],
  providers: [StudentsService, StudentPhotosService],
  exports: [StudentPhotosService],
})
export class StudentsModule {}
