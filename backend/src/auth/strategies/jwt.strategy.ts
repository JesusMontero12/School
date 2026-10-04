import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../../common/types/auth-user';
import { SessionService } from '../session.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private session: SessionService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  /**
   * Roles y permisos se leen de la BD en cada request: desactivar a un usuario o
   * quitarle un permiso tiene efecto inmediato, sin esperar a que expire el token.
   */
  async validate(payload: { sub: string }): Promise<AuthUser> {
    const user = await this.session.loadAuthUser(payload.sub);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
