import { Module } from '@nestjs/common';
import { TeachingAccessService } from './teaching-access.service';
import { TeachingAssignmentsController } from './teaching-assignments.controller';
import { TeachingAssignmentsService } from './teaching-assignments.service';

@Module({
  controllers: [TeachingAssignmentsController],
  providers: [TeachingAssignmentsService, TeachingAccessService],
  exports: [TeachingAccessService],
})
export class TeachingAssignmentsModule {}
