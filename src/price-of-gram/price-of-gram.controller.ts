import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PriceOfGramService } from './price-of-gram.service';
import { CreatePriceOfGramDto } from './dto/create-price-of-gram.dto';
import { UpdatePriceOfGramDto } from './dto/update-price-of-gram.dto';

@Controller('price-of-gram')
export class PriceOfGramController {
  constructor(private readonly priceOfGramService: PriceOfGramService) {}

  @Get()
  getCurrentPrice() {
    return this.priceOfGramService.getCurrentPrice();
  }

  @Post()
  updatePrice(@Body() createPriceOfGramDto: CreatePriceOfGramDto) {
    return this.priceOfGramService.updatePrice(createPriceOfGramDto);
  }
}
