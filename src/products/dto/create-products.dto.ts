import { Products } from "../products.entity";
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class ProductData {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsNumber()
  price: number;

  @IsNotEmpty()
  @IsNumber()
  stock: number;

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  category?: any;
}

export class CreateProductDto {
  @IsNotEmpty()
  product: ProductData;

  @IsNotEmpty()
  @IsString()
  categoryId: string;
}