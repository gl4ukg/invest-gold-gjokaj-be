import { Injectable, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService implements OnModuleInit {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    console.log('Initializing EmailService...', {
      hasEmailUser: !!this.configService.get('EMAIL_USER'),
      hasEmailPassword: !!this.configService.get('EMAIL_APP_PASSWORD')
    });
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
      
      console.log('Initializing email transporter:', {
        hasEmailUser: !!emailUser,
        hasEmailPassword: !!emailPassword,
        emailUser: emailUser ? emailUser.substring(0, 3) + '...' : null
      });

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
          setTimeout(() => reject(new Error('SMTP connection timeout')), 5000)
        )
      ]);
      console.log('Email transporter initialized and verified successfully');
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
    console.log("here")
    try {
      console.log("inside try")
      if (!this.transporter) {
        console.log('Transporter not initialized, attempting to initialize...');
        await this.initializeTransporter();
      }
      console.log("after transporter check")

      console.log('Attempting to send email:', {
        to,
        subject,
        hasHtml: !!html,
        fromEmail: this.configService.get<string>('EMAIL_USER')?.substring(0, 3) + '...',
        hasTransporter: !!this.transporter
      });

      const mailOptions = {
        from: this.configService.get<string>('EMAIL_USER'),
        to,
        subject,
        text,
        html,
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', {
        messageId: result.messageId,
        response: result.response
      });
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
