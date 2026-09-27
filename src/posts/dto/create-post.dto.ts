import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PostStyle } from '../../common/constants/post-style.enum';

export class CreatePostDto {
  @IsUUID()
  @IsOptional()
  learningNoteId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  content!: string;

  @IsEnum(PostStyle)
  @IsOptional()
  style?: PostStyle;
}
