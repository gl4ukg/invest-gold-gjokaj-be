import { Controller, Post, Body, Param, UseGuards, Headers, Res } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { Response } from 'express';

@Controller('payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  async createPayment(@Body() createPaymentDto: CreatePaymentDto) {
    return this.paymentService.createPayment(createPaymentDto);
  }

  @Post('refund/:transactionId')
  async refundPayment(@Param('transactionId') transactionId: string) {
    return this.paymentService.refundPayment(transactionId);
  }

  @Post('callback')
  async handleBankartCallback(@Body() body: any, @Res() res: Response) {
    await this.paymentService.handleCallback(body);
    return res.status(200).send('OK');
  }
}
