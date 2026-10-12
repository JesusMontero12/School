import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { DEFAULT_MAX_UPLOAD_BYTES, FilesService } from './files.service';
import { FileStorage } from './file-storage';
import { LocalFileStorage } from './local-file-storage';

/**
 * Subida y entrega de archivos. Para cambiar de proveedor (S3, etc.) se reemplaza
 * `useClass: LocalFileStorage`; ningún módulo de negocio necesita cambios.
 * Los módulos con endpoints de subida importan este módulo (reexporta MulterModule con el límite configurado).
 */
@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // Memoria (sin carpeta temporal): el contenido se valida antes de escribirse a disco.
        limits: { fileSize: Number(config.get('UPLOAD_MAX_BYTES') ?? DEFAULT_MAX_UPLOAD_BYTES), files: 1 },
      }),
    }),
  ],
  providers: [{ provide: FileStorage, useClass: LocalFileStorage }, FilesService],
  exports: [FilesService, MulterModule],
})
export class StorageModule {}
