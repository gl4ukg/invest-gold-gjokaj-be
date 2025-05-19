import * as sharp from 'sharp';
import { BadRequestException } from '@nestjs/common';

export class ImageUtils {
  static readonly MAX_IMAGE_SIZE_MB = 2; // Maximum 2MB
  static readonly MAX_DIMENSION = 800; // Maximum width/height of 800px
  static readonly COMPRESSION_QUALITY = 80; // 80% quality for JPEG

  static async validateAndOptimizeImage(base64Image: string): Promise<string> {
    // Validate image format
    if (!base64Image || !base64Image.startsWith('data:image/')) {
      throw new BadRequestException('Invalid image format. Must be a base64 image string.');
    }

    // Extract image data and format
    const matches = base64Image.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      throw new BadRequestException('Invalid image format');
    }

    const imageFormat = matches[1];
    const imageData = Buffer.from(matches[2], 'base64');

    // Check file size (before compression)
    const sizeMB = imageData.length / (1024 * 1024);
    if (sizeMB > this.MAX_IMAGE_SIZE_MB) {
      throw new BadRequestException(
        `Image size exceeds ${this.MAX_IMAGE_SIZE_MB}MB limit. Please upload a smaller image.`,
      );
    }

    try {
      // Process image with sharp
      const image = sharp(imageData);
      const metadata = await image.metadata();

      // Resize if image is too large
      if (metadata.width > this.MAX_DIMENSION || metadata.height > this.MAX_DIMENSION) {
        image.resize(this.MAX_DIMENSION, this.MAX_DIMENSION, {
          fit: 'inside',
          withoutEnlargement: true,
        });
      }

      // Process image based on original format
      let optimizedBuffer;
      let outputFormat = imageFormat;
      
      // Preserve format for images that support transparency
      if (['png', 'webp', 'avif'].includes(imageFormat)) {
        switch (imageFormat) {
          case 'png':
            optimizedBuffer = await image
              .png({
                compressionLevel: 9,
                palette: true
              })
              .toBuffer();
            break;
          case 'webp':
            optimizedBuffer = await image
              .webp({
                quality: this.COMPRESSION_QUALITY,
                lossless: true // Preserve transparency
              })
              .toBuffer();
            break;
          case 'avif':
            optimizedBuffer = await image
              .avif({
                quality: this.COMPRESSION_QUALITY,
                lossless: true // Preserve transparency
              })
              .toBuffer();
            break;
        }
      } else {
        // For formats without transparency, convert to WebP with lossy compression
        optimizedBuffer = await image
          .webp({
            quality: this.COMPRESSION_QUALITY,
            lossless: false
          })
          .toBuffer();
        outputFormat = 'webp';
      }

      // Convert back to base64
      const optimizedBase64 = `data:image/${outputFormat};base64,${optimizedBuffer.toString('base64')}`;

      // Validate final size
      const finalSizeMB = optimizedBuffer.length / (1024 * 1024);
      if (finalSizeMB > this.MAX_IMAGE_SIZE_MB) {
        throw new BadRequestException(
          `Image is too large even after compression. Please use a smaller image.`,
        );
      }

      return optimizedBase64;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException('Error processing image. Please try again with a different image.');
    }
  }

  static getImageSizeInMB(base64Image: string): number {
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    return buffer.length / (1024 * 1024);
  }
}
