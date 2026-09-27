import { Controller, Get, Headers, Param, Query } from '@nestjs/common';
import { JobsService } from './jobs.service';

function requireUserId(header: string | undefined): string {
  if (!header) throw new Error('Missing x-user-id header');
  return header;
}

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get('matches')
  matches(
    @Headers('x-user-id') userId: string,
    @Query('scanId') scanId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.jobs.findMatchesForUser(requireUserId(userId), {
      scanId,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.jobs.findJobForUser(id);
  }
}
