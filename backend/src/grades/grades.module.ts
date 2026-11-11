import { Module } from '@nestjs/common';
import { TeachingAssignmentsModule } from '../teaching-assignments/teaching-assignments.module';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';
import { ReportCardsController } from './report-cards.controller';
import { ReportCardsService } from './report-cards.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ResultsService } from './results.service';

@Module({
  imports: [TeachingAssignmentsModule],
  controllers: [EvaluationsController, ReportCardsController, ReportsController],
  providers: [EvaluationsService, ResultsService, ReportCardsService, ReportsService],
  exports: [ResultsService],
})
export class GradesModule {}
