import { PartialType } from '@nestjs/mapped-types';
import { CreatePriceOfGramDto } from './create-price-of-gram.dto';

export class UpdatePriceOfGramDto extends PartialType(CreatePriceOfGramDto) {}
