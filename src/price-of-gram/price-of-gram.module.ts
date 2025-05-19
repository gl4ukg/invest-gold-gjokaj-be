import { Module } from '@nestjs/common';
import { PriceOfGramService } from './price-of-gram.service';
import { PriceOfGramController } from './price-of-gram.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PriceOfGram } from './entities/price-of-gram.entity';

@Module({
  controllers: [PriceOfGramController],
  providers: [PriceOfGramService],
  imports: [TypeOrmModule.forFeature([PriceOfGram])],
})
export class PriceOfGramModule {}
