import { Module } from '@nestjs/common';
import { StorageModule } from '../common/storage/storage.module';
import { RepresentativesController } from './representatives.controller';
import { RepresentativesService } from './representatives.service';

@Module({
  imports: [StorageModule],
  controllers: [RepresentativesController],
  providers: [RepresentativesService],
  exports: [RepresentativesService],
})
export class RepresentativesModule {}
