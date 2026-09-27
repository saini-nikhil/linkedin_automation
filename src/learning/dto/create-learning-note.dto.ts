import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateLearningNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content!: string;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  topic?: string;
}
