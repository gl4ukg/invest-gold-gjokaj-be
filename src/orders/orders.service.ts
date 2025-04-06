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
          // quantity: item.quantity,
          configuration: item.configuration,
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
    console.log(completeOrder,"completeOrder")

    try {

      // Prepare customer email
      const emailSubject = 'Konfirmimi i Porosisë';
      const emailText = `Faleminderit për porosinë tuaj! ID-ja e porosisë tuaj është: ${completeOrder.id}`;
      const emailHtml = `
        <h1>Faleminderit për Porosinë Tuaj!</h1>
        <p>ID-ja e Porosisë: <strong>${completeOrder.id}</strong></p>
        <p>Totali i Porosisë: <strong>$${completeOrder.total}</strong></p>
        <p>Statusi: <strong>${ordersStatusTrnslation[completeOrder.status]}</strong></p>
        <p>Do ta përpunojmë porosinë tuaj së shpejti. Nëse keni pyetje, mos hezitoni të na kontaktoni.</p>
        <p>Faleminderit që zgjodhët shërbimet tona!</p>
        <p>Unazat: ${completeOrder.items.map(item => item.product.name)}</p>
        <p>Konfigurimi:</p>
        ${completeOrder.items.map(item => `
          <div style="margin: 20px 0; padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
            <div style="margin-bottom: 10px;">
              <strong>Pesha:</strong> ${item.configuration?.weight}g
            </div>
            <div style="margin-bottom: 10px;">
              <strong>Profili:</strong> ${item.configuration?.selectedProfile}
            </div>
            <div style="margin-bottom: 10px;">
              <strong>Dimensionet:</strong><br>
              ${item.configuration?.dimensions?.profileWidth}×${item.configuration?.dimensions?.profileHeight}mm<br>
              ${item.configuration?.dimensions?.ringSizeSystem} ${item.configuration?.dimensions?.ringSize}
            </div>
            <div style="margin-bottom: 10px;">
              <strong>Metali:</strong><br>
              ${item.configuration?.preciousMetal?.colorType}<br>
              ${item.configuration?.preciousMetal?.colors.map(color => 
                `${color.metalColor} (${color.fineness})`
              ).join('<br>')}
            </div>
            <div style="margin-bottom: 10px;">
              <strong>Guret:</strong><br>
              ${item.configuration?.stoneSettings?.settingType !== "No stone" 
                ? `${item.configuration?.stoneSettings?.numberOfStones} gure<br>
                   ${item.configuration?.stoneSettings?.stoneType}<br>
                   ${item.configuration?.stoneSettings?.stoneSize}`
                : 'Nuk ka gure'}
            </div>
            ${item.configuration?.groovesAndEdges?.groove ? `
              <div style="margin-bottom: 10px;">
                <strong>Gravimi:</strong><br>
                ${item.configuration?.groovesAndEdges?.groove?.grooveType}<br>
                ${item.configuration?.groovesAndEdges?.groove?.depth}×${item.configuration?.groovesAndEdges?.groove?.width}mm
              </div>
            ` : ''}
            ${(item.configuration?.groovesAndEdges?.leftEdge || item.configuration?.groovesAndEdges?.rightEdge) ? `
              <div style="margin-bottom: 10px;">
                <strong>Skajet:</strong><br>
                ${item.configuration?.groovesAndEdges?.leftEdge ? `
                  Majtas:<br>
                  ${item.configuration?.groovesAndEdges?.leftEdge?.type}<br>
                  ${item.configuration?.groovesAndEdges?.leftEdge?.depth}×${item.configuration?.groovesAndEdges?.leftEdge?.width}mm<br>
                ` : ''}
                ${item.configuration?.groovesAndEdges?.rightEdge ? `
                  Djathtas:<br>
                  ${item.configuration?.groovesAndEdges?.rightEdge?.type}<br>
                  ${item.configuration?.groovesAndEdges?.rightEdge?.depth}×${item.configuration?.groovesAndEdges?.rightEdge?.width}mm
                ` : ''}
              </div>
            ` : ''}
            ${item.configuration?.engraving ? `
              <div style="margin-bottom: 10px;">
                <strong>Gravimi i tekstit:</strong><br>
                "${item.configuration?.engraving?.text}"<br>
                ${item.configuration?.engraving?.fontFamily}
              </div>
            ` : ''}
          </div>
        `).join('')}
      `;
      
      // Send customer email first
      const customerEmailResult = await this.emailService.sendEmail(
        completeOrder.email,
        emailSubject,
        emailText,
        emailHtml
      );

      // Prepare admin email
      const adminEmailSubject = 'Porosi e Re Pranuar';
      const adminEmailText = `Një porosi e re është bërë! ID-ja e porosisë: ${completeOrder.id}`;
      const adminEmailHtml = `
        <h1>Porosi e Re Pranuar</h1>
        <p>ID-ja e Porosisë: <strong>${completeOrder.id}</strong></p>
        <p>Email i Klientit: <strong>${completeOrder.email}</strong></p>
        <p>Totali i Porosisë: <strong>$${completeOrder.total}</strong></p>
        <p>Statusi: <strong>${ordersStatusTrnslation[completeOrder.status]}</strong></p>
        <p>Detajet e Dërgesës:</p>
        <p>Adresa: ${completeOrder.shippingAddress.address}</p>
        <p>Qyteti: ${completeOrder.shippingAddress.city}</p>
        <p>Shteti: ${completeOrder.shippingAddress.country}</p>
        <p>Telefoni: ${completeOrder.shippingAddress.phone}</p>
        <p>Unazat: ${completeOrder.items.map(item => item.product.name)}</p>
        <p>Konfigurimi:</p>
        ${completeOrder.items.map(item => `
          <div style="margin: 20px 0; padding: 20px; background-color: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);">
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
                        <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">${color.metalColor}: <span style="color: #111827">${color.fineness}</span></div>
                      `).join('')}
                    </div>
                  </div>

                  <div>
                    <div style="color: #374151; font-weight: 600; margin-bottom: 5px;">Gurët</div>
                    <div style="background-color: #f9fafb; padding: 10px; border-radius: 6px;">
                      ${item.configuration?.stoneSettings?.settingType !== "No stone" 
                        ? `<div style="color: #6b7280; font-size: 14px;">Sasia: <span style="color: #111827">${item.configuration?.stoneSettings?.numberOfStones} gurë</span></div>
                           <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Lloji: <span style="color: #111827">${item.configuration?.stoneSettings?.stoneType}</span></div>
                           <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Madhësia: <span style="color: #111827">${item.configuration?.stoneSettings?.stoneSize}</span></div>`
                        : '<div style="color: #6b7280; font-size: 14px;">Nuk ka gurë</div>'}
                    </div>
                  </div>
                </td>

                <!-- Column 3 -->
                <td style="width: 33%; padding: 10px; vertical-align: top;">
                  ${item.configuration?.groovesAndEdges?.groove ? `
                    <div style="margin-bottom: 15px;">
                      <div style="color: #374151; font-weight: 600; margin-bottom: 5px;">Gravimi</div>
                      <div style="background-color: #f9fafb; padding: 10px; border-radius: 6px;">
                        <div style="color: #6b7280; font-size: 14px;">Lloji: <span style="color: #111827">${item.configuration?.groovesAndEdges?.groove?.grooveType}</span></div>
                        <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Përmasat: <span style="color: #111827">${item.configuration?.groovesAndEdges?.groove?.depth}×${item.configuration?.groovesAndEdges?.groove?.width}mm</span></div>
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
                              <div style="color: #6b7280; font-size: 14px; margin-top: 2px;">${item.configuration?.groovesAndEdges?.leftEdge?.depth}×${item.configuration?.groovesAndEdges?.leftEdge?.width}mm</div>
                            </div>
                          ` : ''}
                          ${item.configuration?.groovesAndEdges?.rightEdge ? `
                            <div>
                              <div style="color: #6b7280; font-size: 14px;">Djathtas:</div>
                              <div style="color: #111827; font-size: 14px; margin-top: 2px;">${item.configuration?.groovesAndEdges?.rightEdge?.type}</div>
                              <div style="color: #6b7280; font-size: 14px; margin-top: 2px;">${item.configuration?.groovesAndEdges?.rightEdge?.depth}×${item.configuration?.groovesAndEdges?.rightEdge?.width}mm</div>
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
        'glaukthaqi15@gmail.com',
        adminEmailSubject,
        adminEmailText,
        adminEmailHtml
      );

      return completeOrder;

    } catch (error) {
      // Still return the order even if email sending fails
      return completeOrder;
    }
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
