import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order } from './order.entity';
import { Products } from '../products/products.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Products])],
  controllers: [OrdersController],
  providers: [OrdersService]
})
export class OrdersModule {}
