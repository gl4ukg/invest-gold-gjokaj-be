import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Categories } from './categories.entity';
import { Repository } from 'typeorm';
import { ImageUtils } from '../utils/image.utils';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Categories)
    private readonly categoriesRepository: Repository<Categories>,
  ) {}

  async create(categoryData: Partial<Categories>): Promise<Categories> {
    // Process image if present
    if (categoryData.image) {
      try {
        categoryData.image = await ImageUtils.validateAndOptimizeImage(categoryData.image);
      } catch (error) {
        throw new BadRequestException(error.message);
      }
    }

    const category = this.categoriesRepository.create(categoryData);
    return this.categoriesRepository.save(category);
  }

  async findAll(): Promise<Categories[]> {
    return this.categoriesRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
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

    // Process image if present
    if (categoryData.image) {
      try {
        categoryData.image = await ImageUtils.validateAndOptimizeImage(categoryData.image);
      } catch (error) {
        throw new BadRequestException(error.message);
      }
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
