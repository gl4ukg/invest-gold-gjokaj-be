import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { ShippingAddress } from './shipping-address.entity';
import { Products } from '../products/products.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, ShippingAddress, Products])],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
