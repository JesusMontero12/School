import { Module } from '@nestjs/common';
import { RequirementTypesController } from './requirement-types.controller';
import { RequirementTypesService } from './requirement-types.service';

@Module({ controllers: [RequirementTypesController], providers: [RequirementTypesService], exports: [RequirementTypesService] })
export class RequirementTypesModule {}
