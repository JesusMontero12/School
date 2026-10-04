import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { JwtAuthGuard, PermissionsGuard, RolesGuard } from './common/guards/guards';
import { MailModule } from './common/mail/mail.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { PermissionsModule } from './permissions/permissions.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';

const REQUIRED_ENV = ['DATABASE_URL', 'JWT_ACCESS_SECRET'];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => {
        const missing = REQUIRED_ENV.filter((k) => !env[k]);
        if (missing.length) throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
        if (env.NODE_ENV === 'production' && String(env.JWT_ACCESS_SECRET).length < 32)
          throw new Error('JWT_ACCESS_SECRET debe tener al menos 32 caracteres en producción');
        return env;
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule, MailModule, AuditModule,
    AuthModule, UsersModule, RolesModule, PermissionsModule,
    // Próximos módulos: StudentsModule, TeachersModule, EnrollmentsModule, GradesModule, ...
  ],
  providers: [
    // El orden importa: límite de peticiones → autenticación → roles → permisos
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: PrismaExceptionFilter },
  ],
})
export class AppModule {}
