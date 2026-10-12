/** Tipos de archivo aceptados. Se detectan por el CONTENIDO (firma), no por la extensión ni el mimetype declarado. */
export interface DetectedFileType {
  mime: 'image/jpeg' | 'image/png' | 'application/pdf';
  ext: 'jpg' | 'png' | 'pdf';
}

const startsWith = (buf: Buffer, bytes: number[]) => buf.length >= bytes.length && bytes.every((b, i) => buf[i] === b);

export function detectFileType(buf: Buffer): DetectedFileType | null {
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: 'jpg' };
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: 'image/png', ext: 'png' };
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: 'application/pdf', ext: 'pdf' }; // "%PDF-"
  return null;
}

/** 'image' → fotos (JPG/PNG). 'document' → requisitos escaneados (JPG/PNG/PDF). */
export type FileKind = 'image' | 'document';

export const ALLOWED_MIMES: Record<FileKind, DetectedFileType['mime'][]> = {
  image: ['image/jpeg', 'image/png'],
  document: ['image/jpeg', 'image/png', 'application/pdf'],
};

/** Nombre original seguro para mostrar/descargar: sin rutas, sin caracteres de control, máx. 120. */
export function safeFileName(name: string | undefined): string {
  const base = (name ?? 'archivo').split(/[\\/]/).pop() ?? 'archivo';
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\u007f"<>|:*?]/g, '').trim();
  return (cleaned || 'archivo').slice(0, 120);
}
