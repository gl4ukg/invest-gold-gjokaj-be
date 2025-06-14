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

  private get callbackUrl() {
    return this.configService.get<string>('BANKART_CALLBACK_URL');
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
      successUrl: `${createPaymentDto.returnUrl}/${order.id}`,
      cancelUrl: `${createPaymentDto.returnUrl}/cancel`,
      errorUrl: `${createPaymentDto.returnUrl}/error`,
      callbackUrl: this.callbackUrl,
      description: `Order ${order.id}`,
      customer: {
        email: order.email,
        firstName: firstName || 'N/A',
        lastName: lastName || 'N/A',
        billingAddress1: order.shippingAddress.address,
        billingCity: order.shippingAddress.city,
        billingCountry: order.shippingAddress.country,
        billingPostcode: order.shippingAddress.postalCode
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
        status: 'pending',
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
      callbackUrl: this.callbackUrl,
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
  
  async handleCallback(payload: any) {
    const { merchantTransactionId, status, uuid } = payload;
    console.log(payload,"payload")
  
    const isRefund = merchantTransactionId.endsWith('-refund');
    const baseMerchantTransactionId = isRefund
      ? merchantTransactionId.replace('-refund', '')
      : merchantTransactionId;

    const order = await this.orderRepository.findOne({
      where: { id: baseMerchantTransactionId },
      relations: ['shippingAddress', 'items', 'items.product'],
    });
  
    if (!order) {
      throw new NotFoundException('Order not found for callback');
    }
  
    const transaction = await this.paymentTransactionRepository.findOne({
      where: { merchantTransactionId: baseMerchantTransactionId },
    });

    console.log(transaction,"transaction")
  
    if (!transaction) {
      throw new NotFoundException('Transaction not found for callback');
    }

    if (transaction.status === 'completed') {
      return { message: 'Already processed' };
    }

    if (transaction.status === 'refunded') {
      return { message: 'Refund callback received, no email sent' };
    }
    // Update based on status from Bankart
    if (payload.result === 'OK') {
      order.status = 'processing';
      order.paymentStatus = 'success';
      transaction.status = 'completed';

      const ordersStatusTrnslation = {
        pending: 'Porosia e kryer',
        processing: 'Porosia ne procesim',
        shipped: 'Porosia eshte nisur',
        delivered: 'Porosia e dorezuar',
        cancelled: 'Porosia e anuluar'
      }
  
      // Prepare customer email
      const emailSubject = 'Konfirmimi i Porosisë';
      const emailText = `Faleminderit për porosinë tuaj! ID-ja e porosisë tuaj është: ${order.id}`;
      const emailHtml = `
      <div style="font-family: system-ui, -apple-system, sans-serif; background-color: #f9fafb; padding: 20px;">
        <h1 style="color: #1f2937;">Faleminderit për Porosinë Tuaj!</h1>
        <p>ID-ja e Porosisë: <strong>${order.id}</strong></p>
        <p>Totali i Porosisë: <strong>$${order.total}</strong></p>
        <p>Statusi: <strong>${ordersStatusTrnslation[order.status]}</strong></p>
    
        <div style="margin: 30px 0;">
          ${order.items.map(item => `
            <table style="width: 100%; border: 1px solid #e5e7eb; border-radius: 8px; background: #ffffff; margin-bottom: 30px; padding: 15px;">
              <tr>
                <td colspan="3" style="font-weight: bold; padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                  Produkti: ${item.product?.name}
                </td>
              </tr>
              <tr>
                <td style="width: 33%; padding: 10px; vertical-align: top;">
                  <strong>Pesha:</strong> ${item.configuration?.weight}g<br>
                  <strong>Profili:</strong> ${item.configuration?.selectedProfile}<br>
                  <strong>Dimensionet:</strong><br>
                  ${item.configuration?.dimensions?.profileWidth}×${item.configuration?.dimensions?.profileHeight}mm<br>
                  ${item.configuration?.dimensions?.ringSizeSystem} ${item.configuration?.dimensions?.ringSize}
                </td>
                <td style="width: 33%; padding: 10px; vertical-align: top;">
                  <strong>Metali:</strong><br>
                  Lloji: ${item.configuration?.preciousMetal?.colorType}<br>
                  ${item.configuration?.preciousMetal?.colors.map(c => `${c.metalColor} (${c.fineness}) (${c.polishType})`).join('<br>')}
                  ${ item.configuration?.preciousMetal?.colors.length > 1 ? `<br>Forma: ${item.configuration?.preciousMetal?.shape.category} ${item.configuration?.preciousMetal?.shape.variant}` : ''}
                  ${item.configuration?.preciousMetal?.colors.length > 1 ? `${item.configuration?.preciousMetal?.shape.heightPercentage !== undefined ? `<br>Lartesia: ${item.configuration?.preciousMetal?.shape.heightPercentage}%` : ''}` : ''}
                  ${item.configuration?.preciousMetal?.colors.length > 1 ? `${item.configuration?.preciousMetal?.shape.waveCount !== undefined ? `<br>Numri i valave: ${item.configuration?.preciousMetal?.shape.waveCount}` : ''}` : ''}
                </td>
                <td style="width: 33%; padding: 10px; vertical-align: top;">
                  <strong>Guret:</strong><br>
                  ${
                    (() => {
                      const s = item.configuration?.stoneSettings;
                      if (s?.settingType === "No stone") {
                        return 'Nuk ka gure';
                      } else if (s?.settingType === "Free Stone Spreading") {
                        return s?.stones?.map((stone, idx) => `
                          <p>Free Stone Spreading</p>
                          <p>Guri ${idx + 1}</p>
                          <p>Madhësia: ${stone.size}</p>
                          <p>Cilësia: ${stone.quality}</p>
                          <p>Pozicioni: (${stone.x.toFixed(2)}mm, ${stone.y.toFixed(2)}mm)</p>
                        `).join('');
                      } else {
                        return `
                          <p>Lloji: ${s?.stoneType}</p>
                          <p>Përmasat: ${s?.stoneSize}</p>
                          <p>Cilësia: ${s?.stoneQuality}</p>
                          <p>Numri i gureve: ${s?.numberOfStones}</p>
                          <p>Pozicioni: ${s?.position}</p>
                          ${s?.position === "Free" ? `<br>(${Math.abs(s?.offset || 0)}mm ${Number(s?.offset) > 0 ? 'Right' : 'Left'})` : ''}
                        `;
                      }
                    })()
                  }
                </td>
              </tr>
              <tr>
                <td colspan="3" style="padding: 10px; border-top: 1px solid #e5e7eb;">
                  ${item.configuration?.groovesAndEdges?.groove[0].grooveType !== "" ? `
                    <strong>Gravimet:</strong><br>
                    ${item.configuration?.groovesAndEdges?.groove?.map(g => `
                      - ${g.grooveType}, ${g.depth}×${g.width}mm, ${g.surface}, ${g.direction}, ${g.position}mm
                      ${g.direction === "wave" ? `, Valët: ${g.numberOfWaves}, Lartësia: ${g.waveHeight}%` : ''}
                      <br>
                    `).join('')}
                  ` : 'Nuk ka gravime'}
                </td>
              </tr>
              <tr>
                <td colspan="3" style="padding: 10px;">
                  <strong>Skajet:</strong><br>
                  ${
                    item.configuration?.groovesAndEdges?.leftEdge?.type !== "none" || item.configuration?.groovesAndEdges?.rightEdge?.type !== "none"
                    ? `
                      ${item.configuration?.groovesAndEdges?.leftEdge?.type !== "none" ? `
                        Majtas: ${item.configuration?.groovesAndEdges?.leftEdge?.type}, Thellesia:${item.configuration?.groovesAndEdges?.leftEdge?.depth}mm, Gjeresia:${item.configuration?.groovesAndEdges?.leftEdge?.width}mm
                        <br>
                        Siperfaqja: ${item.configuration?.groovesAndEdges?.leftEdge?.surface}
                      ` : ''}
                      <br>
                      ${item.configuration?.groovesAndEdges?.rightEdge?.type !== "none" ? `
                        Djathtas: ${item.configuration?.groovesAndEdges?.rightEdge?.type}, Thellesia:${item.configuration?.groovesAndEdges?.rightEdge?.depth}mm, Gjeresia:${item.configuration?.groovesAndEdges?.rightEdge?.width}mm
                        <br>
                        Siperfaqja: ${item.configuration?.groovesAndEdges?.rightEdge?.surface}
                      ` : ''}
                    `
                    : 'Nuk ka skaje'
                  }
                </td>
              </tr>
              ${item.configuration?.engraving ? `
                <tr>
                  <td colspan="3" style="padding: 10px;">
                    <strong>Gravimi i tekstit:</strong> "${item.configuration?.engraving?.text}"<br>
                    <strong>Fonti:</strong> ${item.configuration?.engraving?.fontFamily}
                  </td>
                </tr>
              ` : ''}
            </table>
          `).join('')}
        </div>
    
        <p style="color: #374151;">Do ta përpunojmë porosinë tuaj së shpejti. Nëse keni pyetje, mos hezitoni të na kontaktoni.</p>
      </div>
    `;
    
        // Send customer email first
        const customerEmailResult = await this.emailService.sendEmail(
          order.email,
          emailSubject,
          emailText,
          emailHtml
        );
  
      // Prepare admin email
      const adminEmailSubject = 'Porosi e Re Pranuar';
      const adminEmailText = `Një porosi e re është bërë! ID-ja e porosisë: ${order.id}`;
      const adminEmailHtml = `
        <h1>Porosi e Re Pranuar</h1>
        <p>ID-ja e Porosisë: <strong>${order.id}</strong></p>
        <p>Email i Klientit: <strong>${order.email}</strong></p>
        <p>Totali i Porosisë: <strong>$${order.total}</strong></p>
        <p>Statusi: <strong>${ordersStatusTrnslation[order.status]}</strong></p>
        <p>Detajet e Dërgesës:</p>
        <p>Adresa: ${order.shippingAddress.address}</p>
        <p>Qyteti: ${order.shippingAddress.city}</p>
        <p>Shteti: ${order.shippingAddress.country}</p>
        <p>Telefoni: ${order.shippingAddress.phone}</p>
        <p>Unazat: ${order.items.map(item => item.product.name)}</p>
        <p>Konfigurimi:</p>
        ${order.items.map(item => `
          <div style="margin: 20px 0; padding: 20px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
            <div style="margin-bottom: 10px;">
              <strong>Produkti:</strong> ${item.product?.name}
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <!-- Column 1 -->
                <td style="width: 33%; padding: 10px; vertical-align: top;">
                  <div style="margin-bottom: 15px;">
                    <div style="color: #374151; font-weight: 600; margin-bottom: 5px;">Pesha & Profili</div>
                    <div style="background-color: #f9fafb; padding: 10px; border-radius: 6px;">
                      <div style="color: #6b7280; font-size: 14px;">Pesha: <span style="color: #111827">${item.configuration?.weight}g</span></div>
                      <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Profili: <span style="color: #111827">${item.configuration?.selectedProfile}</span></div>
                    </div>
                  </div>
  
                  <div>
                    <div style="color: #374151; font-weight: 600; margin-bottom: 5px;">Dimensionet</div>
                    <div style="background-color: #f9fafb; padding: 10px; border-radius: 6px;">
                      <div style="color: #6b7280; font-size: 14px;">Gjerësia × Lartësia: <span style="color: #111827">${item.configuration?.dimensions?.profileWidth}×${item.configuration?.dimensions?.profileHeight}mm</span></div>
                      <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Madhësia: <span style="color: #111827">${item.configuration?.dimensions?.ringSizeSystem} ${item.configuration?.dimensions?.ringSize}</span></div>
                    </div>
                  </div>
                </td>
  
                <!-- Column 2 -->
                <td style="width: 33%; padding: 10px; vertical-align: top;">
                  <div style="margin-bottom: 15px;">
                    <div style="color: #374151; font-weight: 600; margin-bottom: 5px;">Metali</div>
                    <div style="background-color: #f9fafb; padding: 10px; border-radius: 6px;">
                      <div style="color: #6b7280; font-size: 14px;">Lloji: <span style="color: #111827">${item.configuration?.preciousMetal?.colorType}</span></div>
                      ${item.configuration?.preciousMetal?.colors.map(color => `
                        <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">${color.metalColor}: <span style="color: #111827">${color.fineness}</span> (${color.polishType})</div>
                      `).join('')}
                      ${item.configuration?.preciousMetal?.colors.length > 1 ? `<div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Forma: <span style="color: #111827">${item.configuration?.preciousMetal?.shape.category} ${item.configuration?.preciousMetal?.shape.variant} ${item.configuration?.preciousMetal?.shape.heightPercentage !== undefined ? `Lartesia: (${item.configuration?.preciousMetal?.shape.heightPercentage}%)` : ''}</span></div>` : ''}
                      ${item.configuration?.preciousMetal?.colors.length > 1 ? `${item.configuration?.preciousMetal?.shape.waveCount !== undefined ? `<div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Numri i valave: <span style="color: #111827">${item.configuration?.preciousMetal?.shape.waveCount}</span></div>` : ''}` : ''}
                    </div>
                  </div>
  
                  <div>
                    <div style="color: #374151; font-weight: 600; margin-bottom: 5px;">Gurët</div>
                    <div style="background-color: #f9fafb; padding: 10px; border-radius: 6px;">
                      ${(() => {
                        const settingType = item?.configuration?.stoneSettings?.settingType;
                        if (settingType === "No stone") {
                          return '<div style="color: #6b7280; font-size: 14px;">Nuk ka gure</div>';
                        } else if (settingType === "Free Stone Spreading") {
                          return `
                            ${item?.configuration?.stoneSettings?.stones?.map((stone, idx) => `
                              <div style="margin-top: 5px;">
                                <p>Free Stone Spreading</p>
                                <div style="color: #6b7280; font-size: 14px;">Guri ${idx + 1}:</div>
                                <div style="color: #111827; font-size: 14px; margin-top: 2px;">Madhesia: ${stone.size}</div>
                                <div style="color: #6b7280; font-size: 14px; margin-top: 2px;">Qualiteti: ${stone.quality}</div>
                                <div style="color: #6b7280; font-size: 14px; margin-top: 2px;">Pozicioni: (${stone.x.toFixed(2)}mm, ${stone.y.toFixed(2)}mm)</div>
                              </div>
                            `).join('')}
                          `;
                        } else {
                          return `
                            <div style="color: #6b7280; font-size: 14px;">Lloji: ${item?.configuration?.stoneSettings?.stoneType}</div>
                            <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Permasat: ${item?.configuration?.stoneSettings?.stoneSize}</div>
                            <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Cilesia: ${item?.configuration?.stoneSettings?.stoneQuality}</div>
                            <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Numri i gureve: ${item?.configuration?.stoneSettings?.numberOfStones}</div>
                            <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Pozicioni: ${item?.configuration?.stoneSettings?.position} ${item?.configuration?.stoneSettings?.position === "Free" ? `(${(Math.abs(item?.configuration?.stoneSettings?.offset || 0) * 0.1).toFixed(1)}mm ${Number(item?.configuration?.stoneSettings?.offset) > 0 ? 'Right' : 'Left'})` : ''}</div>
                          `;
                        }
                      })()}
                    </div>
                  </div>
                </td>
  
                <!-- Column 3 -->
                <td style="width: 33%; padding: 10px; vertical-align: top;">
                  ${item.configuration?.groovesAndEdges?.groove[0].grooveType !== "" ? `
                    <div style="margin-bottom: 15px;">
                      <div style="color: #374151; font-weight: 600; margin-bottom: 5px;">Gravimi</div>
                      <div style="background-color: #f9fafb; padding: 10px; border-radius: 6px;">
                        ${item.configuration?.groovesAndEdges?.groove?.map(groove => `
                          <div style="margin-bottom: 10px;">
                            <div style="color: #6b7280; font-size: 14px;">Lloji: <span style="color: #111827">${groove?.grooveType}</span></div>
                            <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Përmasat: <span style="color: #111827">Thellesia: ${groove?.depth}mm, Gjeresia: ${groove?.width}mm</span></div>
                            <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Sipërfaqja: <span style="color: #111827">${groove?.surface}</span></div>
                            <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Drejtimi: <span style="color: #111827">${groove?.direction}</span></div>
                            <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Pozicioni: <span style="color: #111827">${groove?.position}mm</span></div>
                            ${groove?.direction === "wave" ? `
                              <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Numri i valëve: <span style="color: #111827">${groove?.numberOfWaves}</span></div>
                              <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Lartësia e valës: <span style="color: #111827">${groove?.waveHeight}%</span></div>
                            ` : ''}
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  ` : ''}
                  ${
                  (item.configuration.groovesAndEdges.leftEdge.type !== "none" && item?.configuration?.groovesAndEdges?.rightEdge.type !== "none")
                    ? ((item.configuration?.groovesAndEdges?.leftEdge || item.configuration?.groovesAndEdges?.rightEdge) ? `
                      <div style="margin-bottom: 15px;">
                        <div style="color: #374151; font-weight: 600; margin-bottom: 5px;">Skajet</div>
                        <div style="background-color: #f9fafb; padding: 10px; border-radius: 6px;">
                          ${item.configuration?.groovesAndEdges?.leftEdge ? `
                            <div style="margin-bottom: 8px;">
                              <div style="color: #6b7280; font-size: 14px;">Majtas:</div>
                              <div style="color: #111827; font-size: 14px; margin-top: 2px;">${item.configuration?.groovesAndEdges?.leftEdge?.type}</div>
                              <div style="color: #6b7280; font-size: 14px; margin-top: 2px;">Thellesia:${item.configuration?.groovesAndEdges?.leftEdge?.depth}mm, Gjeresia:${item.configuration?.groovesAndEdges?.leftEdge?.width}mm</div>
                              <div style="color: #6b7280; font-size: 14px; margin-top: 2px;">Siperfaqja: ${item.configuration?.groovesAndEdges?.leftEdge?.surface}</div>
                            </div>
                          ` : ''}
                          ${item.configuration?.groovesAndEdges?.rightEdge ? `
                            <div>
                              <div style="color: #6b7280; font-size: 14px;">Djathtas:</div>
                              <div style="color: #111827; font-size: 14px; margin-top: 2px;">${item.configuration?.groovesAndEdges?.rightEdge?.type}</div>
                              <div style="color: #6b7280; font-size: 14px; margin-top: 2px;">Thellesia:${item.configuration?.groovesAndEdges?.rightEdge?.depth}mm, Gjeresia:${item.configuration?.groovesAndEdges?.rightEdge?.width}mm</div>
                              <div style="color: #6b7280; font-size: 14px; margin-top: 2px;">Siperfaqja: ${item.configuration?.groovesAndEdges?.rightEdge?.surface}</div>
  
                            </div>
                          ` : ''}
                        </div>
                      </div>
                    ` : '')
                    : `
                      <div style="margin-bottom: 15px;">
                        <div style="color: #374151; font-weight: 600; margin-bottom: 5px;">Skajet</div>
                        <div style="background-color: #f9fafb; padding: 10px; border-radius: 6px;">
                          <div style="color: #6b7280; font-size: 14px;">Nuk ka Skaje</div>
                        </div>
                      </div>
                    `
                  }
  
                  ${item.configuration?.engraving ? `
                    <div>
                      <div style="color: #374151; font-weight: 600; margin-bottom: 5px;">Gravimi i tekstit</div>
                      <div style="background-color: #f9fafb; padding: 10px; border-radius: 6px;">
                        <div style="color: #6b7280; font-size: 14px;">Teksti: <span style="color: #111827">"${item.configuration?.engraving?.text}"</span></div>
                        <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Fonti: <span style="color: #111827">${item.configuration?.engraving?.fontFamily}</span></div>
                      </div>
                    </div>
                  ` : ''}
                </td>
              </tr>
            </table>
          </div>
        `).join('')}
      `;
  
      
      // Send admin email
        const adminEmailResult = await this.emailService.sendEmail(
          'info@investgoldgjokaj.com',
          adminEmailSubject,
          adminEmailText,
          adminEmailHtml
        );
    } else if (payload.status !== 'refunded') {
      order.status = 'cancelled';
      order.paymentStatus = 'failed';
      transaction.status = 'failed';
    }
  
    transaction.uuid = uuid || transaction.uuid;
  
    await this.orderRepository.save(order);
    await this.paymentTransactionRepository.save(transaction);
  
    return { message: 'Callback processed successfully' };
  }
  
}
