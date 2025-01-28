import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './order.entity';
import { OrderItem } from './order-item.entity';
import { ShippingAddress } from './shipping-address.entity';
import { Products } from '../products/products.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { OrderStatus } from './enums/order-status.enum';
import { EmailService } from '../email/email.service';

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
    private readonly emailService: EmailService,
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

    // Get the complete order with items
    const completeOrder = await this.findOne(savedOrder.id);
    
    const ordersStatusTrnslation = {
      pending: 'Porosia e kryer',
      processing: 'Porosia ne procesim',
      shipped: 'Porosia eshte nisur',
      delivered: 'Porosia e dorezuar',
      cancelled: 'Porosia e anuluar'
    }

    // Send confirmation email
    const emailSubject = 'Konfirmimi i Porosisë';
    const emailText = `Faleminderit për porosinë tuaj! ID-ja e porosisë tuaj është: ${completeOrder.id}`;
    const emailHtml = `
      <h1>Faleminderit për Porosinë Tuaj!</h1>
      <p>ID-ja e Porosisë: <strong>${completeOrder.id}</strong></p>
      <p>Totali i Porosisë: <strong>$${completeOrder.total}</strong></p>
      <p>Statusi: <strong>${ordersStatusTrnslation[completeOrder.status]}</strong></p>
      <p>Do ta përpunojmë porosinë tuaj së shpejti. Nëse keni pyetje, mos hezitoni të na kontaktoni.</p>
      <p>Faleminderit që zgjodhët shërbimet tona!</p>
    `;

    await this.emailService.sendEmail(
      completeOrder.email,
      emailSubject, 
      emailText,
      emailHtml
    );

    return completeOrder;
  }

  async updateOrderStatus(id: string, updateStatusDto: UpdateOrderStatusDto): Promise<Order> {
    const order = await this.findOne(id);
    
    if (!order) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    order.status = updateStatusDto.status;
    const updatedOrder = await this.orderRepository.save(order);

    const ordersStatusTrnslation = {
      pending: 'Porosia e kryer',
      processing: 'Porosia ne procesim',
      shipped: 'Porosia eshte nisur',
      delivered: 'Porosia e dorezuar',
      cancelled: 'Porosia e anuluar'
    }

    // Send status update email
    const emailSubject = 'Përditësim i Statusit të Porosisë';
    const emailText = `Statusi i porosisë tuaj (ID: ${order.id}) është përditësuar në: ${updateStatusDto.status}`;
    const emailHtml = `
      <h1>Përditësim i Statusit të Porosisë</h1>
      <p>Porosia juaj (ID: <strong>${order.id}</strong>) është përditësuar.</p>
      <p>Statusi i ri: <strong>${ordersStatusTrnslation[updateStatusDto.status]}</strong></p>
      <p>Faleminderit që na zgjodhët për blerjet tuaja!</p>
      <p>Ju lutemi mos hezitoni të na kontaktoni nëse keni pyetje ose shqetësime.</p>
    `;

    await this.emailService.sendEmail(
      order.email,
      emailSubject,
      emailText,
      emailHtml
    );

    return updatedOrder;
  }
}
