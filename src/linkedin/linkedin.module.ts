import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OAuthState } from './entities/oauth-state.entity';
import { LinkedInClient } from './linkedin.client';
import { LinkedInOAuthService } from './linkedin.oauth.service';
import { LinkedInService } from './linkedin.service';
import { LinkedInController } from './linkedin.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([OAuthState]), UsersModule],
  controllers: [LinkedInController],
  providers: [LinkedInClient, LinkedInOAuthService, LinkedInService],
  exports: [LinkedInService, LinkedInClient, LinkedInOAuthService],
})
export class LinkedInModule {}
