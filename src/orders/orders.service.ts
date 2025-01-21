import { Injectable, NotFoundException } from '@nestjs/common';
import { Order } from './order.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Products } from 'src/products/products.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Products)
    private readonly productsRepository: Repository<Products>,
  ) {}

  async createGuestOrder(
    guestEmail: string,
    productId: string,
    quantity: number,
  ): Promise<Order> {
    const product = await this.productsRepository.findOne({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    const totalPrice = product.price * quantity;

    const order = this.orderRepository.create({
      guestEmail,
      product,
      quantity,
      totalPrice,
    });

    return this.orderRepository.save(order);
  }

  async findAll(): Promise<Order[]> {
    return this.orderRepository.find();
  }

  async findOne(id: string): Promise<Order> {
    return this.orderRepository.findOne({ where: { id } });
  }
}
