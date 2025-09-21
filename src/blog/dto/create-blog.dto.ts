import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateBlogDto {
  @IsObject()
  @IsNotEmpty()
  title: {
    en: string;
    de: string;
    al: string;
  };

  @IsObject()
  @IsNotEmpty()
  content: {
    en: string;
    de: string;
    al: string;
  };

  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsObject()
  @IsOptional()
  metaDescription?: {
    en: string;
    de: string;
    al: string;
  };
}
