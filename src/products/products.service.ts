import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Products } from './products.entity';
import { Categories } from '../categories/categories.entity';
import { Repository } from 'typeorm';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Products)
    private readonly productsRepository: Repository<Products>,
    @InjectRepository(Categories)
    private readonly categoriesRepository: Repository<Categories>,
  ) {}

  async create(
    productData: Partial<Products>,
    categoryId: string,
  ): Promise<Products> {
    const category = await this.categoriesRepository.findOne({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException(`Category with ID ${categoryId} not found`);
    }

    const product = this.productsRepository.create({
      ...productData,
      category,
    });
    return this.productsRepository.save(product);
  }

  async findAll(): Promise<Products[]> {
    return this.productsRepository.find();
  }

  async findOne(id: string): Promise<Products> {
    return this.productsRepository.findOne({ where: { id } });
  }

  async update(id: string, productData: Partial<Products>): Promise<Products> {
    const updateResult = await this.productsRepository.update(id, productData);
    if (updateResult.affected === 0) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return this.productsRepository.findOne({ where: { id } });
  }

  async remove(id: string): Promise<Products> {
    const product = await this.productsRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    await this.productsRepository.remove(product);
    return product;
  }
}
