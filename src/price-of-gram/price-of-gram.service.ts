import { Injectable } from '@nestjs/common';
import { CreatePriceOfGramDto } from './dto/create-price-of-gram.dto';
import { UpdatePriceOfGramDto } from './dto/update-price-of-gram.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { PriceOfGram } from './entities/price-of-gram.entity';
import { Repository } from 'typeorm';

@Injectable()
export class PriceOfGramService {
  constructor(
    @InjectRepository(PriceOfGram)
    private readonly priceOfGramRepository: Repository<PriceOfGram>,
  ) {}

  async getCurrentPrice(): Promise<PriceOfGram> {
    const prices = await this.priceOfGramRepository.find({
      order: { updatedAt: 'DESC' },
      take: 1,
    });
    return prices[0];
  }

  async updatePrice(createPriceOfGramDto: CreatePriceOfGramDto): Promise<PriceOfGram> {
    const currentPrice = await this.getCurrentPrice();
    console.log(createPriceOfGramDto,"createPriceOfGramDto")
    
    if (currentPrice) {
      await this.priceOfGramRepository.update(currentPrice.id, { price: createPriceOfGramDto.price });
      return this.getCurrentPrice();
    }

    const priceOfGram = this.priceOfGramRepository.create(createPriceOfGramDto);
    return this.priceOfGramRepository.save(priceOfGram);
  }
}
