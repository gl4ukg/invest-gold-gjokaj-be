import { IsString, IsNumber, IsEmail, IsArray, ValidateNested, IsEnum, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ConfiguratorState } from './configurator';

export class OrderItemDto {
  @IsString()
  productId: string;

  @IsNumber()
  quantity: number;

  @ValidateNested()
  @Type(() => ConfiguratorState)
  configuration: ConfiguratorState;

  @IsString()
  price: string;
}

export class ShippingAddressDto {
  @IsString()
  fullName: string;

  @IsString()
  address: string;

  @IsString()
  city: string;

  @IsString()
  country: string;

  @IsString()
  postalCode: string;

  @IsString()
  phone: string;
}

export enum PaymentMethod {
  CASH_ON_DELIVERY = 'cash_on_delivery',
  PAYPAL = 'paypal',
  CARD = 'card',
  // BANK_TRANSFER = 'bank_transfer',
}

export enum ShippingMethod {
  LOCAL = 'local',
  INTERNATIONAL = 'international',
}

export class CreateOrderDto {
  @IsEmail()
  email: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress: ShippingAddressDto;

  @IsEnum(ShippingMethod)
  shippingMethod: ShippingMethod;

  @IsNumber()
  shippingCost: number;

  @IsNumber()
  subtotal: number;

  @IsNumber()
  total: number;
} 
