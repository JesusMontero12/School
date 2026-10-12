import { Readable } from 'stream';

/**
 * Contrato de almacenamiento. La lógica de negocio solo conoce esto (vía FilesService):
 * para migrar a S3 u otro proveedor basta con otra implementación registrada en StorageModule.
 * Las claves las genera el servidor; nunca se construyen con texto del usuario.
 */
export abstract class FileStorage {
  /** Guarda el contenido bajo la clave. Falla si la clave ya existe (no se sobrescribe). */
  abstract put(key: string, data: Buffer): Promise<void>;
  /** Devuelve el contenido como stream. Lanza un error con code 'ENOENT' si no existe. */
  abstract read(key: string): Promise<Readable>;
  /** Elimina el archivo. Es idempotente: si no existe, no falla. */
  abstract remove(key: string): Promise<void>;
}
