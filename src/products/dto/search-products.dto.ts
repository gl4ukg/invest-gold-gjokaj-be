import { IsEnum, IsOptional, IsString, IsArray, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC'
}

export enum SortBy {
  NAME = 'name',
  CREATED_AT = 'createdAt',
  STOCK = 'stock'  // Sort by product availability
}

export class SearchProductsDto {
  @IsString()
  @IsOptional()
  query?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categoryIds?: string[];

  @IsEnum(SortBy)
  @IsOptional()
  sortBy?: SortBy = SortBy.CREATED_AT;

  @IsEnum(SortOrder)
  @IsOptional()
  sortOrder?: SortOrder = SortOrder.DESC;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
