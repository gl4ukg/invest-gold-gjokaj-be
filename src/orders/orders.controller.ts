import { Body, Controller, Get, Param, Post, Patch } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { Order } from './order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orderService: OrdersService) {}

  @Post('guest')
  async createGuestOrder(
    @Body() orderData: CreateOrderDto
  ): Promise<Order> {
    return this.orderService.createGuestOrder(orderData);
  }

  @Get()
  async findAll(): Promise<Order[]> {
    return this.orderService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Order> {
    return this.orderService.findOne(id);
  }

  @Patch(':id/status')
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateOrderStatusDto
  ): Promise<Order> {
    return this.orderService.updateOrderStatus(id, updateStatusDto);
  }
}
