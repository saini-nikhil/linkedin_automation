import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module';
import { Person } from './entities/person.entity';
import { NetworkMatch } from './entities/network-match.entity';
import { ConnectionMessage } from './entities/connection-message.entity';
import { NetworkingService } from './networking.service';
import { NetworkingMatcherService } from './networking-matcher.service';
import { NetworkingMessageService } from './networking-message.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Person, NetworkMatch, ConnectionMessage]),
    AiModule,
  ],
  providers: [
    NetworkingService,
    NetworkingMatcherService,
    NetworkingMessageService,
  ],
  exports: [NetworkingService, NetworkingMatcherService, NetworkingMessageService],
})
export class NetworkingModule {}
