import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ['http://localhost:3002', 'https://invest-gold-gjokaj-fe.vercel.app', 'https://investgoldgjokaj.com'],
    credentials: true,
  });
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));
  await app.listen(3000, '0.0.0.0');
  console.log('Application is running on: http://localhost:3000 2');
}
bootstrap();
