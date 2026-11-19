import { apiFetch } from "@/lib/api";
import {
  buildConversationSummary,
  normalizeConversationChannel,
  type ConversationChannelSummary,
  type ConversationEntity,
  type ConversationMessageEntity,
} from "@/lib/conversations";

interface ApiEnvelope<T> {
  message?: string;
  statusCode?: number;
  entity?: T;
  data?: T;
  items?: T;
}

export interface TicketMessageDTO {
  id?: number | string;
  source?: string | null;
  interactionType?: string | null;
  messageId?: string | null;
  senderId?: string | null;
  senderName?: string | null;
  profilePic?: string | null;
  profile_pic?: string | null;
  recipientId?: string | null;
  senderType?: string | null;
  message?: string | null;
  reply?: string | null;
  repliedBy?: string | null;
  repliedByUsername?: string | null;
  repliedByFirstName?: string | null;
  repliedAt?: string | null;
  createdAt?: string | null;
  deleted?: boolean | null;
  conversationContinuation?: boolean | null;
  isConversationContinuation?: boolean | null;
}

export interface TicketSentimentDTO {
  id?: number | string;
  messageId?: string | null;
  category?: string | null;
  sentiment?: string | null;
}

export interface TicketSupportDTO {
  id?: number | string;
  username?: string | null;
  ticketNumber?: string | null;
  messageId?: string | null;
  ticketAssignAt?: string | null;
  handOverAt?: string | null;
  deleted?: boolean | null;
}

export interface TicketAiConversationDTO {
  id?: number | string;
  messageId?: string | null;
  lastRepliedAt?: string | null;
  handedOverByAI?: boolean | null;
  handedOverByAi?: boolean | null;
  deleted?: boolean | null;
}

export interface TicketResponseDTO {
  id?: number | string | null;
  ticketNumber: string;
  messageId?: string | null;
  senderId?: string | null;
  ticketStatus?: string | null;
  ticketAssignedTo?: string | null;
  ticketCreatedAt?: string | null;
  ticketUpdatedAt?: string | null;
  ticketClosedAt?: string | null;
  closingRemarks?: string | null;
  ticketClosedBy?: string | null;
  ticketHandoverTime?: string | null;
  ticketHandoverBy?: string | null;
  handoverNote?: string | null;
  requestedServices?: string | null;
  ticketPending?: boolean | null;
  ticketClosed?: boolean | null;
  ticketDeleted?: boolean | null;
  ticketHandedOver?: boolean | null;
  open?: boolean | null;
  closed?: boolean | null;
  queue?: string | null;
  channel?: string | null;
  latestMessageId?: string | null;
  latestMessage?: string | null;
  latestSenderId?: string | null;
  latestSenderName?: string | null;
  profilePic?: string | null;
  profile_pic?: string | null;
  recipientId?: string | null;
  lastMessageAt?: string | null;
  category?: string | null;
  sentiment?: string | null;
  activeSupportAssigned?: boolean | null;
  activeSupportUsername?: string | null;
  activeSupportAssignedAt?: string | null;
  lastSupportUsername?: string | null;
  lastSupportHandOverAt?: string | null;
  lastAnsweredBy?: string | null;
  lastAnsweredAt?: string | null;
  lastAnsweredByAiAgent?: boolean | null;
  messages?: TicketMessageDTO[] | null;
  sentiments?: TicketSentimentDTO[] | null;
  supports?: TicketSupportDTO[] | null;
  aiConversations?: TicketAiConversationDTO[] | null;
}

export interface TicketHandoverQueuesResponseDTO {
  handedOverByAi?: TicketResponseDTO[] | null;
  handedOverByBankSupport?: TicketResponseDTO[] | null;
}

export interface TicketQueues {
  newByChannel: Record<string, TicketResponseDTO[]>;
  handedOverByAi: TicketResponseDTO[];
  handedOverByBankSupport: TicketResponseDTO[];
  activeBankSupport: TicketResponseDTO[];
}

export type TicketQueueKind =
  | "new"
  | "handover_ai"
  | "handover_bank_support"
  | "active_bank_support"
  | "open"
  | "closed"
  | "all";

const unwrapEntity = <T>(data: ApiEnvelope<T> | T): T => {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const envelope = data as ApiEnvelope<T>;
    if ("entity" in envelope || "data" in envelope || "items" in envelope) {
      return (envelope.entity ?? envelope.data ?? envelope.items) as T;
    }
  }

  return data as T;
};

const asArray = <T>(value?: T[] | null): T[] => (Array.isArray(value) ? value : []);

const parseTime = (value?: string | null) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const latestValue = (values: Array<string | null | undefined>) => {
  let bestValue: string | null = null;
  let bestTime = 0;

  values.forEach((value) => {
    const time = parseTime(value);
    if (time >= bestTime && value) {
      bestTime = time;
      bestValue = value;
    }
  });

  return bestValue;
};

const firstByTime = <T>(items: T[], getValue: (item: T) => string | null | undefined) =>
  [...items].sort((first, second) => parseTime(getValue(first)) - parseTime(getValue(second)))[0] ?? null;

const latestByTime = <T>(items: T[], getValue: (item: T) => string | null | undefined) =>
  [...items].sort((first, second) => parseTime(getValue(second)) - parseTime(getValue(first)))[0] ?? null;

const isAiName = (value?: string | null) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["ai", "ai agent", "ai_agent", "ai-agent"].includes(normalized) || normalized.includes("ai");
};

const activeSupport = (ticket: TicketResponseDTO) =>
  latestByTime(
    asArray(ticket.supports).filter((support) => !support.deleted && !support.handOverAt),
    (support) => support.ticketAssignAt
  );

const latestSupport = (ticket: TicketResponseDTO) =>
  latestByTime(
    asArray(ticket.supports).filter((support) => !support.deleted),
    (support) => support.handOverAt ?? support.ticketAssignAt
  );

const latestHandedOverSupport = (ticket: TicketResponseDTO) =>
  latestByTime(
    asArray(ticket.supports).filter((support) => !support.deleted && Boolean(support.handOverAt)),
    (support) => support.handOverAt
  );

const sentimentByMessageId = (ticket: TicketResponseDTO) => {
  const map = new Map<string, TicketSentimentDTO>();

  asArray(ticket.sentiments).forEach((sentiment) => {
    const messageId = String(sentiment.messageId ?? "").trim();
    if (messageId && !map.has(messageId)) {
      map.set(messageId, sentiment);
    }
  });

  return map;
};

const fallbackSentiment = (ticket: TicketResponseDTO) => asArray(ticket.sentiments)[0] ?? null;

const getMessageSentiment = (
  message: TicketMessageDTO | null,
  byMessageId: Map<string, TicketSentimentDTO>,
  fallback: TicketSentimentDTO | null
) => {
  const messageId = String(message?.messageId ?? "").trim();
  return (messageId ? byMessageId.get(messageId) : null) ?? fallback;
};

const ticketStatusForQueue = (queue: TicketQueueKind) => {
  switch (queue) {
    case "handover_ai":
      return "HANDED_OVER";
    case "handover_bank_support":
      return "RETURNED_TO_AI";
    case "active_bank_support":
    case "open":
      return "OPEN";
    case "closed":
      return "CLOSED";
    case "new":
      return "NEW";
    default:
      return "OPEN";
  }
};

const normalizeTicketQueue = (ticket: TicketResponseDTO) => String(ticket.queue ?? "").trim().toUpperCase();

const ticketStatusFromResponse = (ticket: TicketResponseDTO, queue: TicketQueueKind) => {
  const responseQueue = normalizeTicketQueue(ticket);
  const responseStatus = String(ticket.ticketStatus ?? "").trim().toUpperCase();
  if (ticket.closed || ticket.ticketClosed || responseQueue === "CLOSED") return "CLOSED";
  if (
    responseStatus === "RETURNED_TO_AI" ||
    responseQueue === "HANDED_OVER_BANK_SUPPORT" ||
    queue === "handover_bank_support"
  ) {
    return "RETURNED_TO_AI";
  }
  if (responseQueue.includes("HANDED_OVER")) return "HANDED_OVER";
  if (responseQueue === "ACTIVE_BANK_SUPPORT") return ticket.ticketStatus || "OPEN";
  if (responseQueue === "NEW") return "NEW";
  return ticket.ticketStatus || ticketStatusForQueue(queue);
};

const conversationQueueForTicket = (queue: TicketQueueKind): ConversationEntity["ticketQueue"] => {
  if (queue === "handover_ai" || queue === "handover_bank_support") return "handover";
  if (queue === "active_bank_support") return "active";
  if (queue === "new" || queue === "open" || queue === "closed" || queue === "all") return queue;
  return null;
};

const conversationQueueFromResponse = (
  ticket: TicketResponseDTO,
  queue: TicketQueueKind
): ConversationEntity["ticketQueue"] => {
  const responseQueue = normalizeTicketQueue(ticket);
  if (responseQueue === "CLOSED") return "closed";
  if (responseQueue.includes("HANDED_OVER")) return "handover";
  if (responseQueue === "ACTIVE_BANK_SUPPORT") return "active";
  if (responseQueue === "NEW") return "new";
  return conversationQueueForTicket(queue);
};

const handoverSourceForQueue = (queue: TicketQueueKind) => {
  if (queue === "handover_ai") return "AI";
  if (queue === "handover_bank_support") return "BANK_SUPPORT";
  return null;
};

const rowOrder = (value?: number | string | null) => {
  const numericValue = Number(value);
  return Number.isNaN(numericValue) ? 0 : numericValue;
};

const replySortTime = (message: TicketMessageDTO) => {
  const receivedTime = parseTime(message.createdAt);
  const repliedTime = parseTime(message.repliedAt);
  if (!repliedTime) return receivedTime;
  if (!receivedTime) return repliedTime;
  return Math.max(repliedTime, receivedTime);
};

export const ticketToConversationMessages = (ticket: TicketResponseDTO): ConversationMessageEntity[] => {
  const sentimentsByMessageId = sentimentByMessageId(ticket);
  const fallback = fallbackSentiment(ticket);
  const ticketNumber = ticket.ticketNumber;

  return asArray(ticket.messages)
    .filter(
      (message) =>
        !message.deleted &&
        (String(message.message ?? "").trim() !== "" || String(message.reply ?? "").trim() !== "")
    )
    .flatMap((message) => {
      const sentiment = getMessageSentiment(message, sentimentsByMessageId, fallback);
      const senderType = String(message.senderType ?? "").trim().toUpperCase();
      if (senderType === "AGENT") {
        const agentMessage: ConversationMessageEntity = {
          id: message.id,
          messageId: message.messageId,
          conversationId: ticketNumber,
          senderType: "AGENT",
          source: message.source,
          channel: message.source,
          senderId: message.repliedByUsername ?? message.senderId,
          senderName: message.repliedByFirstName ?? message.senderName,
          profilePictureUrl: message.profile_pic ?? message.profilePic,
          recipientId: message.recipientId,
          message: message.message,
          repliedBy: message.repliedBy,
          repliedByUsername: message.repliedByUsername,
          repliedByFirstName: message.repliedByFirstName,
          repliedAt: message.repliedAt,
          category: sentiment?.category,
          sentiment: sentiment?.sentiment,
          createdAt: message.createdAt,
        };

        return [
          {
            message: agentMessage,
            sortTime: parseTime(message.createdAt),
            sortOrder: 1,
            rowId: rowOrder(message.id),
          },
        ];
      }

      const customerMessage: ConversationMessageEntity = {
        id: message.id,
        messageId: message.messageId,
        conversationId: ticketNumber,
        senderType: "CUSTOMER",
        source: message.source,
        channel: message.source,
        senderId: message.senderId,
        senderName: message.senderName,
        profilePictureUrl: message.profile_pic ?? message.profilePic,
        recipientId: message.recipientId,
        message: message.message,
        category: sentiment?.category,
        sentiment: sentiment?.sentiment,
        createdAt: message.createdAt,
      };

      if (!String(message.reply ?? "").trim()) {
        return [
          {
            message: customerMessage,
            sortTime: parseTime(message.createdAt),
            sortOrder: 0,
            rowId: rowOrder(message.id),
          },
        ];
      }

      const replyMessage: ConversationMessageEntity = {
        id: `${message.id ?? message.messageId ?? ticketNumber}-reply`,
        messageId: `${message.messageId ?? message.id ?? ticketNumber}-reply`,
        conversationId: ticketNumber,
        senderType: "AGENT",
        source: message.source,
        channel: message.source,
        senderId: message.repliedBy || "Agent",
        senderName: message.repliedBy || "Agent",
        profilePictureUrl: message.profile_pic ?? message.profilePic,
        recipientId: message.senderId,
        message: message.reply,
        repliedBy: message.repliedBy,
        repliedByUsername: message.repliedByUsername ?? message.repliedBy,
        repliedByFirstName: message.repliedByFirstName ?? message.repliedBy,
        repliedAt: message.repliedAt,
        category: sentiment?.category,
        sentiment: sentiment?.sentiment,
        createdAt: message.repliedAt ?? message.createdAt,
      };

      return [
        {
          message: customerMessage,
          sortTime: parseTime(message.createdAt),
          sortOrder: 0,
          rowId: rowOrder(message.id),
        },
        {
          message: replyMessage,
          sortTime: replySortTime(message),
          sortOrder: 1,
          rowId: rowOrder(message.id),
        },
      ];
    })
    .sort(
      (first, second) =>
        first.sortTime - second.sortTime ||
        first.rowId - second.rowId ||
        first.sortOrder - second.sortOrder
    )
    .map((item) => item.message);
};

export const ticketToConversation = (
  ticket: TicketResponseDTO,
  queue: TicketQueueKind = "all"
): ConversationEntity => {
  const messages = asArray(ticket.messages).filter(
    (message) =>
      !message.deleted &&
      (String(message.message ?? "").trim() !== "" || String(message.reply ?? "").trim() !== "")
  );
  const threadMessages = ticketToConversationMessages(ticket);
  const customerMessages = messages.filter((message) => {
    const senderType = String(message.senderType ?? "").trim().toUpperCase();
    return senderType !== "AGENT" && senderType !== "SYSTEM";
  });
  const firstMessage = firstByTime(customerMessages, (message) => message.createdAt);
  const latestCustomerMessage = latestByTime(customerMessages, (message) => message.createdAt);
  const latestCustomerProfileMessage = latestByTime(
    customerMessages.filter((message) => String(message.profilePic ?? message.profile_pic ?? "").trim()),
    (message) => message.createdAt
  );
  const latestRepliedMessage = latestByTime(
    messages.filter((message) => String(message.reply ?? "").trim()),
    (message) => message.repliedAt ?? message.createdAt
  );
  const latestAiConversation = latestByTime(
    asArray(ticket.aiConversations).filter((conversation) => !conversation.deleted),
    (conversation) => conversation.lastRepliedAt
  );
  const support = activeSupport(ticket);
  const handoverSupport = latestHandedOverSupport(ticket);
  const anySupport = latestSupport(ticket);
  const sentimentsByMessageId = sentimentByMessageId(ticket);
  const latestSentiment = getMessageSentiment(latestCustomerMessage, sentimentsByMessageId, fallbackSentiment(ticket));
  // The queue describes the handover direction; ticketHandoverBy may contain
  // the individual agent username and must not replace that semantic value.
  const handoverSource = handoverSourceForQueue(queue) ?? ticket.ticketHandoverBy;
  const source = ticket.channel ?? firstMessage?.source ?? latestCustomerMessage?.source ?? null;
  const normalizedChannel = normalizeConversationChannel(source);
  const lastMessageAt =
    latestValue([
      latestCustomerMessage?.createdAt,
      latestRepliedMessage?.repliedAt,
      latestAiConversation?.lastRepliedAt,
      support?.ticketAssignAt,
      handoverSupport?.handOverAt,
      anySupport?.ticketAssignAt,
      ticket.ticketUpdatedAt,
      ticket.ticketCreatedAt,
    ]) ?? ticket.lastMessageAt;
  const latestReplyBy = ticket.lastAnsweredBy ?? latestRepliedMessage?.repliedBy ?? null;
  const handedOverByAi = handoverSource === "AI" || Boolean(latestAiConversation?.handedOverByAI ?? latestAiConversation?.handedOverByAi);
  const handedOverByUsername =
    handoverSource === "AI"
      ? "AI"
      : handoverSource === "BANK_SUPPORT"
      ? ticket.lastSupportUsername ?? handoverSupport?.username ?? "BANK_SUPPORT"
      : null;
  const activeUsername = ticket.activeSupportUsername ?? support?.username ?? ticket.ticketAssignedTo ?? null;

  return {
    id: ticket.ticketNumber,
    conversationId: ticket.ticketNumber,
    ticketNumber: ticket.ticketNumber,
    ticketQueue: conversationQueueFromResponse(ticket, queue),
    ticketHandoverSource: handoverSource,
    source: normalizedChannel ?? source,
    channel: normalizedChannel ?? source,
    status: ticketStatusFromResponse(ticket, queue),
    category: ticket.category ?? latestSentiment?.category,
    sentiment: ticket.sentiment ?? latestSentiment?.sentiment,
    senderId: ticket.senderId ?? ticket.latestSenderId ?? firstMessage?.senderId ?? latestCustomerMessage?.senderId,
    senderName: firstMessage?.senderName ?? latestCustomerMessage?.senderName ?? ticket.latestSenderName,
    profilePictureUrl:
      ticket.profile_pic ??
      ticket.profilePic ??
      latestCustomerProfileMessage?.profile_pic ??
      latestCustomerProfileMessage?.profilePic ??
      firstMessage?.profile_pic ??
      firstMessage?.profilePic,
    recipientId: ticket.recipientId ?? firstMessage?.recipientId ?? latestCustomerMessage?.recipientId,
    assignedAgentUsername: activeUsername,
    handedOverByUsername,
    handedOverFromAiAgent: handedOverByAi,
    lastAnsweredBy: latestReplyBy ?? (handedOverByAi ? "AI" : null),
    lastAnsweredByAiAgent: Boolean(ticket.lastAnsweredByAiAgent) || isAiName(latestReplyBy) || handedOverByAi,
    lastAnsweredAt: ticket.lastAnsweredAt ?? latestRepliedMessage?.repliedAt ?? latestAiConversation?.lastRepliedAt ?? null,
    handedOverAt: ticket.ticketHandoverTime ?? ticket.lastSupportHandOverAt ?? handoverSupport?.handOverAt ?? latestAiConversation?.lastRepliedAt ?? null,
    handoverNote: ticket.handoverNote ?? null,
    closingRemarks: ticket.closingRemarks ?? null,
    ticketClosedBy: ticket.ticketClosedBy ?? null,
    startedAt: ticket.ticketCreatedAt ?? firstMessage?.createdAt ?? latestCustomerMessage?.createdAt ?? null,
    lastMessageAt,
    assignedAt: ticket.activeSupportAssignedAt ?? support?.ticketAssignAt ?? null,
    closedAt: ticket.ticketClosedAt ?? null,
    latestMessage:
      String(ticket.latestMessage ?? "").trim() ||
      String(latestCustomerMessage?.message ?? "").trim() ||
      String(latestRepliedMessage?.reply ?? "").trim() ||
      null,
    message:
      String(ticket.latestMessage ?? "").trim() ||
      String(latestCustomerMessage?.message ?? "").trim() ||
      null,
    lastMessage:
      String(ticket.latestMessage ?? "").trim() ||
      String(latestCustomerMessage?.message ?? "").trim() ||
      null,
    messages: threadMessages,
  };
};

export const ticketQueuesToConversations = (queues: TicketQueues): ConversationEntity[] => {
  const newTickets = Object.values(queues.newByChannel ?? {}).flat();

  return [
    ...newTickets.map((ticket) => ticketToConversation(ticket, "new")),
    ...queues.handedOverByAi.map((ticket) => ticketToConversation(ticket, "handover_ai")),
    ...queues.handedOverByBankSupport.map((ticket) => ticketToConversation(ticket, "handover_bank_support")),
    ...queues.activeBankSupport.map((ticket) => ticketToConversation(ticket, "active_bank_support")),
  ];
};

export const ticketToConversationThread = (
  ticket: TicketResponseDTO,
  queue: TicketQueueKind = "all"
) => {
  const conversation = ticketToConversation(ticket, queue);
  const agentUsernames = Array.from(
    new Set(
      [
        ...asArray(ticket.supports).map((support) => support.username),
        ...asArray(ticket.messages)
          .filter((message) => String(message.senderType ?? "").trim().toUpperCase() === "AGENT")
          .flatMap((message) => [
            message.repliedByUsername,
            message.repliedBy,
            message.senderId,
          ]),
      ]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );

  return {
    conversation,
    messages: conversation.messages ?? [],
    agentUsernames,
    agentCount: agentUsernames.length,
  };
};

export const buildTicketSummary = (conversations: ConversationEntity[]): ConversationChannelSummary[] => {
  const summary = buildConversationSummary(conversations);
  const conversationCountByChannel = new Map<string, number>();

  conversations.forEach((conversation) => {
    const channel = normalizeConversationChannel(conversation.source ?? conversation.channel);
    if (!channel) return;
    conversationCountByChannel.set(channel, (conversationCountByChannel.get(channel) ?? 0) + 1);
  });

  return summary.map((item) => ({
    ...item,
    total: conversationCountByChannel.get(item.channel) ?? item.total,
  }));
};

export const getTicketAssignmentMessageId = (conversation: ConversationEntity) => {
  const customerMessage = (conversation.messages ?? []).find(
    (message) => String(message.senderType ?? "").toUpperCase() === "CUSTOMER" && message.messageId
  );
  return customerMessage?.messageId ?? null;
};

export const TicketsApi = {
  getAllTickets: async () =>
    unwrapEntity(
      await apiFetch<ApiEnvelope<TicketResponseDTO[]> | TicketResponseDTO[]>("/api/v1/tickets")
    ) ?? [],

  getOpenTickets: async () =>
    unwrapEntity(
      await apiFetch<ApiEnvelope<TicketResponseDTO[]> | TicketResponseDTO[]>("/api/v1/tickets/open")
    ) ?? [],

  getClosedTickets: async () =>
    unwrapEntity(
      await apiFetch<ApiEnvelope<TicketResponseDTO[]> | TicketResponseDTO[]>("/api/v1/tickets/closed")
    ) ?? [],

  getNewTicketsByChannel: async () =>
    unwrapEntity(
      await apiFetch<ApiEnvelope<Record<string, TicketResponseDTO[]>> | Record<string, TicketResponseDTO[]>>(
        "/api/v1/tickets/new"
      )
    ) ?? {},

  getHandedOverTickets: async () => {
    const entity =
      unwrapEntity(
        await apiFetch<ApiEnvelope<TicketHandoverQueuesResponseDTO> | TicketHandoverQueuesResponseDTO>(
          "/api/v1/tickets/handed-over"
        )
      ) ?? {};

    return {
      handedOverByAi: asArray(entity.handedOverByAi),
      handedOverByBankSupport: asArray(entity.handedOverByBankSupport),
    };
  },

  getActiveBankSupportTickets: async () =>
    unwrapEntity(
      await apiFetch<ApiEnvelope<TicketResponseDTO[]> | TicketResponseDTO[]>(
        "/api/v1/tickets/active-bank-support"
      )
    ) ?? [],

  getTicket: async (ticketNumber: string | number) => {
    const ticket = unwrapEntity(
      await apiFetch<ApiEnvelope<TicketResponseDTO> | TicketResponseDTO>(
        `/api/v1/tickets/${encodeURIComponent(String(ticketNumber))}`
      )
    );

    if (!ticket) {
      throw new Error("Ticket not found.");
    }

    return ticket;
  },

  getTicketQueues: async (): Promise<TicketQueues> => {
    const [newByChannel, handedOver, activeBankSupport] = await Promise.all([
      TicketsApi.getNewTicketsByChannel(),
      TicketsApi.getHandedOverTickets(),
      TicketsApi.getActiveBankSupportTickets(),
    ]);

    return {
      newByChannel,
      handedOverByAi: handedOver.handedOverByAi,
      handedOverByBankSupport: handedOver.handedOverByBankSupport,
      activeBankSupport,
    };
  },

  assignNewTicketToBankSupport: (
    ticketNumber: string | number,
    payload: { username: string; messageId?: string | null }
  ) =>
    apiFetch<ApiEnvelope<TicketResponseDTO> | TicketResponseDTO>(
      `/api/v1/tickets/new/${encodeURIComponent(String(ticketNumber))}/assign`,
      {
        method: "POST",
        body: payload,
      }
    ),

  assignHandedOverTicketToBankSupport: (
    ticketNumber: string | number,
    payload: { username: string; messageId?: string | null }
  ) =>
    apiFetch<ApiEnvelope<TicketResponseDTO> | TicketResponseDTO>(
      `/api/v1/tickets/handed-over/${encodeURIComponent(String(ticketNumber))}/assign`,
      {
        method: "POST",
        body: payload,
      }
    ),

  handoverActiveBankSupportTicket: (
    ticketNumber: string | number,
    payload: { messageId?: string | null; handoverBy?: string | null; handoverNote?: string | null } = {}
  ) =>
    apiFetch<ApiEnvelope<TicketResponseDTO> | TicketResponseDTO>(
      `/api/v1/tickets/active-bank-support/${encodeURIComponent(String(ticketNumber))}/handover`,
      {
        method: "POST",
        body: payload,
      }
    ),

  returnTicketToAi: (
    ticketNumber: string | number,
    payload: { messageId?: string | null; handoverBy?: string | null; handoverNote?: string | null } = {}
  ) =>
    apiFetch<ApiEnvelope<TicketResponseDTO> | TicketResponseDTO>(
      `/api/v1/tickets/active-bank-support/${encodeURIComponent(String(ticketNumber))}/return-to-ai`,
      {
        method: "POST",
        body: payload,
      }
    ),

  replyTicket: (
    ticketNumber: string | number,
    payload: { message: string; username?: string | null; firstName?: string | null }
  ) =>
    apiFetch<ApiEnvelope<TicketResponseDTO> | TicketResponseDTO>(
      `/api/v1/tickets/${encodeURIComponent(String(ticketNumber))}/reply`,
      {
        method: "POST",
        body: payload,
      }
    ),

  closeTicket: (
    ticketNumber: string | number,
    payload: { closingRemarks: string; closedBy?: string | null }
  ) =>
    apiFetch<ApiEnvelope<TicketResponseDTO> | TicketResponseDTO>(
      `/api/v1/tickets/${encodeURIComponent(String(ticketNumber))}/close`,
      {
        method: "POST",
        body: payload,
      }
    ),
};
