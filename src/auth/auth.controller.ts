import { Controller, Post, Body, Put, UseGuards, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { User } from '../user/user.entity'; // Ensure this import is correct
import { User as UserDecorator } from '../user/user.decorator'; // If you're using a custom decorator for extracting user info

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
}
