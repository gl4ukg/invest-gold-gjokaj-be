import { Controller, Post, Body, Put, UseGuards, Get, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { User } from '../user/user.entity'; // Ensure this import is correct
import { User as UserDecorator } from '../user/user.decorator'; // If you're using a custom decorator for extracting user info
import { UserService } from '../user/user.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly userService: UserService  ) {}

  @Post('register')
  async register(
    @Body()
    userData,
  ) {
    const { name, surname, email, password } = userData;
    return this.authService.register(name, surname, email, password);
  }

  @Post('login')
  async login(
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    return this.authService.login(email, password);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Body() userData: Partial<Omit<User, 'email'>>, // Exclude fields that should not be updated
    @UserDecorator('userId') user: { userId: string }, // Make sure this decorator extracts the user ID correctly
  ) {
    return this.authService.updateUser(user, userData);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard) // Protect this route with the JWT guard
  async getProfile(
    @UserDecorator('userId') user: { userId: string },
  ): Promise<Partial<User>> { 
    return this.authService.getUserProfile(user); // Call a service method to get user profile
  }

  @Post('reset-password')
  @UseGuards(JwtAuthGuard)
  async resetPassword(
    @UserDecorator('userId') user: { userId: string },
    @Body('password') password: string,
    @Body('confirmationPassword') confirmationPassword: string,
  ) {
    return this.authService.resetPassword(user, password, confirmationPassword);
  }

  @Get('find-user-by-email')
  async getEmail(
    @Query('email') email: string,
  ) {
    return this.userService.findByEmail(email);
  }

  @Post('forgot-password')
  async forgotPassword(
    @Body('email') email: string,
  ) {
    return this.authService.forgotPassword(email);
  }

  @Post('reset-password-with-token')
  async resetPasswordWithToken(
    @Body('token') token: string,
    @Body('password') password: string,
    @Body('confirmationPassword') confirmationPassword: string,
  ) {
    console.log('Reset password endpoint hit with body:', {
      tokenLength: token?.length,
      hasPassword: !!password,
      hasConfirmationPassword: !!confirmationPassword
    });
    return this.authService.resetPasswordWithToken(token, password, confirmationPassword);
  }
}
