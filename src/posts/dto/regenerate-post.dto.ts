import { IsEnum, IsOptional } from 'class-validator';
import { PostStyle } from '../../common/constants/post-style.enum';

export class RegeneratePostDto {
  @IsEnum(PostStyle)
  @IsOptional()
  style?: PostStyle;
}
