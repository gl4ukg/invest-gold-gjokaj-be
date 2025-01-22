import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Products } from './products.entity';
import { Categories } from '../categories/categories.entity';
import { Repository } from 'typeorm';
import { ImageUtils } from '../utils/image.utils';

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

    // Process image if present
    if (productData.image) {
      try {
        productData.image = await ImageUtils.validateAndOptimizeImage(productData.image);
      } catch (error) {
        throw new BadRequestException(error.message);
      }
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
    const product = await this.productsRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async update(id: string, productData: Partial<Products>): Promise<Products> {
    // Process image if present
    if (productData.image) {
      try {
        productData.image = await ImageUtils.validateAndOptimizeImage(productData.image);
      } catch (error) {
        throw new BadRequestException(error.message);
      }
    }

    const updateResult = await this.productsRepository.update(id, productData);
    if (updateResult.affected === 0) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const result = await this.productsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
  }
}
