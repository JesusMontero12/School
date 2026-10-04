/** Extrae un mensaje legible de un error de Axios/NestJS. */
export function getErrorMessage(error, fallback = 'Ocurrió un error inesperado. Inténtalo de nuevo.') {
  if (!error?.response) return error?.code === 'ERR_NETWORK' ? 'No hay conexión con el servidor.' : fallback;
  const msg = error.response.data?.message;
  return Array.isArray(msg) ? msg[0] : msg || fallback;
}
