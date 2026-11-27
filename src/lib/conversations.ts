import { apiFetch } from "@/lib/api";

export type ConversationChannel = "whatsapp" | "facebook" | "x" | "instagram" | "telegram";

export interface ConversationEntity {
  id?: number | string;
  conversationId?: number | string;
  ticketNumber?: string | null;
  ticketQueue?: "new" | "handover" | "active" | "open" | "closed" | "all" | null;
  ticketHandoverSource?: "AI" | "BANK_SUPPORT" | string | null;
  source?: string | null;
  channel?: string | null;
  status?: string | null;
  category?: string | null;
  sentiment?: string | null;
  confidence?: number | string | null;
  senderId?: string | null;
  senderName?: string | null;
  sender_name?: string | null;
  profilePictureUrl?: string | null;
  profilePic?: string | null;
  profile_pic?: string | null;
  recipientId?: string | null;
  assignedAgentId?: number | string | null;
  assigned_agent_id?: number | string | null;
  assignedAgentUsername?: string | null;
  assigned_agent_username?: string | null;
  agentId?: number | string | null;
  assignedTo?: number | string | null;
  handedOverByAgentId?: number | string | null;
  handed_over_by_agent_id?: number | string | null;
  handedOverByUsername?: string | null;
  handed_over_by_username?: string | null;
  handedOverFromAiAgent?: boolean | string | null;
  handed_over_from_ai_agent?: boolean | string | null;
  lastAnsweredBy?: string | null;
  last_answered_by?: string | null;
  lastAnsweredByAgentId?: number | string | null;
  last_answered_by_agent_id?: number | string | null;
  lastAnsweredByUsername?: string | null;
  last_answered_by_username?: string | null;
  lastAnsweredByEmail?: string | null;
  last_answered_by_email?: string | null;
  lastAnsweredByFirstName?: string | null;
  last_answered_by_first_name?: string | null;
  lastAnsweredByLastName?: string | null;
  last_answered_by_last_name?: string | null;
  lastAnsweredByAiAgent?: boolean | string | null;
  last_answered_by_ai_agent?: boolean | string | null;
  lastAnsweredAt?: string | null;
  last_answered_at?: string | null;
  handedOverFromAiAgentAt?: string | null;
  handed_over_from_ai_agent_at?: string | null;
  handedOverFromAiAgentExpiresAt?: string | null;
  handed_over_from_ai_agent_expires_at?: string | null;
  handoverNote?: string | null;
  handover_note?: string | null;
  closingRemarks?: string | null;
  closing_remarks?: string | null;
  ticketClosedBy?: string | null;
  ticket_closed_by?: string | null;
  startedAt?: string | null;
  lastMessageAt?: string | null;
  assignedAt?: string | null;
  handedOverAt?: string | null;
  handed_over_at?: string | null;
  statusUpdatedAt?: string | null;
  pendingSince?: string | null;
  closedAt?: string | null;
  latestMessage?: string | null;
  message?: string | null;
  lastMessage?: string | null;
  messages?: ConversationMessageEntity[];
}

export interface ConversationMessageEntity {
  id?: number | string;
  messageId?: string | null;
  conversationId?: number | string | null;
  senderType?: string | null;
  source?: string | null;
  channel?: string | null;
  senderId?: string | null;
  senderName?: string | null;
  sender_name?: string | null;
  profilePictureUrl?: string | null;
  profilePic?: string | null;
  profile_pic?: string | null;
  recipientId?: string | null;
  message?: string | null;
  body?: string | null;
  text?: string | null;
  content?: string | null;
  reply?: string | null;
  repliedBy?: string | null;
  repliedByUsername?: string | null;
  repliedByFirstName?: string | null;
  repliedAt?: string | null;
  category?: string | null;
  sentiment?: string | null;
  confidence?: number | string | null;
  createdAt?: string | null;
}

export interface ConversationThreadEntity {
  conversation?: ConversationEntity | null;
  messages?: ConversationMessageEntity[];
  agentUsernames?: string[];
  agentCount?: number;
}

export interface ConversationChannelSummary {
  channel: ConversationChannel;
  label: string;
  total: number;
  active?: number;
  unassigned: number;
  statuses: Record<string, number>;
}

export interface ConversationReportsResponse {
  totalCases: number;
  positiveCases: number;
  negativeCases: number;
  neutralCases: number;
  positiveByCategory: CategoryCaseReport[];
  negativeByCategory: CategoryCaseReport[];
  byChannel: ChannelCaseReport[];
  byChannelAndCategory: ChannelCategoryCaseReport[];
  handledByUsernameCategoryChannel: HandledCaseReport[];
}

export interface CategoryCaseReport {
  category: string;
  totalCases: number;
}

export interface ChannelCaseReport {
  channel: string;
  label: string;
  totalCases: number;
  positiveCases: number;
  negativeCases: number;
  neutralCases: number;
}

export interface ChannelCategoryCaseReport extends ChannelCaseReport {
  category: string;
}

export interface HandledCaseReport {
  username: string;
  category: string;
  channel: string;
  label: string;
  totalCases: number;
}

interface ApiEnvelope<T> {
  entity?: T;
  data?: T;
  items?: T;
  conversations?: T;
  messages?: T;
  channels?: T;
}

export const SUPPORTED_CHANNELS: Array<{ id: ConversationChannel; label: string }> = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "facebook", label: "Facebook" },
  { id: "x", label: "X" },
  { id: "instagram", label: "Instagram" },
  { id: "telegram", label: "Telegram" },
];

export const DEFAULT_CONVERSATION_STATUSES = [
  "NEW",
  "ASSIGNED",
  "HANDED_OVER",
  "OPEN",
  "PENDING_CUSTOMER",
  "ESCALATED",
  "RESOLVED",
  "CLOSED",
];

export const ACTIVE_CONVERSATION_STATUSES = [
  "ASSIGNED",
  "OPEN",
  "PENDING_CUSTOMER",
  "ESCALATED",
];

export const normalizeConversationChannel = (value?: string | null): ConversationChannel | null => {
  const normalized = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  if (normalized.includes("whatsapp")) return "whatsapp";
  if (normalized.includes("facebook") || normalized === "fb" || normalized.includes("messenger")) return "facebook";
  if (normalized === "x" || normalized === "xcom" || normalized.includes("twitter")) return "x";
  if (normalized.includes("instagram") || normalized === "ig") return "instagram";
  if (normalized.includes("telegram") || normalized === "tg") return "telegram";
  return null;
};

export const channelLabel = (channel: ConversationChannel) =>
  SUPPORTED_CHANNELS.find((item) => item.id === channel)?.label ?? channel;

export const statusLabel = (status?: string | null) =>
  String(status || "UNKNOWN")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const categoryLabel = (category?: string | null) => {
  const value = String(category || "").trim();
  return value || "Uncategorized";
};

export const getConversationId = (conversation: ConversationEntity) =>
  conversation.id ?? conversation.conversationId;

export const getConversationChannel = (conversation: ConversationEntity) =>
  normalizeConversationChannel(conversation.source ?? conversation.channel);

const firstDisplayText = (...values: Array<unknown>) => {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text.replace(/^(?:"|')|(?:"|')$/g, "").trim();
  }

  return "";
};

const firstCustomerDisplayText = (...values: Array<unknown>) => {
  for (const value of values) {
    const text = firstDisplayText(value);
    if (text && !/^https?:\/\//i.test(text)) return text;
  }

  return "";
};

export const getConversationCustomerLabel = (
  conversation?: ConversationEntity | null,
  latestMessage?: ConversationMessageEntity | null
) =>
  firstCustomerDisplayText(
    conversation?.senderName,
    conversation?.sender_name,
    latestMessage?.senderName,
    latestMessage?.sender_name,
    conversation?.senderId,
    latestMessage?.senderId,
    "Customer"
  );

export const getMessageCustomerLabel = (
  message?: ConversationMessageEntity | null,
  conversation?: ConversationEntity | null
) =>
  firstCustomerDisplayText(
    message?.senderName,
    message?.sender_name,
    conversation?.senderName,
    conversation?.sender_name,
    message?.senderId,
    conversation?.senderId,
    "Customer"
  );

export const getProfilePictureUrl = (
  ...sources: Array<ConversationEntity | ConversationMessageEntity | null | undefined>
) => {
  for (const source of sources) {
    const url = firstDisplayText(source?.profilePictureUrl, source?.profilePic, source?.profile_pic);
    if (url) return url;
  }
  return null;
};

export const getAssignedAgentId = (conversation: ConversationEntity) =>
  conversation.assignedAgentId ??
  conversation.assigned_agent_id ??
  conversation.agentId ??
  conversation.assignedTo ??
  null;

export const getAssignedAgentUsername = (conversation: ConversationEntity) =>
  conversation.assignedAgentUsername ??
  conversation.assigned_agent_username ??
  null;

export const getHandedOverByAgentId = (conversation: ConversationEntity) =>
  conversation.handedOverByAgentId ??
  conversation.handed_over_by_agent_id ??
  null;

export const getHandedOverByUsername = (conversation: ConversationEntity) =>
  conversation.handedOverByUsername ??
  conversation.handed_over_by_username ??
  null;

export const getHandoverNote = (conversation: ConversationEntity) =>
  conversation.handoverNote ??
  conversation.handover_note ??
  null;

export const getHandedOverAt = (conversation: ConversationEntity) =>
  conversation.handedOverAt ??
  conversation.handed_over_at ??
  null;

export const getLastAnsweredBy = (conversation?: ConversationEntity | null) =>
  conversation?.lastAnsweredBy ??
  conversation?.last_answered_by ??
  null;

export const getLastAnsweredAt = (conversation?: ConversationEntity | null) =>
  conversation?.lastAnsweredAt ??
  conversation?.last_answered_at ??
  null;

const booleanFlag = (value: unknown) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return ["true", "1", "yes", "y"].includes(value.trim().toLowerCase());
  return false;
};

export const isAiAgentHandoverActive = (conversation?: ConversationEntity | null, now = new Date()) => {
  if (!conversation) return false;

  const active = booleanFlag(conversation.handedOverFromAiAgent ?? conversation.handed_over_from_ai_agent);
  if (!active) return false;

  const assignedAgentId = getAssignedAgentId(conversation);
  const assignedAgentUsername = getAssignedAgentUsername(conversation);
  const hasAssignedAgent =
    (assignedAgentId !== null && assignedAgentId !== undefined && String(assignedAgentId).trim() !== "") ||
    (assignedAgentUsername !== null &&
      assignedAgentUsername !== undefined &&
      String(assignedAgentUsername).trim() !== "");
  if (hasAssignedAgent || String(conversation.status || "").toUpperCase() !== "HANDED_OVER") return false;

  const expiresAt = conversation.handedOverFromAiAgentExpiresAt ?? conversation.handed_over_from_ai_agent_expires_at;
  if (!expiresAt) return true;

  const expiresAtDate = new Date(expiresAt);
  return Number.isNaN(expiresAtDate.getTime()) || expiresAtDate > now;
};

export const isLastAnsweredByAiAgent = (conversation?: ConversationEntity | null) =>
  booleanFlag(conversation?.lastAnsweredByAiAgent ?? conversation?.last_answered_by_ai_agent);

export const getMessageAnsweredBy = (message?: ConversationMessageEntity | null) => {
  if (!message) return null;

  const firstName = String(message.repliedByFirstName ?? "").trim();
  const username = String(message.repliedByUsername ?? message.senderId ?? "").trim();
  if (firstName && username && firstName.toLowerCase() !== username.toLowerCase()) {
    return `${firstName} (${username})`;
  }

  return firstDisplayText(firstName, message.senderName, message.sender_name, username, message.repliedBy);
};

export const isMessageAnsweredByAiAgent = (message?: ConversationMessageEntity | null) => {
  const senderType = String(message?.senderType ?? "").trim().toUpperCase();
  const senderId = String(message?.senderId ?? "").trim().toLowerCase();
  return senderType === "AGENT" && ["ai", "ai agent", "ai_agent", "ai-agent"].includes(senderId);
};

export const isConversationUnassigned = (conversation: ConversationEntity) => {
  const assignedAgentId = getAssignedAgentId(conversation);
  const assignedAgentUsername = getAssignedAgentUsername(conversation);
  return (
    (assignedAgentId === null || assignedAgentId === undefined || String(assignedAgentId).trim() === "") &&
    (assignedAgentUsername === null ||
      assignedAgentUsername === undefined ||
      String(assignedAgentUsername).trim() === "")
  );
};

export const getConversationStatus = (conversation: ConversationEntity) =>
  String(conversation.status || "UNKNOWN").toUpperCase();

export const isReturnedToAiConversation = (conversation?: ConversationEntity | null) => {
  if (!conversation) return false;
  return (
    getConversationStatus(conversation) === "RETURNED_TO_AI" ||
    String(conversation.ticketHandoverSource ?? "").trim().toUpperCase() === "BANK_SUPPORT"
  );
};

export const getConversationDisplayStatus = (conversation: ConversationEntity) => {
  if (isReturnedToAiConversation(conversation)) return "Returned to AI";
  if (String(conversation.ticketHandoverSource ?? "").trim().toUpperCase() === "AI") {
    return "Handed over to support agent";
  }
  return statusLabel(getConversationStatus(conversation));
};

export const isTerminalConversation = (conversation: ConversationEntity) =>
  ["CLOSED", "RESOLVED"].includes(getConversationStatus(conversation));

export const isNewQueueConversation = (conversation: ConversationEntity) =>
  isConversationUnassigned(conversation) &&
  (getConversationStatus(conversation) === "NEW" ||
    (!isTerminalConversation(conversation) && isLastAnsweredByAiAgent(conversation)));

export const isHandedOverConversation = (conversation: ConversationEntity) =>
  (["HANDED_OVER", "RETURNED_TO_AI"].includes(getConversationStatus(conversation)) ||
    isAiAgentHandoverActive(conversation)) &&
  isConversationUnassigned(conversation);

export const isActiveConversation = (conversation: ConversationEntity) =>
  ACTIVE_CONVERSATION_STATUSES.includes(getConversationStatus(conversation)) &&
  !isAiAgentHandoverActive(conversation) &&
  !isNewQueueConversation(conversation);

export const isPendingCloseEligible = (
  conversation: ConversationEntity,
  now = new Date()
) => {
  if (getConversationStatus(conversation) !== "PENDING_CUSTOMER") return false;

  const pendingStart = conversation.pendingSince ?? conversation.statusUpdatedAt ?? conversation.lastMessageAt;
  if (!pendingStart) return false;

  const pendingDate = new Date(pendingStart);
  if (Number.isNaN(pendingDate.getTime())) return false;

  return now.getTime() - pendingDate.getTime() >= 24 * 60 * 60 * 1000;
};

export const getMessageText = (message: ConversationMessageEntity | ConversationEntity) => {
  const record = message as Record<string, unknown>;
  return String(
    record.message ??
      record.body ??
      record.text ??
      record.content ??
      record.latestMessage ??
      record.lastMessage ??
      ""
  ).trim();
};

const getEnvelopeValue = <T>(data: ApiEnvelope<T> | T): T => {
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const envelope = data as ApiEnvelope<T>;
    return (
      envelope.entity ??
      envelope.data ??
      envelope.items ??
      envelope.conversations ??
      envelope.messages ??
      envelope.channels ??
      (data as T)
    );
  }

  return data as T;
};

export const asArray = <T>(data: unknown): T[] => {
  const value = getEnvelopeValue(data as ApiEnvelope<T[]> | T[]);
  if (Array.isArray(value)) return value as T[];
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["content", "items", "data", "entity", "conversations", "messages", "channels"]) {
      if (Array.isArray(record[key])) return record[key] as T[];
    }
  }
  return [];
};

export const buildConversationSummary = (
  conversations: ConversationEntity[]
): ConversationChannelSummary[] => {
  const summary = new Map<ConversationChannel, ConversationChannelSummary>();

  SUPPORTED_CHANNELS.forEach((channel) => {
    summary.set(channel.id, {
      channel: channel.id,
      label: channel.label,
      total: 0,
      active: 0,
      unassigned: 0,
      statuses: {},
    });
  });

  conversations.forEach((conversation) => {
    const channel = getConversationChannel(conversation);
    if (!channel) return;

    const item = summary.get(channel);
    if (!item) return;

    const status = String(conversation.status || "UNKNOWN").toUpperCase();
    if (!isTerminalConversation(conversation)) item.total += 1;
    if (isActiveConversation(conversation)) item.active = (item.active ?? 0) + 1;
    item.statuses[status] = (item.statuses[status] ?? 0) + 1;
    if (isNewQueueConversation(conversation)) item.unassigned += 1;
  });

  return SUPPORTED_CHANNELS.map((channel) => summary.get(channel.id)!);
};

const participantKey = (value?: string | null) => String(value ?? "").trim().toLowerCase();

const conversationTime = (value?: string | null) => {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
};

const conversationNumericId = (conversation: ConversationEntity) => {
  const value = Number(getConversationId(conversation));
  return Number.isNaN(value) ? null : value;
};

const mirroredConversationGroupKey = (conversation: ConversationEntity) => {
  if (isTerminalConversation(conversation)) return null;

  const channel = getConversationChannel(conversation);
  const senderId = participantKey(conversation.senderId);
  const recipientId = participantKey(conversation.recipientId);
  if (!channel || !senderId || !recipientId || senderId === recipientId) return null;

  const [firstParticipant, secondParticipant] = [senderId, recipientId].sort();
  return `${channel}:${firstParticipant}:${secondParticipant}`;
};

const preferConversationRecord = (current: ConversationEntity, candidate: ConversationEntity) => {
  const currentAssigned = !isConversationUnassigned(current);
  const candidateAssigned = !isConversationUnassigned(candidate);
  if (currentAssigned !== candidateAssigned) return candidateAssigned ? candidate : current;

  const currentStartedAt = conversationTime(current.startedAt);
  const candidateStartedAt = conversationTime(candidate.startedAt);
  if (currentStartedAt !== null && candidateStartedAt !== null && currentStartedAt !== candidateStartedAt) {
    return candidateStartedAt < currentStartedAt ? candidate : current;
  }

  const currentId = conversationNumericId(current);
  const candidateId = conversationNumericId(candidate);
  if (currentId !== null && candidateId !== null && currentId !== candidateId) {
    return candidateId < currentId ? candidate : current;
  }

  const currentLastMessageAt = conversationTime(current.lastMessageAt);
  const candidateLastMessageAt = conversationTime(candidate.lastMessageAt);
  if (
    currentLastMessageAt !== null &&
    candidateLastMessageAt !== null &&
    currentLastMessageAt !== candidateLastMessageAt
  ) {
    return candidateLastMessageAt > currentLastMessageAt ? candidate : current;
  }

  return current;
};

export const dedupeMirroredConversations = (conversations: ConversationEntity[]) => {
  const groupByMirrorKey = new Map<string, ConversationEntity>();
  const passthrough: ConversationEntity[] = [];

  conversations.forEach((conversation) => {
    const key = mirroredConversationGroupKey(conversation);
    if (!key) {
      passthrough.push(conversation);
      return;
    }

    const current = groupByMirrorKey.get(key);
    groupByMirrorKey.set(key, current ? preferConversationRecord(current, conversation) : conversation);
  });

  return [...passthrough, ...groupByMirrorKey.values()];
};

const withQuery = (path: string, params?: Record<string, string | number | undefined | null>) => {
  if (!params) return path;
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      search.set(key, String(value));
    }
  });

  const query = search.toString();
  return query ? `${path}?${query}` : path;
};

export const ConversationsApi = {
  getConversations: (params?: {
    source?: ConversationChannel | string;
    status?: string;
    category?: string;
    assigned?: string;
  }) => apiFetch<ApiEnvelope<ConversationEntity[]> | ConversationEntity[]>(withQuery("/api/conversations", params)),

  getActiveAiAgentConversations: (params?: {
    source?: ConversationChannel | string;
    answeredBy?: string;
  }) =>
    apiFetch<ApiEnvelope<ConversationEntity[]> | ConversationEntity[]>(
      withQuery("/api/conversations/ai-agent/active", params)
    ),

  getSummary: () =>
    apiFetch<ApiEnvelope<ConversationChannelSummary[]> | ConversationChannelSummary[]>(
      "/api/conversations/summary"
    ),

  getReports: (params?: {
    source?: ConversationChannel | string;
    sentiment?: string;
    category?: string;
    username?: string;
    from?: string;
    to?: string;
  }) =>
    apiFetch<ApiEnvelope<ConversationReportsResponse> | ConversationReportsResponse>(
      withQuery("/api/conversations/reports", params)
    ),

  getMessages: (params?: {
    source?: ConversationChannel | string;
    status?: string;
    category?: string;
    conversationId?: string | number;
  }) =>
    apiFetch<ApiEnvelope<ConversationMessageEntity[]> | ConversationMessageEntity[]>(
      withQuery("/api/conversations/messages", params)
    ),

  getThreads: (params?: {
    agentUsername?: string;
    username?: string;
    customerId?: string;
    source?: ConversationChannel | string;
    status?: string;
    category?: string;
    from?: string;
    to?: string;
  }) =>
    apiFetch<ApiEnvelope<ConversationThreadEntity[]> | ConversationThreadEntity[]>(
      withQuery("/api/conversations/threads", params)
    ),

  getThreadSummary: (params?: {
    agentUsername?: string;
    username?: string;
    customerId?: string;
    source?: ConversationChannel | string;
    status?: string;
    category?: string;
    from?: string;
    to?: string;
  }) =>
    apiFetch<ApiEnvelope<ConversationChannelSummary[]> | ConversationChannelSummary[]>(
      withQuery("/api/conversations/threads/summary", params)
    ),

  getAgentThreads: (
    username: string,
    params?: {
      customerId?: string;
      source?: ConversationChannel | string;
      status?: string;
      category?: string;
      from?: string;
      to?: string;
    }
  ) =>
    apiFetch<ApiEnvelope<ConversationThreadEntity[]> | ConversationThreadEntity[]>(
      withQuery(`/api/conversations/agents/${encodeURIComponent(username)}/threads`, params)
    ),

  getCustomerThreads: (
    customerId: string,
    params?: {
      agentUsername?: string;
      username?: string;
      source?: ConversationChannel | string;
      status?: string;
      category?: string;
      from?: string;
      to?: string;
    }
  ) =>
    apiFetch<ApiEnvelope<ConversationThreadEntity[]> | ConversationThreadEntity[]>(
      withQuery(`/api/conversations/customers/${encodeURIComponent(customerId)}/threads`, params)
    ),

  getConversationMessages: (conversationId: string | number) =>
    apiFetch<ApiEnvelope<ConversationMessageEntity[]> | ConversationMessageEntity[]>(
      `/api/conversations/${encodeURIComponent(String(conversationId))}/messages`
    ),

  assignConversation: (
    conversationId: string | number,
    payload?: { assignedAgentId?: string | number | null; assignedAgentUsername?: string | null }
  ) =>
    apiFetch<ApiEnvelope<ConversationEntity> | ConversationEntity>(
      `/api/conversations/${encodeURIComponent(String(conversationId))}/assign`,
      {
        method: "POST",
        body: payload ?? {},
      }
    ),

  markPendingCustomer: (
    conversationId: string | number,
    payload?: { assignedAgentId?: string | number | null; assignedAgentUsername?: string | null }
  ) =>
    apiFetch<ApiEnvelope<ConversationEntity> | ConversationEntity>(
      `/api/conversations/${encodeURIComponent(String(conversationId))}/pending-customer`,
      {
        method: "POST",
        body: payload ?? {},
      }
    ),

  closeConversation: (
    conversationId: string | number,
    payload?: { closingRemarks?: string | null }
  ) =>
    apiFetch<ApiEnvelope<ConversationEntity> | ConversationEntity>(
      `/api/conversations/${encodeURIComponent(String(conversationId))}/close`,
      {
        method: "POST",
        body: payload ?? {},
      }
    ),

  handoverConversation: (
    conversationId: string | number,
    payload?: { note?: string | null }
  ) =>
    apiFetch<ApiEnvelope<ConversationEntity> | ConversationEntity>(
      `/api/conversations/${encodeURIComponent(String(conversationId))}/handover`,
      {
        method: "POST",
        body: payload ?? {},
      }
    ),

  replyConversation: (
    conversationId: string | number,
    payload: { message: string; assignedAgentId?: string | number | null; assignedAgentUsername?: string | null }
  ) =>
    apiFetch<ApiEnvelope<ConversationMessageEntity> | ConversationMessageEntity>(
      `/api/conversations/${encodeURIComponent(String(conversationId))}/reply`,
      {
        method: "POST",
        body: payload,
      }
    ),

  recordAgentAnswer: (
    conversationId: string | number,
    payload: {
      message: string;
      messageId?: string | null;
      answeredBy?: string | null;
      answeredByAgentId?: string | number | null;
      answeredByAiAgent?: boolean | null;
      handover?: boolean | null;
      handedOver?: boolean | null;
      handedOverFromAiAgent?: boolean | null;
      handoverNote?: string | null;
    }
  ) =>
    apiFetch<ApiEnvelope<ConversationMessageEntity> | ConversationMessageEntity>(
      `/api/conversations/${encodeURIComponent(String(conversationId))}/agent-answer`,
      {
        method: "POST",
        body: payload,
      }
    ),

  recordAiConversation: (payload: {
    source: string;
    customerNo?: string | null;
    senderId?: string | null;
    senderName?: string | null;
    customerId?: string | null;
    recipientId?: string | null;
    customerMessageId?: string | null;
    messageId?: string | null;
    customerMessage?: string | null;
    message?: string | null;
    agentAnswerMessageId?: string | null;
    answerMessageId?: string | null;
    agentAnswer?: string | null;
    answer?: string | null;
    answeredBy?: string | null;
    answeredByAgentId?: string | number | null;
    answeredByAiAgent?: boolean | string | null;
    handover?: boolean | string | null;
    handedOver?: boolean | string | null;
    handedOverFromAiAgent?: boolean | string | null;
    handoverNote?: string | null;
    category?: string | null;
    sentiment?: string | null;
    confidence?: number | string | null;
    metrics?: Record<string, unknown> | null;
  }) =>
    apiFetch<ApiEnvelope<ConversationThreadEntity> | ConversationThreadEntity>(
      "/api/conversations/full",
      {
        method: "POST",
        body: payload,
      }
    ),
};
