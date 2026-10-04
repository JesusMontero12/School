import { Injectable, Logger } from '@nestjs/common';

/** Punto único de salida de correos. Reemplazar por SMTP/SES/Resend en producción. */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  async send(to: string, subject: string, body: string) {
    this.logger.log(`[MAIL → ${to}] ${subject}\n${body}`);
  }
}
