import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { ClientMetaData } from '../common/decorators';
import { MailService } from '../common/mail/mail.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { SessionService } from './session.service';
import { ChangePasswordDto, LoginDto, ResetPasswordDto } from './dto/auth.dto';

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const RESET_MINUTES = 30;
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const hashPassword = (p: string) => argon2.hash(p, { type: argon2.argon2id });

@Injectable()
export class AuthService {
  // Hash señuelo: iguala el tiempo de respuesta cuando el correo no existe (evita enumeración por timing).
  private dummyHash = hashPassword(randomUUID());

  constructor(
    private prisma: PrismaService, private jwt: JwtService, private config: ConfigService,
    private session: SessionService, private audit: AuditService, private mail: MailService,
  ) {}

  get refreshTtlMs() { return Number(this.config.get('REFRESH_TTL_DAYS') ?? 7) * 86_400_000; }

  async login(dto: LoginDto, meta: ClientMetaData) {
    const user = await this.prisma.user.findFirst({ where: { email: dto.email, deletedAt: null } });
    const invalid = new UnauthorizedException('Correo o contraseña incorrectos');

    if (!user) { await argon2.verify(await this.dummyHash, dto.password).catch(() => false); throw invalid; }
    if (user.lockedUntil && user.lockedUntil > new Date())
      throw new ForbiddenException('Cuenta bloqueada temporalmente por intentos fallidos. Inténtalo más tarde.');

    const ok = await argon2.verify(user.passwordHash, dto.password).catch(() => false);
    if (!ok) {
      const attempts = user.failedAttempts + 1;
      const lock = attempts >= MAX_ATTEMPTS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts: lock ? 0 : attempts, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
      });
      await this.audit.log({ userId: user.id, action: lock ? 'auth.locked' : 'auth.login_failed', entity: 'User', entityId: user.id, ...meta });
      throw invalid;
    }
    if (!user.isActive) throw new ForbiddenException('Tu cuenta está desactivada. Contacta a administración.');

    await this.prisma.user.update({ where: { id: user.id }, data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() } });
    await this.audit.log({ userId: user.id, action: 'auth.login', entity: 'User', entityId: user.id, ...meta });
    return this.issueSession(user.id, meta, randomUUID());
  }

  /** Rota el refresh token. Si llega uno ya usado, se asume robo y se revoca toda la familia. */
  async refresh(rawToken: string | undefined, meta: ClientMetaData) {
    if (!rawToken) throw new UnauthorizedException('Sin sesión');
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
    if (!stored) throw new UnauthorizedException('Sesión inválida');

    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({ where: { familyId: stored.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.audit.log({ userId: stored.userId, action: 'auth.refresh_reuse_detected', entity: 'User', entityId: stored.userId, ...meta });
      throw new UnauthorizedException('Sesión inválida');
    }
    if (stored.expiresAt < new Date()) throw new UnauthorizedException('Sesión expirada');

    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    return this.issueSession(stored.userId, meta, stored.familyId);
  }

  async logout(rawToken: string | undefined) {
    if (rawToken) await this.prisma.refreshToken.updateMany({ where: { tokenHash: sha256(rawToken), revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async me(userId: string) {
    const user = await this.session.loadAuthUser(userId);
    if (!user) throw new UnauthorizedException();
    return user;
  }

  async changePassword(userId: string, dto: ChangePasswordDto, meta: ClientMetaData) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await argon2.verify(user.passwordHash, dto.currentPassword).catch(() => false)))
      throw new BadRequestException('La contraseña actual no es correcta');
    if (dto.currentPassword === dto.newPassword) throw new BadRequestException('La nueva contraseña debe ser distinta a la actual');

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(dto.newPassword), mustChangePassword: false } }),
      this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.log({ userId, action: 'auth.password_changed', entity: 'User', entityId: userId, ...meta });
    return { message: 'Contraseña actualizada. Vuelve a iniciar sesión.' };
  }

  /** Siempre responde igual, exista o no el correo. */
  async forgotPassword(email: string, meta: ClientMetaData) {
    const generic = { message: 'Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.' };
    const user = await this.prisma.user.findFirst({ where: { email, isActive: true, deletedAt: null } });
    if (!user) return generic;

    const raw = randomBytes(32).toString('base64url');
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000) },
    });
    const link = `${this.config.get('APP_URL')}/reset-password?token=${raw}`;
    await this.mail.send(user.email, 'Restablece tu contraseña', `Usa este enlace (vence en ${RESET_MINUTES} min): ${link}`);
    await this.audit.log({ userId: user.id, action: 'auth.password_reset_requested', entity: 'User', entityId: user.id, ...meta });
    return generic;
  }

  async resetPassword(dto: ResetPasswordDto, meta: ClientMetaData) {
    const token = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(dto.token) } });
    if (!token || token.usedAt || token.expiresAt < new Date())
      throw new BadRequestException('El enlace no es válido o ya expiró. Solicita uno nuevo.');

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: token.userId }, data: { passwordHash: await hashPassword(dto.newPassword), mustChangePassword: false, failedAttempts: 0, lockedUntil: null } }),
      this.prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
      this.prisma.refreshToken.updateMany({ where: { userId: token.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    await this.audit.log({ userId: token.userId, action: 'auth.password_reset', entity: 'User', entityId: token.userId, ...meta });
    return { message: 'Contraseña restablecida. Ya puedes iniciar sesión.' };
  }

  private async issueSession(userId: string, meta: ClientMetaData, familyId: string) {
    const user = await this.session.loadAuthUser(userId);
    if (!user) throw new UnauthorizedException();

    const accessToken = await this.jwt.signAsync({ sub: user.id }, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get('JWT_ACCESS_TTL') ?? '15m',
    });
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: { userId, familyId, tokenHash: sha256(refreshToken), expiresAt: new Date(Date.now() + this.refreshTtlMs), ip: meta.ip, userAgent: meta.userAgent },
    });
    return { accessToken, refreshToken, user };
  }
}
