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
          where: { id: item.product.id }
        });

        if (!product) {
          throw new NotFoundException(`Product with ID ${item.product.id} not found`);
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

    try {

      // Prepare customer email
      const emailSubject = 'Konfirmimi i Porosisë';
      const emailText = `Faleminderit për porosinë tuaj! ID-ja e porosisë tuaj është: ${completeOrder.id}`;
      const emailHtml = `
      <div style="font-family: system-ui, -apple-system, sans-serif; background-color: #f9fafb; padding: 20px;">
        <h1 style="color: #1f2937;">Faleminderit për Porosinë Tuaj!</h1>
        <p>ID-ja e Porosisë: <strong>${completeOrder.id}</strong></p>
        <p>Totali i Porosisë: <strong>$${completeOrder.total}</strong></p>
        <p>Statusi: <strong>${ordersStatusTrnslation[completeOrder.status]}</strong></p>
    
        <div style="margin: 30px 0;">
          ${completeOrder.items.map(item => `
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
                  ${item.configuration?.preciousMetal?.colorType}<br>
                  ${item.configuration?.preciousMetal?.colors.map(c => `${c.metalColor} (${c.fineness}) (${c.polishType})`).join('<br>')}
                  ${ item.configuration?.preciousMetal?.colors.length > 1 ? `<br>Forma: ${item.configuration?.preciousMetal?.shape.category}` : ''}
                  ${item.configuration?.preciousMetal?.colors.length > 2 ? `<br>Lartesia: ${item.configuration?.preciousMetal?.shape.heightPercentage}%` : ''}
                  ${item.configuration?.preciousMetal?.colors.length > 2 ? `<br>Numri i valave: ${item.configuration?.preciousMetal?.shape.waveCount}` : ''}
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
                          <p>Pozicioni: (${stone.x.toFixed(2)}, ${stone.y.toFixed(2)})</p>
                        `).join('');
                      } else {
                        return `
                          <p>Lloji: ${s?.stoneType}</p>
                          <p>Përmasat: ${s?.stoneSize}</p>
                          <p>Cilësia: ${s?.stoneQuality}</p>
                          <p>Numri i gureve: ${s?.numberOfStones}</p>
                          <p>Pozicioni: ${s?.position}</p>
                          ${s?.position === "Free" ? `<br>(${(Math.abs(s?.offset || 0) * 0.1).toFixed(1)}mm ${Number(s?.offset) > 0 ? 'Right' : 'Left'})` : ''}
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
      // const customerEmailResult = await this.emailService.sendEmail(
      //   completeOrder.email,
      //   emailSubject,
      //   emailText,
      //   emailHtml
      // );

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
                      ${item.configuration?.preciousMetal?.colors.length > 1 ? `<div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Forma: <span style="color: #111827">${item.configuration?.preciousMetal?.shape.category} Lartesia: (${item.configuration?.preciousMetal?.shape.heightPercentage}%)</span></div>` : ''}
                      ${item.configuration?.preciousMetal?.colors.length > 2 ? `<div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Numri i valave: <span style="color: #111827">${item.configuration?.preciousMetal?.shape.waveCount}</span></div>` : ''}
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
                                <div style="color: #6b7280; font-size: 14px; margin-top: 2px;">Pozicioni: (${stone.x.toFixed(2)}, ${stone.y.toFixed(2)})</div>
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
                            <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Përmasat: <span style="color: #111827">${groove?.depth}×${groove?.width}mm</span></div>
                            <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Surface: <span style="color: #111827">${groove?.surface}</span></div>
                            <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Direction: <span style="color: #111827">${groove?.direction}</span></div>
                            <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">Position: <span style="color: #111827">${groove?.position}mm</span></div>
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
      // const adminEmailResult = await this.emailService.sendEmail(
      //   'investgoldgjokaj2017@gmail.com',
      //   adminEmailSubject,
      //   adminEmailText,
      //   adminEmailHtml
      // );

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
