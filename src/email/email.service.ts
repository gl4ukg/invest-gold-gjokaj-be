import { Injectable, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService implements OnModuleInit {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    try {
      await this.initializeTransporter();
    } catch (error) {
      console.error('Failed to initialize email service, but continuing app startup:', {
        error: error.message
      });
      // Don't throw the error, let the app continue
    }
  }

  private async initializeTransporter() {
    try {
      const emailUser = this.configService.get<string>('EMAIL_USER');
      const emailPassword = this.configService.get<string>('EMAIL_APP_PASSWORD');
      

      if (!emailUser || !emailPassword) {
        throw new Error('Missing email configuration. Please check EMAIL_USER and EMAIL_APP_PASSWORD in your environment variables.');
      }

      // Create transporter with App Password
      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
      });

      // Verify connection with a timeout
      await Promise.race([
        this.transporter.verify(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('SMTP connection timeout')), 30000)
        )
      ]);
    } catch (error) {
      console.error('Error initializing email transporter:', {
        name: error.name,
        message: error.message,
        code: error.code
      });
      // Set transporter to null so we can retry later
      this.transporter = null;
      throw error;
    }
  }

  async sendEmail(to: string, subject: string, text: string, html: string) {
    try {
      if (!this.transporter) {
        await this.initializeTransporter();
      }

      const mailOptions = {
        from: this.configService.get<string>('EMAIL_USER'),
        to,
        subject,
        text,
        html,
      };

      const result = await this.transporter.sendMail(mailOptions);
      return result;
    } catch (error) {
      console.error('Error sending email:', {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      throw error;
    }
  }
}
