import { IsNotEmpty, IsObject, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateBlogDto {
  @IsObject()
  @IsNotEmpty()
  title: {
    en: string;
    de: string;
    sq: string;
  };

  @IsObject()
  @IsNotEmpty()
  content: {
    en: string;
    de: string;
    sq: string;
  };

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  image?: string;

  @IsObject()
  @IsOptional()
  metaDescription?: {
    en: string;
    de: string;
    sq: string;
  };
}
