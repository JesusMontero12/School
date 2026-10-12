import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, promises as fs } from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { FileStorage } from './file-storage';

/**
 * Almacenamiento en disco local (UPLOAD_DIR, por defecto ./uploads).
 * Los archivos NO se sirven de forma estática: solo se entregan por endpoints autenticados y autorizados.
 */
@Injectable()
export class LocalFileStorage extends FileStorage {
  private readonly root: string;

  constructor(config: ConfigService) {
    super();
    this.root = path.resolve(process.cwd(), config.get<string>('UPLOAD_DIR') ?? 'uploads');
  }

  /** Defensa extra: la ruta resuelta siempre debe quedar dentro de la carpeta de uploads. */
  private resolve(key: string) {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(this.root + path.sep)) throw new Error('Clave de archivo inválida');
    return full;
  }

  async put(key: string, data: Buffer) {
    const file = this.resolve(key);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, data, { flag: 'wx', mode: 0o640 });
  }

  async read(key: string): Promise<Readable> {
    const file = this.resolve(key);
    await fs.access(file); // lanza ENOENT antes de abrir el stream
    return createReadStream(file);
  }

  async remove(key: string) {
    try {
      await fs.unlink(this.resolve(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
