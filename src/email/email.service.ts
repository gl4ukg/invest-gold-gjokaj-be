import { Injectable, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as sgMail from '@sendgrid/mail';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService implements OnModuleInit {
  private transporter: nodemailer.Transporter;
  private useSendGrid = false;

  constructor(private readonly configService: ConfigService) {
    // Try to initialize SendGrid if API key is available
    const sendGridApiKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (sendGridApiKey) {
      sgMail.setApiKey(sendGridApiKey);
      this.useSendGrid = true;
      console.log('Using SendGrid for email delivery');
    }
  }

  async onModuleInit() {
    try {
      await this.initializeTransporter();
    } catch (error) {
      console.error('Failed to initialize email service, but continuing app startup:', {
        error: error.message,
        stack: error.stack,
        code: error.code,
        command: error.command
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
      console.log('Initializing email transporter with config:', {
        host: 'smtp.gmail.com',
        port: 587,
        user: emailUser,
        tls: true
      });

      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: emailUser,
          pass: emailPassword,
        },
        requireTLS: true,
        tls: {
          minVersion: 'TLSv1.2',
          rejectUnauthorized: false // temporarily disable strict SSL to test connection
        },
        debug: true, // Enable debug logging
        logger: true  // Enable logger
      });

      // Verify connection with a timeout
      await Promise.race([
        this.transporter.verify(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('SMTP connection timeout')), 60000)
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

  private async sendWithSendGrid(to: string, subject: string, text: string, html: string) {
    try {
      const msg = {
        to,
        from: this.configService.get<string>('EMAIL_USER'),
        subject,
        text,
        html,
      };
      console.log('Sending email via SendGrid:', { to, subject, from: msg.from });
      const result = await sgMail.send(msg);
      console.log('SendGrid response:', {
        statusCode: result[0].statusCode,
        headers: result[0].headers,
        body: result[0].body
      });
      return { messageId: result[0].headers['x-message-id'] };
    } catch (error) {
      console.error('SendGrid error:', {
        message: error.message,
        response: error.response?.body,
      });
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

      if (this.useSendGrid) {
        return await this.sendWithSendGrid(to, subject, text, html);
      }
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
