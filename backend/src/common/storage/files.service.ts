import {
  BadRequestException, Injectable, Logger, NotFoundException, PayloadTooLargeException, StreamableFile, UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { FileStorage } from './file-storage';
import { ALLOWED_MIMES, detectFileType, FileKind, safeFileName } from './file-types';

/** Forma mínima del archivo que entrega multer (memoria). Se declara aquí para no depender de @types/multer. */
export interface UploadedFileData {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface SavedFile {
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
}

export const DEFAULT_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(private storage: FileStorage, private config: ConfigService) {}

  /** Límite configurable con UPLOAD_MAX_BYTES (por defecto 5 MB). */
  get maxBytes() {
    return Number(this.config.get('UPLOAD_MAX_BYTES') ?? DEFAULT_MAX_UPLOAD_BYTES);
  }

  /**
   * Valida (tamaño y contenido real) y guarda el archivo bajo `prefix/uuid.ext`.
   * El tipo se decide por la firma del contenido: un .exe renombrado a .jpg se rechaza.
   */
  async save(file: UploadedFileData | undefined, prefix: string, kind: FileKind): Promise<SavedFile> {
    if (!file?.buffer?.length) throw new BadRequestException('Adjunta un archivo en el campo "file"');
    if (file.buffer.length > this.maxBytes) {
      throw new PayloadTooLargeException(`El archivo supera el máximo permitido de ${Math.floor(this.maxBytes / 1024 / 1024)} MB`);
    }
    const type = detectFileType(file.buffer);
    if (!type || !ALLOWED_MIMES[kind].includes(type.mime)) {
      throw new UnsupportedMediaTypeException(kind === 'image' ? 'Solo se aceptan imágenes JPG o PNG' : 'Solo se aceptan archivos JPG, PNG o PDF');
    }
    const storageKey = `${prefix}/${randomUUID()}.${type.ext}`;
    await this.storage.put(storageKey, file.buffer);
    return { storageKey, mimeType: type.mime, sizeBytes: file.buffer.length, originalName: safeFileName(file.originalname) };
  }

  /** Borra un archivo sin interrumpir la operación principal si falla (queda registrado en el log). */
  async remove(key: string | null | undefined) {
    if (!key) return;
    try {
      await this.storage.remove(key);
    } catch (error) {
      this.logger.error(`No se pudo eliminar el archivo ${key}`, error as Error);
    }
  }

  /** Entrega el archivo como stream, con el tipo guardado y nombre de descarga seguro. */
  async stream(key: string, mimeType: string, originalName?: string | null): Promise<StreamableFile> {
    try {
      const stream = await this.storage.read(key);
      const name = encodeURIComponent(safeFileName(originalName ?? undefined));
      return new StreamableFile(stream, { type: mimeType, disposition: `inline; filename*=UTF-8''${name}` });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new NotFoundException('El archivo no se encuentra en el almacenamiento');
      throw error;
    }
  }
}
