import { Controller, Post, Body, Get } from '@nestjs/common';
import { EmailService } from './email.service';

interface SendEmailDto {
  to: string;
  subject: string;
  text: string;
  html: string;
}

@Controller('email')
export class EmailController {
  constructor(
    private readonly emailService: EmailService,
  ) {}

  @Post('contact')
  async sendContactForm(@Body() emailDto: SendEmailDto) {
    try {
      const result = await this.emailService.sendEmail(
        emailDto.to,
        emailDto.subject,
        emailDto.text,
        emailDto.html
      );

      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Error in sendContactForm:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      return { success: false, error: error.message };
    }
  }

  // Test endpoint
  @Get('test')
  async testEmail() {
    try {
      const result = await this.emailService.sendEmail(
        'glaukthaqi15@gmail.com',
        'Test Email from Invest Gold Gjokaj',
        'This is a test email from Invest Gold Gjokaj. If you receive this, please check both your inbox and spam folder.',
        `<div style="font-family: Arial, sans-serif; padding: 20px;">
          <h1 style="color: #333;">Test Email from Invest Gold Gjokaj</h1>
          <p>Hello,</p>
          <p>This is a test email to verify our email delivery system is working correctly.</p>
          <p>If you receive this email, please check both your inbox and spam folder.</p>
          <hr>
          <p style="color: #666; font-size: 12px;">This is an automated test message from Invest Gold Gjokaj.</p>
        </div>`
      );
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('Test email error:', error);
      return { success: false, error: error.message };
    }
  }
}
