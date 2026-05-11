// packages/api/src/auth/auth.dto.ts
import { IsEmail, IsString, IsIn, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({ example: 'zhangsan@company.com' })
  @IsEmail({}, { message: 'Please enter a valid email address' })
  email: string;

  @ApiProperty({ enum: ['register', 'reset_password'] })
  @IsIn(['register', 'reset_password'])
  purpose: 'register' | 'reset_password';
}

export class VerifyOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code: string;

  @IsString()
  purpose: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'zhangsan@company.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code: string;

  @ApiProperty({ example: 'Password@123' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password: string;

  @ApiProperty({ example: 'John Smith' })
  @IsString()
  @MinLength(2)
  @MaxLength(20)
  name: string;
}

export class LoginDto {
  @ApiProperty({ example: 'zhangsan@company.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Password@123' })
  @IsString()
  password: string;
}

export class ResetPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(6)
  code: string;

  @IsString()
  @MinLength(8)
  @MaxLength(64)
  newPassword: string;
}
