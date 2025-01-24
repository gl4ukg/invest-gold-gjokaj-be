import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Order } from './order.entity';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orderService: OrdersService) {}

  @Post('guest')
  async createGuestOrder(
    @Body('guestEmail') guestEmail: string,
    @Body('productId') productId: string,
    @Body('quantity') quantity: number,
  ): Promise<Order> {
    return this.orderService.createGuestOrder(guestEmail, productId, quantity);
  }

  @Get()
  async findAll(): Promise<Order[]> {
    return this.orderService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Order> {
    return this.orderService.findOne(id);
  }
}
