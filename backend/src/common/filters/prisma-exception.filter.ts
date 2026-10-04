import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

/** Traduce errores conocidos de Prisma a respuestas HTTP claras. */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(e: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const map: Record<string, [number, string]> = {
      P2002: [HttpStatus.CONFLICT, 'Ya existe un registro con esos datos'],
      P2025: [HttpStatus.NOT_FOUND, 'Registro no encontrado'],
      P2003: [HttpStatus.CONFLICT, 'El registro está en uso por otros datos'],
    };
    const [status, message] = map[e.code] ?? [HttpStatus.INTERNAL_SERVER_ERROR, 'Error de base de datos'];
    res.status(status).json({ statusCode: status, message, error: e.code });
  }
}
