// packages/api/src/auth/auth.service.ts
import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/prisma/prisma.service';
import { MailService } from '../common/mail/mail.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
    private config: ConfigService,
  ) {}

  // ── OTP ───────────────────────────────────────

  async sendOtp(email: string, purpose: 'register' | 'reset_password') {
    this.validateEmailDomain(email);

    if (purpose === 'register') {
      const exists = await this.prisma.user.findUnique({ where: { email } });
      if (exists) throw new ConflictException('Email is already registered');
    }

    const cooldown = this.config.get<number>('OTP_RESEND_COOLDOWN_SECONDS', 60);
    const recentOtp = await this.prisma.otpCode.findFirst({
      where: {
        email,
        purpose,
        used: false,
        createdAt: { gte: new Date(Date.now() - cooldown * 1000) },
      },
    });
    if (recentOtp) {
      throw new BadRequestException(`Please wait ${cooldown} seconds before trying again`);
    }

    const code = randomInt(100000, 999999).toString();
    const expirySeconds = this.config.get<number>('OTP_EXPIRY_SECONDS', 300);

    await this.prisma.otpCode.create({
      data: {
        email,
        code,
        purpose,
        expiresAt: new Date(Date.now() + expirySeconds * 1000),
      },
    });

    await this.mailService.sendOtp(email, code, purpose);
    return { message: 'Verification code sent, please check your email' };
  }

  async verifyOtp(email: string, code: string, purpose: string) {
    const otp = await this.prisma.otpCode.findFirst({
      where: {
        email,
        code,
        purpose,
        used: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) throw new BadRequestException('Invalid or expired verification code');

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { used: true },
    });

    return { verified: true };
  }

  async register(dto: {
    email: string;
    code: string;
    password: string;
    name: string;
  }) {
    this.validateEmailDomain(dto.email);

    await this.verifyOtp(dto.email, dto.code, 'register');

    const exists = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (exists) throw new ConflictException('Email is already registered');

    this.validatePassword(dto.password);

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        name: dto.name,
      },
      select: { id: true, email: true, name: true, role: true },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    return { user, ...tokens };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) throw new UnauthorizedException('Invalid email or password');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        deptId: user.deptId,
      },
      ...tokens,
    };
  }

  async resetPassword(email: string, code: string, newPassword: string) {
    await this.verifyOtp(email, code, 'reset_password');
    this.validatePassword(newPassword);

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new BadRequestException('User not found');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return { message: 'Password reset successfully, please log in again' };
  }

  // ── Token ─────────────────────────────────────

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, role: true, isActive: true },
      });

      if (!user || !user.isActive) throw new UnauthorizedException();

      return this.generateTokens(user.id, user.email, user.role);
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private validateEmailDomain(email: string) {
    const allowedDomains = this.config
      .get<string>('ALLOWED_EMAIL_DOMAINS', 'company.com')
      .split(',')
      .map((d) => d.trim());

    const domain = email.split('@')[1];
    if (!allowedDomains.includes(domain)) {
      throw new BadRequestException(
        `Only corporate email addresses are allowed (${allowedDomains.join(', ')})`,
      );
    }
  }

  private validatePassword(password: string) {
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      throw new BadRequestException('Password must contain at least 1 uppercase letter');
    }
    if (!/[0-9]/.test(password)) {
      throw new BadRequestException('Password must contain at least 1 number');
    }
  }
}
