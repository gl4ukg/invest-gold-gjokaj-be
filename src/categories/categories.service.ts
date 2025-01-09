import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Categories } from './categories.entity';
import { Repository } from 'typeorm';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Categories)
    private readonly categoriesRepository: Repository<Categories>,
  ) {}

  async create(categoryData: Partial<Categories>): Promise<Categories> {
    const category = this.categoriesRepository.create(categoryData);
    return this.categoriesRepository.save(category);
  }

  async findAll(): Promise<Categories[]> {
    return this.categoriesRepository.find();
  }

  async findOne(id: string): Promise<Categories> {
    return this.categoriesRepository.findOne({ where: { id } });
  }

  async update(
    id: string,
    categoryData: Partial<Categories>,
  ): Promise<Categories> {
    if (!id) {
      throw new NotFoundException(
        'Category ID is required for updating the category',
      );
    }
    const updateResult = await this.categoriesRepository.update(
      id,
      categoryData,
    );
    if (updateResult.affected === 0) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }

    return this.categoriesRepository.findOne({ where: { id } });
  }

  async remove(id: string): Promise<Categories> {
    if (!id) {
      throw new NotFoundException(
        'Category ID is required for deleting the category',
      );
    }
    const category = await this.categoriesRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    await this.categoriesRepository.remove(category);
    return category;
  }
}
