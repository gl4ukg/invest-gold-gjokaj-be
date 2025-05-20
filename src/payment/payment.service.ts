import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Order } from '../orders/order.entity';

interface BankartTransactionResponse {
  data: {
    id: string;
    redirectUrl: string;
  };
}

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(PaymentTransaction)
    private paymentTransactionRepository: Repository<PaymentTransaction>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private configService: ConfigService,
  ) {}

  private get apiUrl() {
    return this.configService.get<string>('BANKART_API_URL');
  }

  private get merchantId() {
    return this.configService.get<string>('BANKART_MERCHANT_ID');
  }

  private get apiKey() {
    return this.configService.get<string>('BANKART_API_KEY');
  }

  private get sharedSecret() {
    return this.configService.get<string>('BANKART_SHARED_SECRET');
  }

  private generateSignature(data: Record<string, any>): string {
    const sortedData = Object.keys(data)
      .sort()
      .reduce((acc, key) => {
        acc[key] = data[key];
        return acc;
      }, {});

    const dataString = Object.entries(sortedData)
      .map(([key, value]) => `${key}=${value}`)
      .join('|');

    return crypto
      .createHmac('sha512', this.sharedSecret)
      .update(dataString)
      .digest('hex');
  }

  async createPayment(createPaymentDto: CreatePaymentDto) {
    const order = await this.orderRepository.findOne({ 
      where: { id: createPaymentDto.orderId }
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'pending') {
      throw new BadRequestException('Order is not in pending state');
    }

    const paymentData = {
      merchantId: this.merchantId,
      amount: Math.round(createPaymentDto.amount * 100), // Convert to cents
      currency: createPaymentDto.currency,
      merchantTransactionId: order.id,
      customerId: order.email,
      customerEmail: order.email,
      successUrl: `${createPaymentDto.returnUrl}/success`,
      cancelUrl: `${createPaymentDto.returnUrl}/cancel`,
      errorUrl: `${createPaymentDto.returnUrl}/error`,
      timestamp: Math.floor(Date.now() / 1000),
    };

    const signature = this.generateSignature(paymentData);

    try {
      const response = await axios.post<BankartTransactionResponse>(`${this.apiUrl}/v3/transaction`, {
        ...paymentData,
        signature,
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.data?.data) {
        throw new BadRequestException('Invalid response from payment provider');
      }

      const transaction = this.paymentTransactionRepository.create({
        bankartTransactionId: response.data.data.id,
        amount: createPaymentDto.amount,
        currency: createPaymentDto.currency,
        status: 'pending',
        order,
      });

      await this.paymentTransactionRepository.save(transaction);
      
      return {
        redirectUrl: response.data.data.redirectUrl,
        transactionId: transaction.id,
      };
    } catch (error) {
      throw new BadRequestException(
        error.response?.data?.message || 'Failed to create payment'
      );
    }
  }

  async refundPayment(transactionId: string) {
    const transaction = await this.paymentTransactionRepository.findOne({
      where: { id: transactionId },
      relations: ['order'],
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.status !== 'completed') {
      throw new BadRequestException('Transaction is not completed');
    }

    const refundData = {
      merchantId: this.merchantId,
      transactionId: transaction.bankartTransactionId,
      amount: Math.round(transaction.amount * 100), // Convert to cents
      timestamp: Math.floor(Date.now() / 1000),
    };

    const signature = this.generateSignature(refundData);

    try {
      await axios.post(`${this.apiUrl}/v3/transaction/refund`, {
        ...refundData,
        signature,
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      transaction.status = 'refunded';
      await this.paymentTransactionRepository.save(transaction);

      // Update order status
      transaction.order.status = 'refunded';
      await this.orderRepository.save(transaction.order);

      return { message: 'Refund processed successfully' };
    } catch (error) {
      throw new BadRequestException(
        error.response?.data?.message || 'Failed to process refund'
      );
    }
  }

  async handleWebhook(body: any) {
    const providedSignature = body.signature;
    delete body.signature;

    const calculatedSignature = this.generateSignature(body);

    if (providedSignature !== calculatedSignature) {
      throw new BadRequestException('Invalid signature');
    }

    const transaction = await this.paymentTransactionRepository.findOne({
      where: { bankartTransactionId: body.transactionId },
      relations: ['order'],
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    transaction.status = body.status;
    if (body.errorMessage) {
      transaction.errorMessage = body.errorMessage;
    }

    await this.paymentTransactionRepository.save(transaction);

    // Update order status based on payment status
    if (body.status === 'completed') {
      transaction.order.status = 'paid';
      await this.orderRepository.save(transaction.order);
    } else if (body.status === 'failed') {
      transaction.order.status = 'payment_failed';
      await this.orderRepository.save(transaction.order);
    }

    return { message: 'Webhook processed successfully' };
  }
}
