import { supabase } from '../config/supabase.js';
import { ChatMessage } from '../models/types.js';

function toMessage(id: string, data: Record<string, unknown>): ChatMessage {
  return { id, ...data } as ChatMessage;
}

export class PostgresChatService {
  async getMessages(rideId: string): Promise<ChatMessage[]> {
    const { data, error } = await supabase
      .from('ride_messages')
      .select('*')
      .eq('ride_id', rideId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];
    return data.map((d) => toMessage(d.id, d));
  }

  async sendMessage(
    rideId: string,
    senderUid: string,
    senderName: string,
    senderPhoto: string | null,
    text: string
  ): Promise<ChatMessage> {
    const messageData = {
      ride_id: rideId,
      sender_uid: senderUid,
      sender_name: senderName,
      sender_photo: senderPhoto,
      text,
    };

    const { data: created, error } = await supabase
      .from('ride_messages')
      .insert(messageData)
      .select()
      .single();

    if (error) throw error;
    return toMessage(created.id, created);
  }

  async canAccessChat(rideId: string, uid: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('rides')
      .select('driver_uid, passenger_uid')
      .eq('id', rideId)
      .single();

    if (error || !data) return false;
    return data.driver_uid === uid || data.passenger_uid === uid;
  }
}
