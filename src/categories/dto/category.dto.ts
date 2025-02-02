import { IsString, IsOptional, Matches } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsString()
  @IsOptional()
  @Matches(/^data:image\/(jpeg|png|gif|jpg);base64,/, {
    message: 'Image must be a valid base64 encoded image string',
  })
  image?: string;
}

export class UpdateCategoryDto extends CreateCategoryDto {
  @IsString()
  @IsOptional()
  name: string;

  @IsString()
  @IsOptional()
  description: string;
}
