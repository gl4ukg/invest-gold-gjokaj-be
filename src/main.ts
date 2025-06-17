import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import * as compression from 'compression';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ['http://localhost:3002', 'https://invest-gold-gjokaj-fe.vercel.app', 'https://investgoldgjokaj.com', 'https://invest-gold-gjokaj-fe-gl4ukgs-projects.vercel.app', 'https://www.investgoldgjokaj.com'],
    credentials: true,
  });
  app.use(compression());
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));
  await app.listen(3000, '0.0.0.0');
  console.log('Application is running on: http://localhost:3000 2');
}
bootstrap();
