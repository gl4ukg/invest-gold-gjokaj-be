// src/typeorm.config.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Products } from './products/products.entity';
import { Categories } from './categories/categories.entity';
import { Order } from './orders/order.entity';
import { User } from './user/user.entity';
import { OrderItem } from './orders/order-item.entity';
import { ShippingAddress } from './orders/shipping-address.entity';
import { PriceOfGram } from './price-of-gram/entities/price-of-gram.entity';

export const typeOrmConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('POSTGRES_HOST'),
  port: configService.get<number>('POSTGRES_PORT'),
  username: configService.get<string>('POSTGRES_USER'),
  password: configService.get<string>('POSTGRES_PASSWORD'),
  database: configService.get<string>('POSTGRES_DB'),
  entities: [Products, Categories, Order, OrderItem, ShippingAddress, User, PriceOfGram],
  synchronize: true, // Set to false in production
});
