import { Injectable, NotFoundException } from '@nestjs/common';
import { User } from './user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(userData: Partial<User>): Promise<User> {
    const user = this.userRepository.create(userData);
    return this.userRepository.save(user);
  }

  async findByEmail(email: string): Promise<User> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User> {
    return this.userRepository.findOne({ where: { id } });
  }

  async editUser(id: string, userData: Partial<User>): Promise<User> {
    if (!id) {
      throw new NotFoundException('User ID is required for updating the user');
    }
    if (userData.password) {
      userData.password = await bcrypt.hash(userData.password, 10);
    }
    const updateResult = await this.userRepository.update(id, userData);
    if (updateResult.affected === 0) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    return this.userRepository.findOne({ where: { id } });
  }
}
