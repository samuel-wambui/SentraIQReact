import { apiFetch } from "@/lib/api";

interface ApiEnvelope<T> {
  entity?: T;
  data?: T;
  items?: T;
}

export interface MessageInteractionDTO {
  source?: string | null;
  interactionType?: string | null;
  url?: string | null;
  recipientId?: string | null;
  senderId?: string | null;
  senderName?: string | null;
  commentId?: string | null;
  comment?: string | null;
  category?: string | null;
  sentiment?: string | null;
  confidence?: number | null;
  receivedAt?: string | null;
}

const unwrapInteractions = (
  response: ApiEnvelope<MessageInteractionDTO[]> | MessageInteractionDTO[]
) => {
  if (Array.isArray(response)) return response;
  return response.entity ?? response.data ?? response.items ?? [];
};

export const MessageInteractionsApi = {
  getInteractions: async () =>
    unwrapInteractions(
      await apiFetch<ApiEnvelope<MessageInteractionDTO[]> | MessageInteractionDTO[]>(
        "/api/v1/messages/interactions"
      )
    ),
};
