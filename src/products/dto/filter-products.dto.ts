import { IsEnum, IsOptional, IsString, IsArray } from 'class-validator';

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC'
}

export enum SortBy {
  NAME = 'name',
  CREATED_AT = 'createdAt',
  STOCK = 'stock'
}

export class FilterProductsDto {
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

  @IsOptional()
  page?: number = 1;

  @IsOptional()
  limit?: number = 10;
}
