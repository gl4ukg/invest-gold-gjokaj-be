// src/typeorm.config.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Products } from './products/products.entity';
import { Categories } from './categories/categories.entity';
import { Order } from './orders/order.entity';
import { User } from './user/user.entity';

export const typeOrmConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('POSTGRES_HOST'),
  port: parseInt(configService.get<string>('POSTGRES_PORT'), 10) || 5432,
  username: configService.get<string>('POSTGRES_USER'),
  password: configService.get<string>('POSTGRES_PASSWORD'),
  database: configService.get<string>('POSTGRES_DB'),
  entities: [Products, Categories, Order, User],
  synchronize: true, // Set to false in production
});
