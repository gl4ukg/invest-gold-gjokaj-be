import { Products } from "../products.entity";
import { IsNotEmpty, IsNumber, IsOptional, IsString, Matches, IsObject } from 'class-validator';

export class MultiLanguageDescription {
  @IsString()
  @IsNotEmpty()
  en: string;

  @IsString()
  @IsNotEmpty()
  de: string;

  @IsString()
  @IsNotEmpty()
  sq: string;
}

export class ProductData {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsObject()
  description: MultiLanguageDescription;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsNotEmpty()
  @IsString() 
  @Matches(/^\d+(-\d+)?$/, { message: 'Pesha duhet të jetë ose një numër i vetëm (p.sh., "2") ose një varge (p.sh., "2-3")' })
  weight: string;

  @IsNotEmpty()
  @IsNumber()
  stock: number;

  @IsOptional()
  @IsString({ each: true })
  images?: string[];

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