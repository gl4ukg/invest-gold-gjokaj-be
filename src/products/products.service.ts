import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Products } from './products.entity';
import { Categories } from '../categories/categories.entity';
import { Repository, Like, Between, ILike } from 'typeorm';
import { ImageUtils } from '../utils/image.utils';
import { SearchProductsDto, SortOrder } from './dto/search-products.dto';
import { FilterProductsDto, SortBy } from './dto/filter-products.dto';

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

    if (productData.images && Array.isArray(productData.images)) {
      try {
        const optimizedImages = await Promise.all(
          productData.images.map((image) =>
            ImageUtils.validateAndOptimizeImage(image),
          ),
        );
        productData.images = optimizedImages;
      } catch (error) {
        throw new BadRequestException(error.message);
      }
    } else if (productData.images) {
      throw new BadRequestException('Images must be provided as an array');
    }

    if (typeof productData.description === 'string') {
      productData.description = {
        en: productData.description,
        de: productData.description,
        sq: productData.description,
      };
    }

    const product = this.productsRepository.create({
      ...productData,
      category,
    });
    return this.productsRepository.save(product);
  }

  async findAll(): Promise<Products[]> {
    return this.productsRepository.find({
      relations: ['category'],
      order: {
        createdAt: 'ASC',
      },
    });
  }

  async search(searchDto: SearchProductsDto) {
    const {
      query,
      categoryIds,
      sortBy,
      sortOrder,
      page = 1,
      limit = 10,
    } = searchDto;

    const queryBuilder = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category');

    if (query) {
      queryBuilder.andWhere(
        '(LOWER(product.name) LIKE LOWER(:search) OR ' +
          'LOWER(COALESCE(' +
          'CASE ' +
          "WHEN jsonb_typeof(product.description) = 'string' " +
          "THEN product.description#>>'{}' " +
          "ELSE CONCAT_WS(' ', " +
          "  product.description->>'en', " +
          "  product.description->>'de', " +
          "  product.description->>'sq' " +
          ') ' +
          'END, ' +
          "''" +
          ')) LIKE LOWER(:search))',
        { search: `%${query}%` },
      );
    }

    if (categoryIds && categoryIds.length > 0) {
      const validCategoryIds = categoryIds.filter((id) => {
        try {
          const cleanId = id.trim();
          return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            cleanId,
          );
        } catch {
          return false;
        }
      });

      if (validCategoryIds.length === 0) {
        return {
          items: [],
          meta: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        };
      }

      queryBuilder.andWhere('category.id IN (:...categoryIds)', {
        categoryIds: validCategoryIds,
      });
    }

    switch (sortBy) {
      case SortBy.NAME:
        queryBuilder.orderBy('product.name', sortOrder);
        break;
      case SortBy.STOCK:
        queryBuilder.orderBy('product.stock', sortOrder);
        break;
      case SortBy.CREATED_AT:
      default:
        queryBuilder.orderBy('product.createdAt', sortOrder);
    }

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [items, total] = await queryBuilder.getManyAndCount();

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async filterProducts(filterDto: FilterProductsDto) {
    const { categoryIds, sortBy, sortOrder, page = 1, limit = 10 } = filterDto;

    const queryBuilder = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category');

    if (categoryIds && categoryIds.length > 0) {
      queryBuilder.where('category.id IN (:...categoryIds)', { categoryIds });
    }

    if (sortBy === SortBy.NAME) {
      queryBuilder.orderBy('product.name', sortOrder);
    } else if (sortBy === SortBy.CREATED_AT) {
      queryBuilder.orderBy('product.createdAt', sortOrder);
    }

    // Add pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [products, total] = await queryBuilder.getManyAndCount();

    return {
      items: products,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string | number): Promise<Products> {
    let product: Products;

    if (typeof id === 'number' || /^\d+$/.test(id)) {
      const numericId = parseInt(id.toString(), 10);
      product = await this.productsRepository.findOne({
        where: { numericId },
        relations: ['category'],
      });

      if (!product && typeof id === 'string') {
        product = await this.productsRepository.findOne({
          where: { id },
          relations: ['category'],
        });
      }
    } else if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
      product = await this.productsRepository.findOne({
        where: { id },
        relations: ['category'],
      });
    } else {
      throw new BadRequestException('Invalid product ID format');
    }

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return product;
  }

  async update(id: string, productData: Partial<Products>): Promise<Products> {
    if (productData.images && Array.isArray(productData.images)) {
      try {
        const optimizedImages = await Promise.all(
          productData.images.map((image) =>
            ImageUtils.validateAndOptimizeImage(image),
          ),
        );
        productData.images = optimizedImages;
      } catch (error) {
        throw new BadRequestException(error.message);
      }
    } else if (productData.images) {
      throw new BadRequestException('Images must be provided as an array');
    }

    if (typeof productData.description === 'string') {
      productData.description = {
        en: productData.description,
        de: productData.description,
        sq: productData.description,
      };
    }

    const updateResult = await this.productsRepository.update(id, productData);
    if (updateResult.affected === 0) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    if (
      !id ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      throw new BadRequestException('Invalid product ID format');
    }

    const product = await this.findOne(id);

    await this.productsRepository.remove(product);
  }
}
