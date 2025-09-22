import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../auth/auth.service';

async function createAdmin() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userService = app.get(UserService);
  const authService = app.get(AuthService);

  const email = 'admin2@test.com'; // Admin email
  const existingAdmin = await userService.findByEmail(email);

  if (!existingAdmin) {
    await authService.register('admin', 'test', email, '123456789');
    console.log('Admin user created.');
  } else {
    console.log('Admin user already exists.');
  }

  await app.close();
}

createAdmin();
