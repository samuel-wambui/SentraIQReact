import { BadgeProps } from "@/components/ui/badge";
import {
  getAssignedAgentId,
  getAssignedAgentUsername,
  getConversationId,
  getHandedOverByAgentId,
  getHandedOverByUsername,
  getMessageText,
  normalizeConversationChannel,
  statusLabel,
  SUPPORTED_CHANNELS,
} from "@/lib/conversations";
import type {
  ConversationEntity,
  ConversationMessageEntity,
  ConversationChannelSummary,
  ConversationThreadEntity,
} from "@/lib/conversations";

export {
  getHandedOverAt,
  getHandoverNote,
  getLastAnsweredAt,
  getLastAnsweredBy,
  getMessageText,
  isLastAnsweredByAiAgent,
  isPendingCloseEligible,
} from "@/lib/conversations";

export const UNCATEGORIZED_KEY = "__uncategorized";

export type QueueView = "new" | "handover" | "active";
export type SentimentKey = "positive" | "negative" | "neutral";

export interface CategorySummary {
  key: string;
  label: string;
  total: number;
  latestAt?: string | null;
}

export interface SentimentSummary {
  key: SentimentKey;
  label: string;
  description: string;
  total: number;
  latestAt?: string | null;
}

export interface HistoryChannelBucket {
  key: string;
  label: string;
  total: number;
  unassigned: number;
  statuses: Record<string, number>;
}

export const SENTIMENT_FILTERS: Array<Pick<SentimentSummary, "key" | "label" | "description">> = [
  { key: "neutral", label: "Neutral comments", description: "Needs review" },
  { key: "negative", label: "Negative comments", description: "Potential issue" },
  { key: "positive", label: "Positive comments", description: "Good feedback" },
];

export const getCategoryKey = (value?: string | null) => {
  const trimmed = String(value || "").trim();
  return trimmed || UNCATEGORIZED_KEY;
};

export const categoryValueFromKey = (key: string) => (key === UNCATEGORIZED_KEY ? "" : key);

export const normalizeSentimentValue = (value?: string | null): SentimentKey => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.includes("positive")) return "positive";
  if (normalized.includes("negative")) return "negative";
  return "neutral";
};

export const normalizeSentimentFilter = (value?: string | null): SentimentKey | null => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "positive" || normalized === "negative" || normalized === "neutral") {
    return normalized;
  }
  return null;
};

export const sentimentLabel = (sentiment: SentimentKey) =>
  SENTIMENT_FILTERS.find((item) => item.key === sentiment)?.label ?? "Neutral comments";

export const statusBadgeVariant = (status?: string | null): BadgeProps["variant"] => {
  switch (String(status || "").toUpperCase()) {
    case "NEW":
    case "PENDING_CUSTOMER":
      return "warning";
    case "HANDED_OVER":
    case "RETURNED_TO_AI":
      return "secondary";
    case "ESCALATED":
      return "destructive";
    case "RESOLVED":
    case "CLOSED":
      return "secondary";
    case "ASSIGNED":
    case "OPEN":
      return "default";
    default:
      return "outline";
  }
};

export const formatDateTime = (value?: string | null) => {
  if (!value) return "No timestamp";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export const getSortTime = (conversation: ConversationEntity) => {
  const value = conversation.lastMessageAt ?? conversation.startedAt ?? conversation.statusUpdatedAt;
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

export const sortNewestFirst = (items: ConversationEntity[]) =>
  [...items].sort((first, second) => getSortTime(second) - getSortTime(first));

export const getConversationSentimentKey = (conversation: ConversationEntity) =>
  normalizeSentimentValue(conversation.sentiment);

export const getMessageSentimentKey = (message: ConversationMessageEntity) =>
  normalizeSentimentValue(message.sentiment);

export const getMessageConversationId = (message: ConversationMessageEntity) => message.conversationId ?? null;

export const messageCategoryKey = (message: ConversationMessageEntity) => getCategoryKey(message.category);

export const formatPendingCloseTime = (conversation: ConversationEntity) => {
  const pendingStart = conversation.pendingSince ?? conversation.statusUpdatedAt ?? conversation.lastMessageAt;
  if (!pendingStart) return "Close after 24h";
  const pendingDate = new Date(pendingStart);
  if (Number.isNaN(pendingDate.getTime())) return "Close after 24h";
  const availableAt = pendingDate.getTime() + 24 * 60 * 60 * 1000;
  const hoursLeft = Math.max(1, Math.ceil((availableAt - Date.now()) / (60 * 60 * 1000)));
  return `${hoursLeft}h to close`;
};

export const getAgentLabel = (conversation: ConversationEntity) =>
  getAssignedAgentUsername(conversation) ?? getAssignedAgentId(conversation) ?? "Unassigned";

export const getHandoverAgentLabel = (conversation: ConversationEntity) =>
  getHandedOverByUsername(conversation) ?? getHandedOverByAgentId(conversation) ?? null;

export const getChatInitial = (value?: string | null) => {
  const trimmed = String(value || "").trim();
  return (trimmed || "C").slice(0, 1).toUpperCase();
};

export const messageCreatedTime = (message: ConversationMessageEntity) => {
  if (!message.createdAt) return 0;
  const time = new Date(message.createdAt).getTime();
  return Number.isNaN(time) ? 0 : time;
};

export const messageRowOrder = (message: ConversationMessageEntity) => {
  const value = Number(message.id);
  return Number.isNaN(value) ? 0 : value;
};

export const sortMessagesNewestFirst = (messages: ConversationMessageEntity[]) =>
  [...messages].sort(
    (first, second) =>
      messageCreatedTime(second) - messageCreatedTime(first) ||
      messageRowOrder(second) - messageRowOrder(first)
  );

export const isSystemMessage = (message: ConversationMessageEntity) =>
  String(message.senderType || "").toUpperCase() === "SYSTEM";

export const historyStatusSummary = (statuses: Record<string, number>) =>
  Object.entries(statuses)
    .filter(([, total]) => Number(total) > 0)
    .sort(([firstStatus], [secondStatus]) => firstStatus.localeCompare(secondStatus))
    .slice(0, 2)
    .map(([status, total]) => `${statusLabel(status)} ${Number(total)}`)
    .join(" · ");

export const shouldUsePreviewMessage = (
  candidate: ConversationMessageEntity,
  current?: ConversationMessageEntity
) => {
  if (!current) return true;
  const candidateHasText = getMessageText(candidate).length > 0;
  const currentHasText = getMessageText(current).length > 0;
  if (candidateHasText !== currentHasText) return candidateHasText;
  const candidateIsSystem = isSystemMessage(candidate);
  const currentIsSystem = isSystemMessage(current);
  if (candidateIsSystem !== currentIsSystem) return !candidateIsSystem;
  return messageCreatedTime(candidate) >= messageCreatedTime(current);
};

export const conversationIdSet = (conversations: ConversationEntity[]) =>
  new Set(
    conversations
      .map((conversation) => getConversationId(conversation))
      .filter((conversationId) => conversationId !== null && conversationId !== undefined)
      .map((conversationId) => String(conversationId))
  );

export const getChannelBuckets = (historySummary: ConversationChannelSummary[]) => {
  const summaryByChannel = new Map<string, ConversationChannelSummary>();

  historySummary.forEach((item) => {
    const key =
      normalizeConversationChannel(item.channel) ??
      String(item.channel || "")
        .trim()
        .toLowerCase();
    if (key) {
      summaryByChannel.set(key, item);
    }
  });

  const buckets: HistoryChannelBucket[] = SUPPORTED_CHANNELS.map((channel) => {
    const item = summaryByChannel.get(channel.id);
    return {
      key: channel.id,
      label: channel.label,
      total: Number(item?.total ?? 0),
      unassigned: Number(item?.unassigned ?? 0),
      statuses: item?.statuses ?? {},
    };
  });

  historySummary.forEach((item) => {
    const key =
      normalizeConversationChannel(item.channel) ??
      String(item.channel || "")
        .trim()
        .toLowerCase();
    if (!key || SUPPORTED_CHANNELS.some((channel) => channel.id === key)) return;
    buckets.push({
      key,
      label: item.label || key,
      total: Number(item.total ?? 0),
      unassigned: Number(item.unassigned ?? 0),
      statuses: item.statuses ?? {},
    });
  });

  return buckets.filter((bucket) => bucket.total > 0);
};
