import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { PaymentTransaction } from './entities/payment-transaction.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Order } from '../orders/order.entity';
import { EmailService } from '../email/email.service';

interface BankartTransactionResponse {
  purchaseId: string;
  redirectUrl: string;
  success: boolean;
  uuid: string;
}

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(PaymentTransaction)
    private paymentTransactionRepository: Repository<PaymentTransaction>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    private configService: ConfigService,
    private emailService: EmailService,
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

  private get apiUsername() {
    return this.configService.get<string>('BANKART_API_USERNAME');
  }

  private get apiPassword() {
    return this.configService.get<string>('BANKART_API_PASSWORD');
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
      where: { id: createPaymentDto.orderId },
      relations: ['shippingAddress']
    });

    if (!order) {
      throw new NotFoundException('Porosia nuk u gjet!');
    }

    if (order.status !== 'pending') {
      throw new BadRequestException('Porosia nuk është në gjendje pritjeje');
    }

    if (!order.shippingAddress) {
      throw new BadRequestException('Adresa e dërgesës është e detyrueshme');
    }

    // Split fullName into firstName and lastName
    const [firstName, ...lastNameParts] = order.shippingAddress.fullName.split(' ');
    const lastName = lastNameParts.join(' ');

    const paymentData = {
      merchantTransactionId: order.id,
      amount: Number(createPaymentDto.amount).toFixed(2),
      currency: createPaymentDto.currency,
      successUrl: `${createPaymentDto.returnUrl}/${order.id}/callback?source=bankart`,
      cancelUrl: `${createPaymentDto.returnUrl}/cancel`,
      errorUrl: `${createPaymentDto.returnUrl}/error`,
      callbackUrl: `${createPaymentDto.returnUrl}/${order.id}/callback`,
      description: `Order ${order.id}`,
      customer: {
        email: order.email,
        firstName: firstName || 'N/A',
        lastName: lastName || 'N/A',
        billingAddress1: order.shippingAddress.address,
        billingCity: order.shippingAddress.city,
        billingCountry: order.shippingAddress.country,
        billingPostcode: order.shippingAddress.postalCode,
        billingPhone: order.shippingAddress.phone
      },
      language: 'en'
    };

    const auth = Buffer.from(`${this.apiUsername}:${this.apiPassword}`).toString('base64');


    // const signature = this.generateSignature(paymentData);

    const bodyString = JSON.stringify(paymentData); // do this once
    const bodyHash = crypto.createHash('sha512').update(bodyString).digest('hex');


    const contentType = 'application/json; charset=utf-8'; // as in docs
    const date = new Date().toUTCString(); // must match Date header
    const method = 'POST';
    const requestUri = `/api/v3/transaction/${this.apiKey}/debit`; 
    const message = [
      method,
      bodyHash,
      contentType,
      date,
      requestUri
    ].join('\n');

    const signature = crypto
      .createHmac('sha512', this.sharedSecret)
      .update(message)
      .digest('base64'); // NOT hex!  

    const headers = {
      'Content-Type': contentType,
      'Authorization': `Basic ${auth}`, // base64 of apiUsername:apiPassword
      'Date': date,
      'X-Signature': signature, 
    };
    try {
      const response = await axios.post<BankartTransactionResponse>(
        `${this.apiUrl}/transaction/${this.apiKey}/debit`,
        paymentData,
        {
          headers,
        }
      );

      const transaction = this.paymentTransactionRepository.create({
        bankartTransactionId: response.data.purchaseId,
        uuid: response.data.uuid,
        merchantTransactionId: order.id,
        amount: createPaymentDto.amount,
        currency: createPaymentDto.currency,
        status: response.data.success ? 'completed' : 'failed',
        order,
      }); 

      await this.paymentTransactionRepository.save(transaction);
      
      return {
        redirectUrl: response.data.redirectUrl,
        transactionId: transaction.id,
        success: response.data.success,
      };
    } catch (error) {
      console.error('Bankart error:', error.response?.data || error.message || error);

      throw new BadRequestException(
        error.response?.data?.message || 'Dështoi në krijimin e pagesës'
      );
    }
  }

  async refundPayment(transactionId: string) {
    const transaction = await this.paymentTransactionRepository.findOne({
      where: { merchantTransactionId: transactionId },
      relations: ['order'],
    });
  
    if (!transaction) {
      throw new NotFoundException('Transaksioni nuk u gjet');
    }
  
    if (transaction.status !== 'completed') {
      throw new BadRequestException('Transaksioni nuk është përfunduar');
    }
  
    const refundData = {
      merchantTransactionId: `${transaction.merchantTransactionId}-refund`,
      referenceUuid: transaction.uuid,
      amount: Number(transaction.amount).toFixed(2),
      currency: transaction.currency,
      callbackUrl: `${this.configService.get<string>('REFUND_CALLBACK_URL') || ''}`,
      description: `Refund for order ${transaction.order.id}`,
    };
  
    const bodyString = JSON.stringify(refundData);
    const bodyHash = crypto.createHash('sha512').update(bodyString).digest('hex');
    const contentType = 'application/json; charset=utf-8';
    const date = new Date().toUTCString();
    const method = 'POST';
    const requestUri = `/api/v3/transaction/${this.apiKey}/refund`;
    const message = [method, bodyHash, contentType, date, requestUri].join('\n');
  
    const signature = crypto
      .createHmac('sha512', this.sharedSecret)
      .update(message)
      .digest('base64');
  
    const auth = Buffer.from(`${this.apiUsername}:${this.apiPassword}`).toString('base64');
  
    try {
      const response = await axios.post<BankartTransactionResponse>(
        `${this.apiUrl}/transaction/${this.apiKey}/refund`,
        refundData,
        {
          headers: {
            'Content-Type': contentType,
            'Authorization': `Basic ${auth}`,
            'Date': date,
            'X-Signature': signature,
          },
        }
      );
  
      if (response.data.success) {
        transaction.status = 'refunded';
        await this.paymentTransactionRepository.save(transaction);
  
        transaction.order.status = 'refunded';
        await this.orderRepository.save(transaction.order);
  
        // Send email to client about refund
        const emailSubject = 'Konfirmimi i Rimbursimit';
        const emailText = `Rimbursimi për porosinë tuaj ${transaction.order.id} është pranuar dhe do të përpunohet në ditët në vijim.`;
        const emailHtml = `
          <div style="font-family: system-ui, -apple-system, sans-serif; background-color: #f9fafb; padding: 20px;">
            <h1 style="color: #1f2937;">Konfirmimi i Rimbursimit</h1>
            <p>I/E nderuar klient,</p>
            <p>Kërkesa juaj për rimbursim për porosinë <strong>${transaction.order.id}</strong> është pranuar me sukses.</p>
            <p>Detajet e rimbursimit:</p>
            <ul>
              <li>Shuma: ${transaction.amount} ${transaction.currency}</li>
              <li>ID e Porosisë: ${transaction.order.id}</li>
            </ul>
            <p>Rimbursimi do të përpunohet në ditët në vijim dhe do të reflektohet në llogarinë tuaj bankare.</p>
            <p>Ju faleminderit për mirëkuptimin!</p>
            <p>Për çdo pyetje ose paqartësi, mos hezitoni të na kontaktoni.</p>
            <p style="margin-top: 20px;">Me respekt,<br>Ekipi i Invest Gold Gjokaj</p>
          </div>
        `;

        await this.emailService.sendEmail(
          transaction.order.email,
          emailSubject,
          emailText,
          emailHtml
        );

        return {
          message: 'Rimbursimi u përpunua me sukses',
          uuid: response.data.uuid,
          purchaseId: response.data.purchaseId,
        };
      } else {
        throw new Error('Gabim i panjohur i rimbursimit');
      }
    } catch (error) {
      throw new BadRequestException(
        error.response?.data?.message || error.message || 'Dështoi në përpunimin e rimbursimit.'
      );
    }
  }
  

}
