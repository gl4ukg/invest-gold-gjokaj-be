import { Test, TestingModule } from '@nestjs/testing';
import { PriceOfGramController } from './price-of-gram.controller';
import { PriceOfGramService } from './price-of-gram.service';

describe('PriceOfGramController', () => {
  let controller: PriceOfGramController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PriceOfGramController],
      providers: [PriceOfGramService],
    }).compile();

    controller = module.get<PriceOfGramController>(PriceOfGramController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
