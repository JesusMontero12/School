import { api } from './api';

/** Sube un archivo (campo "file") como multipart. El navegador pone el boundary. */
export const uploadFile = (url, file, method = 'put') => {
  const body = new FormData();
  body.append('file', file);
  return api.request({ url, method, data: body, headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
};

/** Los archivos son privados: se piden con el token y se abren como blob. */
export async function openProtected(url) {
  const tab = window.open('', '_blank'); // se abre antes del await para que el navegador no lo bloquee
  try {
    const { data } = await api.get(url, { responseType: 'blob' });
    const objectUrl = URL.createObjectURL(data);
    if (tab) tab.location.href = objectUrl; else window.open(objectUrl, '_blank');
    setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
  } catch (e) {
    tab?.close();
    throw e;
  }
}
