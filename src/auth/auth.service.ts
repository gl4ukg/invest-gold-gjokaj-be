// src/auth/auth.service.ts
import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { validatePassword } from '../utils/password-validator';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  [x: string]: any;
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
    private readonly emailService: EmailService,
    private configService: ConfigService,
  ) {}

  private get nextPublicAppUrl() {
    return this.configService.get<string>('NEXT_PUBLIC_APP_URL');
  }

  async checkUserExists(email: string): Promise<boolean> {
    const user = await this.userService.findByEmail(email);
    return !!user;
  }

  async register(
    name: string,
    surname: string,
    email: string,
    password: string,
  ): Promise<{ token: string; user: Partial<User> }> {
    if (await this.userService.findByEmail(email)) {
      throw new ConflictException('User with this email already exists');
    }
    const hashedPassword = password
      ? await bcrypt.hash(password, 10)
      : undefined;

    const user = await this.userService.create({
      name,
      surname,
      email,
      password: hashedPassword,
    });

    const token = this.jwtService.sign({ userId: user.id });

    // Return only non-sensitive user data and the token
    return {
      token,
      user,
    };
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ token: string; user: Partial<User> }> {
    const user = await this.userService.findByEmail(email);
    if (user && user.password) {
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (isPasswordValid) {
        const token = this.jwtService.sign({
          userId: user.id,
        });

        // Return only non-sensitive user data and the token
        return {
          token,
          user: {
            id: user.id,
            name: user.name,
            surname: user.surname,
            email: user.email,
          }
        };
      }
    }
    throw new UnauthorizedException('Invalid credentials');
  }

  async getUserProfile(_user: { userId: string }): Promise<Partial<User>> {
    const id = _user.userId;
    if (typeof id !== 'string') {
      throw new ConflictException('Invalid user ID format');
    }

    const user = await this.userService.findById(id);
    if (!user) {
      throw new ConflictException('User not found');
    }
    // Return only non-sensitive user data
    return {
      id: user.id,
      name: user.name,
      surname: user.surname,
      email: user.email,
    };
  }

  async updateUser(
    user: { userId: string },
    userData: Partial<Omit<User, 'email'>>,
  ): Promise<User> {
    const id = user.userId;
    // You can add additional checks or transformations here if needed
    return this.userService.editUser(id, userData); // Call UserService to handle the update
  }

  async resetPassword(_user: { userId: string }, password: string, confirmationPassword: string): Promise<{ message: string }> {
    const id = _user.userId;
    if (typeof id !== 'string') {
      throw new ConflictException('Invalid user ID format');
    }

    const user = await this.userService.findById(id);
    if (!user) {
      throw new ConflictException('User not found');
    }
    // Validate password strength
    const { isValid, error } = validatePassword(password);
    if (!isValid) {
      throw new BadRequestException(error);
    }

    if (password !== confirmationPassword) {
      throw new ConflictException('Passwords do not match');
    }
    await this.userService.editUser(user.id, { password });
    return { message: 'Fjalekalimi u ndryshua me sukses' };
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.userService.findByEmail(email);
    if (!user) {
      // Always return a generic response for security
      return { message: 'Ky email nuk egziston' };
    }
  
    const token = this.jwtService.sign({ userId: user.id }, { expiresIn: '15m' });

    // Hash the token before storing
    const hashedToken = await bcrypt.hash(token, 10);
    await this.userService.editUser(user.id, { resetPasswordToken: hashedToken });
  
    const resetLink = `${this.nextPublicAppUrl}/sq/reset-password?token=${token}`;


    const subject = 'Ndryshim i fjalekalimin';
    const text = `Ju keni bere kerkesen per ndryshimin e fjalekalimit. Perdoreni kete link per ta ndryshuar fjalekalimin: ${resetLink}`;
    const html = `
      <p>Ju keni bere kerkesen per ndryshimin e fjalekalimit.</p>
      <p><a href="${resetLink}">Klikoni ketu per ta ndryshuar fjalekalimin</a></p>
      <p>Ky link do te skadoje per 15 minuta.</p>
    `;
  
    await this.emailService.sendEmail(user.email, subject, text, html);
  
    return { message: 'Linku per ndryshimin e fjalekalimit eshte derguar ne email.' };
  }
  

  async resetPasswordWithToken(token: string, password: string, confirmationPassword: string): Promise<{ message: string }> {
    console.log('Received reset password request with token:', { token: token.substring(0, 20) + '...' });
    
    // Validate password strength
    const { isValid, error } = validatePassword(password);
    if (!isValid) {
      throw new BadRequestException(error);
    }

    if (password !== confirmationPassword) {
      console.log('Password mismatch error');
      throw new ConflictException('Fjalekalimi nuk eshte i njejte');
    }

    let payload: { userId: string };
    try {
      payload = this.jwtService.verify(token);
      console.log('Token verified successfully, userId:', payload.userId);
    } catch (err) {
      console.error('Token verification failed:', err.message);
      throw new UnauthorizedException('Ky link ka skaduar');
    }

    const user = await this.userService.findById(payload.userId);
    console.log('User found:', { userId: payload.userId, hasResetToken: !!user?.resetPasswordToken });
    
    if (!user || !user.resetPasswordToken) {
      console.log('Invalid reset attempt - user not found or no reset token');
      throw new UnauthorizedException('Ky link ka skaduar');
    }

    // Verify the token against the stored hash
    const isTokenValid = await bcrypt.compare(token, user.resetPasswordToken);
    console.log('Token validation result:', isTokenValid);
    
    if (!isTokenValid) {
      console.log('Invalid reset token - bcrypt verification failed');
      throw new UnauthorizedException('Ky link ka skaduar');
    }

    console.log('Proceeding with password reset for user:', user.id);
    await this.userService.editUser(user.id, {
      password: password,
      resetPasswordToken: null,
    });
    return { message: 'Fjalekalimi u ndryshua me sukses' };
  }
  
}
