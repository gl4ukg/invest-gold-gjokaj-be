import { Test, TestingModule } from '@nestjs/testing';
import { PriceOfGramService } from './price-of-gram.service';

describe('PriceOfGramService', () => {
  let service: PriceOfGramService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PriceOfGramService],
    }).compile();

    service = module.get<PriceOfGramService>(PriceOfGramService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
