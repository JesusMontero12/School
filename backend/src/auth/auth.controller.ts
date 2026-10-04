import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CookieOptions, Request, Response } from 'express';
import { ClientMeta, ClientMetaData, CurrentUser, Public } from '../common/decorators';
import { AuthUser } from '../common/types/auth-user';
import { AuthService } from './auth.service';
import { ChangePasswordDto, ForgotPasswordDto, LoginDto, ResetPasswordDto } from './dto/auth.dto';

const COOKIE = 'refresh_token';
const strict = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private config: ConfigService) {}

  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: this.config.get('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: '/api/v1/auth', // el navegador solo envía la cookie a estos endpoints
      maxAge: this.auth.refreshTtlMs,
    };
  }
  private setSession(res: Response, s: { accessToken: string; refreshToken: string; user: AuthUser }) {
    res.cookie(COOKIE, s.refreshToken, this.cookieOptions());
    return { accessToken: s.accessToken, user: s.user };
  }
  private clearCookie(res: Response) {
    const { maxAge, ...opts } = this.cookieOptions();
    res.clearCookie(COOKIE, opts);
  }

  @Public() @Throttle(strict) @HttpCode(200) @Post('login')
  async login(@Body() dto: LoginDto, @ClientMeta() meta: ClientMetaData, @Res({ passthrough: true }) res: Response) {
    return this.setSession(res, await this.auth.login(dto, meta));
  }

  @Public() @Throttle({ default: { limit: 30, ttl: 60_000 } }) @HttpCode(200) @Post('refresh')
  async refresh(@Req() req: Request, @ClientMeta() meta: ClientMetaData, @Res({ passthrough: true }) res: Response) {
    try { return this.setSession(res, await this.auth.refresh(req.cookies?.[COOKIE], meta)); }
    catch (e) { this.clearCookie(res); throw e; }
  }

  @Public() @HttpCode(200) @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[COOKIE]);
    this.clearCookie(res);
    return { message: 'Sesión cerrada' };
  }

  @ApiBearerAuth() @Get('me')
  me(@CurrentUser() user: AuthUser) { return this.auth.me(user.id); }

  @ApiBearerAuth() @Throttle(strict) @HttpCode(200) @Post('change-password')
  async changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto, @ClientMeta() meta: ClientMetaData, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.changePassword(user.id, dto, meta);
    this.clearCookie(res);
    return result;
  }

  @Public() @Throttle(strict) @HttpCode(200) @Post('forgot-password')
  forgot(@Body() dto: ForgotPasswordDto, @ClientMeta() meta: ClientMetaData) { return this.auth.forgotPassword(dto.email, meta); }

  @Public() @Throttle(strict) @HttpCode(200) @Post('reset-password')
  reset(@Body() dto: ResetPasswordDto, @ClientMeta() meta: ClientMetaData) { return this.auth.resetPassword(dto, meta); }
}
