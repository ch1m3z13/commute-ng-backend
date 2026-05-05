import { featureFlags } from '../config/featureFlags.js';
import { ChatService as FirestoreChatService, chatService as firestoreChatService } from './chatService.firestore.js';
import { PostgresChatService } from './chatService.postgres.js';

function createChatService() {
  if (featureFlags.database.provider === 'postgres') {
    return new PostgresChatService();
  }
  return new FirestoreChatService();
}

export const chatService = createChatService();
export { ChatService } from './chatService.firestore.js';
