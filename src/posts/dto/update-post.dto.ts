import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdatePostDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  @IsOptional()
  content?: string;
}
