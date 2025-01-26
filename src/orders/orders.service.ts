import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { ShippingAddress } from './shipping-address.entity';
import { Products } from '../products/products.entity';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    @InjectRepository(ShippingAddress)
    private readonly shippingAddressRepository: Repository<ShippingAddress>,
    @InjectRepository(Products)
    private readonly productsRepository: Repository<Products>,
  ) {}

  async findAll(): Promise<Order[]> {
    return this.orderRepository.find({
      relations: ['items', 'items.product', 'shippingAddress'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['items', 'items.product', 'shippingAddress'],
    });

    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return order;
  }

  async createGuestOrder(orderData: CreateOrderDto): Promise<Order> {
    // Create shipping address
    const shippingAddress = this.shippingAddressRepository.create({
      ...orderData.shippingAddress
    });

    // Create the main order
    const order = this.orderRepository.create({
      email: orderData.email,
      subtotal: orderData.subtotal,
      shippingCost: orderData.shippingCost,
      total: orderData.total,
      paymentMethod: orderData.paymentMethod,
      shippingMethod: orderData.shippingMethod,
      shippingAddress: shippingAddress,
      status: 'pending'
    });

    // Save the order with shipping address
    const savedOrder = await this.orderRepository.save(order);

    // Create order items
    const orderItems = await Promise.all(
      orderData.items.map(async (item) => {
        const product = await this.productsRepository.findOne({
          where: { id: item.productId }
        });

        if (!product) {
          throw new NotFoundException(`Product with ID ${item.productId} not found`);
        }

        const price = typeof item.price === 'string' ? parseFloat(item.price) : item.price;

        const orderItem = this.orderItemRepository.create({
          order: savedOrder,
          product: product,
          quantity: item.quantity,
          price: price,
          total: price * item.quantity
        });

        return orderItem;
      })
    );

    // Save all order items
    await this.orderItemRepository.save(orderItems);

    // Return the complete order with items and shipping address
    return this.findOne(savedOrder.id);
  }
}
