import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('blogs')
export class Blog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'jsonb' })
  title: {
    en: string;
    de: string;
    al: string;
  };

  @Column({ type: 'jsonb' })
  content: {
    en: string;
    de: string;
    al: string;
  };

  @Column({ type: 'varchar', length: 255 })
  slug: string;

  @Column({ nullable: true })
  image: string;

  @Column({ type: 'jsonb', nullable: true })
  metaDescription: {
    en: string;
    de: string;
    al: string;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
