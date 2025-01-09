// src/auth/auth.service.ts
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UserService } from '../user/user.service';
import { User } from '../user/user.entity';

@Injectable()
export class AuthService {
  [x: string]: any;
  constructor(
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
  ) {}

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
          user,
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
}
