import { Module } from '@nestjs/common';
import { SchoolYearsController } from './school-years.controller';
import { SchoolYearsRepository } from './school-years.repository';
import { SchoolYearsService } from './school-years.service';

@Module({ controllers: [SchoolYearsController], providers: [SchoolYearsService, SchoolYearsRepository], exports: [SchoolYearsService] })
export class SchoolYearsModule {}
