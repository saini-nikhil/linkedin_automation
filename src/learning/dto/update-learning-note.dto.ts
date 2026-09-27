import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateLearningNoteDto {
  @IsString()
  @MaxLength(5000)
  @IsOptional()
  content?: string;

  @IsString()
  @MaxLength(255)
  @IsOptional()
  topic?: string;
}
