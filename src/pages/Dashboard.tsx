import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  CircleAlert,
  Frown,
  Loader2,
  Meh,
  MessageSquareText,
  RefreshCw,
  Smile,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChannelIcon } from "@/components/messages/ChannelIcon";
import { CustomerAvatar } from "@/components/messages/CustomerAvatar";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  getAssignedAgentUsername,
  getMessageCustomerLabel,
  isAiAgentHandoverActive,
  isHandedOverConversation,
  isLastAnsweredByAiAgent,
  isNewQueueConversation,
  normalizeConversationChannel,
  SUPPORTED_CHANNELS,
  type ConversationChannel,
} from "@/lib/conversations";
import { MessageInteractionsApi, type MessageInteractionDTO } from "@/lib/interactions";
import { ticketToConversation, TicketsApi, type TicketMessageDTO, type TicketResponseDTO } from "@/lib/tickets";

type Sentiment = "positive" | "neutral" | "negative";
type Period = "7d" | "30d" | "90d";
type InteractionType = "COMMENT" | "MENTION" | "DIRECT_MESSAGE";
type DashboardView = "comments" | "mentions" | "directMessages";

interface DashboardInteraction {
  id: string;
  ticketNumber: string | null;
  queueView: "new" | "active" | "handover" | null;
  channel: ConversationChannel;
  interactionType: InteractionType | null;
  handlingLabel: string;
  handedOverByAi: boolean;
  customer: string;
  profilePictureUrl: string | null;
  text: string;
  time: number;
  sentiment: Sentiment | null;
  category: string;
  sourceUrl: string | null;
}

interface CategoryRow {
  category: string;
  total: number;
  positive: number;
  neutral: number;
  negative: number;
}

interface ChannelRow {
  channel: ConversationChannel;
  label: string;
  total: number;
  positive: number;
  neutral: number;
  negative: number;
}

const SENTIMENT_COLORS: Record<Sentiment, string> = {
  positive: "#16a34a",
  neutral: "#eab308",
  negative: "#ef4444",
};

const PERIOD_DAYS: Record<Period, number> = { "7d": 7, "30d": 30, "90d": 90 };
const PERIOD_LABELS: Record<Period, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
};

const DASHBOARD_CHANNELS = SUPPORTED_CHANNELS;
const COMMENT_CHANNELS = new Set<ConversationChannel>(["facebook", "x", "instagram"]);
const DASHBOARD_VIEWS: Array<{ id: DashboardView; label: string }> = [
  { id: "comments", label: "Comments" },
  { id: "mentions", label: "Mentions" },
  { id: "directMessages", label: "Direct Messages" },
];

const formatNumber = (value: number) => value.toLocaleString();

const formatPercent = (value: number, total: number) =>
  total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "0%";

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const normalizeSentiment = (value?: string | null): Sentiment | null => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized.startsWith("pos")) return "positive";
  if (normalized.startsWith("neg")) return "negative";
  if (normalized.startsWith("neu")) return "neutral";
  return null;
};

const normalizeInteractionType = (value?: string | null): InteractionType | null => {
  const normalized = String(value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (["COMMENT", "NORMAL_COMMENT", "POST_COMMENT"].includes(normalized)) return "COMMENT";
  if (normalized === "MENTION") return "MENTION";
  if (["DIRECT_MESSAGE", "DM", "PRIVATE_MESSAGE"].includes(normalized)) return "DIRECT_MESSAGE";
  return null;
};

const getInteractionTypeLabel = (interaction: DashboardInteraction) => {
  if (interaction.interactionType === "COMMENT") return "Comment";
  if (interaction.interactionType === "MENTION") return "Mention";
  return "Direct message";
};

const normalizeHttpUrl = (value?: string | null) => {
  const candidate = String(value ?? "").trim();
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
};

const getInteractionCustomer = (interaction: MessageInteractionDTO) => {
  const senderName = String(interaction.senderName ?? "").trim();
  if (senderName && !normalizeHttpUrl(senderName)) return senderName;
  return String(interaction.senderId ?? "").trim() || "Customer";
};

const getSocialDashboardInteractions = (
  response: MessageInteractionDTO[]
): DashboardInteraction[] => {
  const interactions = new Map<string, DashboardInteraction>();

  response.forEach((item) => {
    const channel = normalizeConversationChannel(item.source);
    const interactionType = normalizeInteractionType(item.interactionType);
    const text = String(item.comment ?? "").trim();
    const time = item.receivedAt ? new Date(item.receivedAt).getTime() : Number.NaN;
    if (
      !channel ||
      !COMMENT_CHANNELS.has(channel) ||
      !interactionType ||
      interactionType === "DIRECT_MESSAGE" ||
      !text ||
      Number.isNaN(time)
    ) {
      return;
    }

    const recordId = String(item.commentId ?? "").trim() || `${time}-${text}`;
    const id = `social:${channel}:${interactionType}:${recordId}`;
    if (interactions.has(id)) return;

    interactions.set(id, {
      id,
      ticketNumber: null,
      queueView: null,
      channel,
      interactionType,
      handlingLabel: "Social interaction",
      handedOverByAi: false,
      customer: getInteractionCustomer(item),
      profilePictureUrl: null,
      text,
      time,
      sentiment: normalizeSentiment(item.sentiment),
      category: String(item.category ?? "").trim(),
      sourceUrl: normalizeHttpUrl(item.url),
    });
  });

  return [...interactions.values()];
};

const getDashboardInteractions = (tickets: TicketResponseDTO[]): DashboardInteraction[] => {
  const interactions = new Map<string, DashboardInteraction>();

  tickets.forEach((ticket) => {
    const conversation = ticketToConversation(ticket);
    const supportName = getAssignedAgentUsername(conversation) ?? ticket.activeSupportUsername ?? ticket.ticketAssignedTo;
    const handedOverByAi = Boolean(conversation.handedOverFromAiAgent);
    const queueView = isHandedOverConversation(conversation)
      ? "handover"
      : isNewQueueConversation(conversation)
      ? "new"
      : "active";
    const handlingLabel = supportName
      ? `Support · ${supportName}`
      : isAiAgentHandoverActive(conversation) || isLastAnsweredByAiAgent(conversation)
      ? "AI engaged"
      : "Waiting for support";
    const sentiments = new Map<string, { sentiment?: string | null; category?: string | null }>();
    (ticket.sentiments ?? []).forEach((item) => {
      const messageId = String(item.messageId ?? "").trim();
      if (messageId && !sentiments.has(messageId)) {
        sentiments.set(messageId, item);
      }
    });

    (ticket.messages ?? []).forEach((message: TicketMessageDTO) => {
      if (message.deleted) return;
      const senderType = String(message.senderType ?? "").toUpperCase();
      if (senderType === "AGENT" || senderType === "SYSTEM") return;

      const channel = normalizeConversationChannel(message.source ?? ticket.channel);
      const text = String(message.message ?? "").trim();
      const time = message.createdAt ? new Date(message.createdAt).getTime() : Number.NaN;
      if (!channel || !text || Number.isNaN(time)) return;

      const messageId = String(message.messageId ?? "").trim();
      const sentimentRecord = sentiments.get(messageId);
      const isLatestMessage = Boolean(messageId && messageId === ticket.latestMessageId);
      const sentiment = normalizeSentiment(sentimentRecord?.sentiment ?? (isLatestMessage ? ticket.sentiment : null));
      const category = String(sentimentRecord?.category ?? (isLatestMessage ? ticket.category : "") ?? "").trim();
      const interactionType =
        normalizeInteractionType(message.interactionType) ??
        (["whatsapp", "telegram"].includes(channel) ? "DIRECT_MESSAGE" : null);
      const recordId = message.id ?? messageId ?? `${ticket.ticketNumber}-${time}-${text}`;
      const id = `${channel}:${recordId}`;

      if (!interactions.has(id)) {
        interactions.set(id, {
          id,
          ticketNumber: ticket.ticketNumber,
          queueView,
          channel,
          interactionType,
          handlingLabel,
          handedOverByAi,
          customer: getMessageCustomerLabel(message, conversation),
          profilePictureUrl: conversation.profilePictureUrl ?? null,
          text,
          time,
          sentiment,
          category,
          sourceUrl: null,
        });
      }
    });
  });

  return [...interactions.values()];
};

const Panel = ({
  title,
  note,
  children,
  className = "",
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <section className={`min-w-0 overflow-hidden rounded-md border border-[#26344a] bg-[#111b2b] ${className}`}>
    <div className="flex min-h-10 items-center justify-between gap-3 border-b border-[#26344a] px-3 py-2">
      <h2 className="truncate text-xs font-semibold text-slate-100">{title}</h2>
      {note && <span className="shrink-0 text-[10px] text-slate-400">{note}</span>}
    </div>
    <div className="p-3">{children}</div>
  </section>
);

const EmptyPanel = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-36 items-center justify-center px-4 text-center text-xs text-slate-400">
    {children}
  </div>
);

const Dashboard = () => {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>("7d");
  const [view, setView] = useState<DashboardView>("directMessages");
  const [expandedSentiment, setExpandedSentiment] = useState<Sentiment | null>(null);
  const [tickets, setTickets] = useState<TicketResponseDTO[]>([]);
  const [socialInteractions, setSocialInteractions] = useState<MessageInteractionDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const loadDashboard = useCallback(async () => {
    if (!accessToken) {
      setTickets([]);
      setSocialInteractions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [ticketsResult, interactionsResult] = await Promise.allSettled([
        TicketsApi.getAllTickets(),
        MessageInteractionsApi.getInteractions(),
      ]);
      const loadErrors: string[] = [];

      if (ticketsResult.status === "fulfilled") {
        setTickets(ticketsResult.value.filter((ticket) => !ticket.ticketDeleted));
      } else {
        loadErrors.push(
          ticketsResult.reason instanceof Error
            ? `Direct messages: ${ticketsResult.reason.message}`
            : "Unable to load direct messages."
        );
      }

      if (interactionsResult.status === "fulfilled") {
        setSocialInteractions(interactionsResult.value);
      } else {
        loadErrors.push(
          interactionsResult.reason instanceof Error
            ? `Comments and mentions: ${interactionsResult.reason.message}`
            : "Unable to load comments and mentions."
        );
      }

      if (loadErrors.length === 2) {
        throw new Error(loadErrors.join(" "));
      }

      setError(loadErrors.length ? loadErrors.join(" ") : null);
      setUpdatedAt(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const data = useMemo(() => {
    const days = PERIOD_DAYS[period];
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days + 1);
    const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const startTime = start.getTime();
    const endTime = end.getTime();
    const ticketInteractions = getDashboardInteractions(tickets).filter(
      (interaction) => interaction.interactionType === "DIRECT_MESSAGE"
    );
    const periodInteractions = [
      ...getSocialDashboardInteractions(socialInteractions),
      ...ticketInteractions,
    ].filter((interaction) => interaction.time >= startTime && interaction.time < endTime);
    const selectedInteractionType: InteractionType =
      view === "comments" ? "COMMENT" : view === "mentions" ? "MENTION" : "DIRECT_MESSAGE";
    const selectedInteractions = periodInteractions.filter(
      (interaction) => interaction.interactionType === selectedInteractionType
    );
    const selectedChannels = DASHBOARD_CHANNELS.filter(({ id }) => {
      if (view !== "directMessages") return COMMENT_CHANNELS.has(id);
      return true;
    });

    const sentimentCounts: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0 };
    const channels = new Map<ConversationChannel, ChannelRow>();
    const categories = new Map<string, CategoryRow>();

    selectedChannels.forEach(({ id, label }) => {
      channels.set(id, { channel: id, label, total: 0, positive: 0, neutral: 0, negative: 0 });
    });

    selectedInteractions.forEach((interaction) => {
      const channel = channels.get(interaction.channel);
      if (channel) {
        channel.total += 1;
        if (interaction.sentiment) channel[interaction.sentiment] += 1;
      }

      if (interaction.sentiment) sentimentCounts[interaction.sentiment] += 1;

      if (interaction.category) {
        const category = categories.get(interaction.category) ?? {
          category: interaction.category,
          total: 0,
          positive: 0,
          neutral: 0,
          negative: 0,
        };
        category.total += 1;
        if (interaction.sentiment) category[interaction.sentiment] += 1;
        categories.set(interaction.category, category);
      }
    });

    const channelRows = [...channels.values()];
    const categoryRows = [...categories.values()].sort((first, second) => second.total - first.total);
    const trendRows: Array<{ key: string; label: string; total: number; positive: number; neutral: number; negative: number }> = [];

    for (let index = 0; index < days; index += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      const key = dateKey(day);
      const row = { key, label: day.toLocaleDateString(undefined, { month: "short", day: "numeric" }), total: 0, positive: 0, neutral: 0, negative: 0 };
      selectedInteractions.forEach((interaction) => {
        if (dateKey(new Date(interaction.time)) === key) {
          row.total += 1;
          if (interaction.sentiment) row[interaction.sentiment] += 1;
        }
      });
      trendRows.push(row);
    }

    return {
      totalInteractions: selectedInteractions.length,
      sentimentCounts,
      classifiedInteractions: sentimentCounts.positive + sentimentCounts.neutral + sentimentCounts.negative,
      channelRows,
      categoryRows,
      trendRows,
      recentInteractions: [...selectedInteractions].sort((first, second) => second.time - first.time),
    };
  }, [period, socialInteractions, tickets, view]);

  const topicRows = data.categoryRows.slice(0, 5);
  const allTopicRows = data.categoryRows;
  const mostActiveChannel = [...data.channelRows].sort((first, second) => second.total - first.total)[0];
  const mostNegativeTopic = [...data.categoryRows].sort((first, second) => second.negative - first.negative)[0];
  const viewLabel = view === "comments" ? "Comments" : view === "mentions" ? "Mentions" : "Direct Messages";
  const metricCards = [
    { label: viewLabel, value: data.totalInteractions, icon: MessageSquareText, color: "#60a5fa", text: "Selected period", sentiment: null as Sentiment | null },
    { label: "Positive", value: data.sentimentCounts.positive, icon: Smile, color: SENTIMENT_COLORS.positive, text: `${formatPercent(data.sentimentCounts.positive, data.totalInteractions)} of interactions`, sentiment: "positive" as Sentiment },
    { label: "Neutral", value: data.sentimentCounts.neutral, icon: Meh, color: SENTIMENT_COLORS.neutral, text: `${formatPercent(data.sentimentCounts.neutral, data.totalInteractions)} of interactions`, sentiment: "neutral" as Sentiment },
    { label: "Negative", value: data.sentimentCounts.negative, icon: Frown, color: SENTIMENT_COLORS.negative, text: `${formatPercent(data.sentimentCounts.negative, data.totalInteractions)} of interactions`, sentiment: "negative" as Sentiment },
  ];
  const insights = [
    mostActiveChannel?.total
      ? { icon: Activity, color: "text-sky-300", text: `${mostActiveChannel.label} has the most ${viewLabel.toLowerCase()} (${formatNumber(mostActiveChannel.total)}).` }
      : null,
    mostNegativeTopic?.negative
      ? { icon: CircleAlert, color: "text-rose-300", text: `${mostNegativeTopic.category} has the most negative messages (${formatNumber(mostNegativeTopic.negative)}).` }
      : null,
    data.classifiedInteractions
      ? { icon: Smile, color: "text-emerald-300", text: `${formatPercent(data.sentimentCounts.positive, data.classifiedInteractions)} of classified messages are positive.` }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="-mx-4 -my-4 min-h-[calc(100svh-3rem)] bg-[#0b1220] p-3 text-white sm:-mx-6 sm:-my-6 sm:p-4 lg:-mx-8 lg:-my-8 lg:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border border-[#344258] bg-[#111b2b] p-1" role="tablist" aria-label="Dashboard interaction view">
          {DASHBOARD_VIEWS.map((option) => (
            <button
              key={option.id}
              type="button"
              role="tab"
              aria-selected={view === option.id}
              onClick={() => setView(option.id)}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${view === option.id ? "bg-sky-600 text-white" : "text-slate-300 hover:bg-[#1b293e] hover:text-white"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="dashboard-period">Reporting period</label>
          <select
            id="dashboard-period"
            value={period}
            onChange={(event) => setPeriod(event.target.value as Period)}
            className="h-8 rounded border border-[#344258] bg-[#111b2b] px-2 text-xs text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            {(Object.keys(PERIOD_DAYS) as Period[]).map((value) => (
              <option key={value} value={value}>{PERIOD_LABELS[value]}</option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadDashboard()}
            disabled={loading}
            className="h-8 border-[#344258] bg-[#111b2b] px-2 text-slate-100 hover:bg-[#1b293e] hover:text-white"
            aria-label="Refresh dashboard data"
            title="Refresh dashboard data"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          {updatedAt && <span className="hidden text-[10px] text-slate-500 sm:inline">Updated {formatDistanceToNow(updatedAt, { addSuffix: true })}</span>}
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-rose-900/70 bg-rose-950/50 px-3 py-2 text-xs text-rose-200" role="alert">
          {error}
        </div>
      )}

      {loading && !updatedAt ? (
        <div className="flex min-h-72 items-center justify-center gap-2 rounded-md border border-[#26344a] bg-[#111b2b] text-sm text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading messages, comments, and mentions
        </div>
      ) : error && !updatedAt ? (
        <div className="flex min-h-72 flex-col items-center justify-center gap-3 rounded-md border border-[#26344a] bg-[#111b2b] text-sm text-slate-300">
          <CircleAlert className="h-5 w-5 text-rose-300" />
          Dashboard data is unavailable. Use refresh to try again.
        </div>
      ) : (
        <>
          <div className="mb-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
            {metricCards.map((metric) => {
              const Icon = metric.icon;
              const content = (
                <>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5" style={{ color: metric.color }}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[10px] text-slate-400">{metric.label}</p>
                    <p className="text-xl font-semibold leading-6 text-white">{formatNumber(metric.value)}</p>
                    <p className="truncate text-[9px] text-slate-500">{metric.text}</p>
                  </div>
                </>
              );

              if (metric.sentiment) {
                const sentiment = metric.sentiment;
                const isExpanded = expandedSentiment === sentiment;
                const sentimentChannels = data.channelRows.filter((channel) => channel[sentiment] > 0);
                return (
                  <Popover
                    key={metric.label}
                    open={isExpanded}
                    onOpenChange={(open) => setExpandedSentiment(open ? sentiment : null)}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={`flex min-h-[76px] w-full items-center gap-3 rounded-md border border-[#26344a] border-l-[3px] bg-[#111b2b] px-3 py-2 text-left transition-colors hover:bg-[#172338] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${isExpanded ? "ring-1 ring-sky-500/60" : ""}`}
                        style={{ borderLeftColor: metric.color }}
                      >
                        {content}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="bottom"
                      align="center"
                      sideOffset={8}
                      collisionPadding={12}
                      className="sentiment-bubble w-max min-w-48 max-w-[calc(100vw-1.5rem)] rounded-2xl border-[#344258] bg-[#111b2b] p-3 text-white shadow-2xl shadow-black/50 sm:max-w-sm"
                      aria-label={`${sentiment} interactions by channel`}
                    >
                      <div className="mb-2 text-[10px] font-semibold capitalize text-slate-200">
                        {sentiment} by channel
                      </div>
                      {sentimentChannels.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {sentimentChannels.map((channel) => (
                            <div
                              key={channel.channel}
                              className="inline-flex items-center gap-1 rounded-full border border-[#344258] bg-[#182438] py-1 pl-1 pr-2 text-[10px]"
                            >
                              <ChannelIcon channel={channel.channel} className="h-5 w-5 shrink-0" />
                              <span className="font-bold text-white">{formatNumber(channel[sentiment])}</span>
                              <span className="text-slate-300">{channel.label}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-400">
                          No {sentiment} interactions for the selected view and period.
                        </p>
                      )}
                    </PopoverContent>
                  </Popover>
                );
              }

              return (
                <section key={metric.label} className="flex min-h-[76px] items-center gap-3 rounded-md border border-[#26344a] border-l-[3px] bg-[#111b2b] px-3 py-2" style={{ borderLeftColor: metric.color }}>
                  {content}
                </section>
              );
            })}
          </div>

          <div className="mb-3 grid grid-cols-1 gap-3 xl:grid-cols-12">
            <Panel title="Sentiment Trend" note={PERIOD_LABELS[period]} className="xl:col-span-6">
              {data.totalInteractions === 0 ? <EmptyPanel>No {viewLabel.toLowerCase()} in this period.</EmptyPanel> : (
                <div className="h-40" role="img" aria-label="Daily positive, neutral, and negative customer message counts">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.trendRows} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                      <CartesianGrid stroke="#26344a" strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={{ stroke: "#344258" }} tickLine={false} interval={period === "7d" ? 0 : Math.ceil(PERIOD_DAYS[period] / 7) - 1} />
                      <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={false} tickLine={false} />
                      <ChartTooltip contentStyle={{ background: "#0b1220", border: "1px solid #344258", borderRadius: 6, color: "#f8fafc", fontSize: 11 }} />
                      <Line type="monotone" dataKey="positive" name="Positive" stroke={SENTIMENT_COLORS.positive} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                      <Line type="monotone" dataKey="neutral" name="Neutral" stroke={SENTIMENT_COLORS.neutral} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                      <Line type="monotone" dataKey="negative" name="Negative" stroke={SENTIMENT_COLORS.negative} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="mt-1 flex justify-center gap-4 text-[9px] text-slate-400">
                {Object.entries(SENTIMENT_COLORS).map(([sentiment, color]) => (
                  <span key={sentiment} className="flex items-center gap-1.5 capitalize"><i className="h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />{sentiment}</span>
                ))}
              </div>
            </Panel>

            <Panel title="Top Topics" note={`By ${viewLabel.toLowerCase()}`} className="xl:col-span-3">
              {allTopicRows.length === 0 ? <EmptyPanel>No categorized messages in this period.</EmptyPanel> : (
                <div className="max-h-40 space-y-3 overflow-y-auto overscroll-contain py-1 pr-1">
                  {allTopicRows.map((topic) => (
                    <div key={topic.category} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                      <span className="truncate text-[10px] text-slate-300" title={topic.category}>{topic.category}</span>
                      <span className="text-right text-[10px] text-slate-400">{formatNumber(topic.total)} ({formatPercent(topic.total, data.totalInteractions)})</span>
                      <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-[#26344a]">
                        <div className="h-full rounded-full bg-sky-400" style={{ width: `${data.totalInteractions ? (topic.total / data.totalInteractions) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Interactions by Channel" className="xl:col-span-3">
              <div className="grid gap-3 py-1">
                {data.channelRows.map((channel) => (
                  <div key={channel.channel} className="grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-2">
                    <ChannelIcon channel={channel.channel} className="h-5 w-5" />
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center justify-between gap-2 text-[10px]">
                        <span className="truncate text-slate-200">{channel.label}</span>
                        <span className="shrink-0 text-slate-400">{formatPercent(channel.total, data.totalInteractions)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[#26344a]">
                        <div className="h-full rounded-full bg-sky-400" style={{ width: `${data.totalInteractions ? (channel.total / data.totalInteractions) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <span className="min-w-8 text-right text-[10px] font-semibold text-slate-200">{formatNumber(channel.total)}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="mb-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
            <Panel title="Interaction Volume" note={PERIOD_LABELS[period]}>
              {data.totalInteractions === 0 ? <EmptyPanel>No {viewLabel.toLowerCase()} in this period.</EmptyPanel> : (
                <div className="h-40" role="img" aria-label="Daily customer message volume">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.trendRows} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                      <CartesianGrid stroke="#26344a" strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={{ stroke: "#344258" }} tickLine={false} interval={period === "7d" ? 0 : Math.ceil(PERIOD_DAYS[period] / 7) - 1} />
                      <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 9 }} axisLine={false} tickLine={false} />
                      <ChartTooltip contentStyle={{ background: "#0b1220", border: "1px solid #344258", borderRadius: 6, color: "#f8fafc", fontSize: 11 }} />
                      <Bar dataKey="total" name={viewLabel} fill="#60a5fa" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            <Panel title="Recent Interactions" note={`${formatNumber(data.recentInteractions.length)} total`} className="h-64">
              {data.recentInteractions.length === 0 ? <EmptyPanel>No recent {viewLabel.toLowerCase()} in this period.</EmptyPanel> : (
                <div className="max-h-36 divide-y divide-[#26344a] overflow-y-auto overscroll-contain pr-1" role="feed" aria-label="Recent interactions, newest first">
                  {data.recentInteractions.map((interaction) => {
                    const hasTicketDestination = Boolean(interaction.queueView && interaction.ticketNumber);
                    const hasDestination = hasTicketDestination || Boolean(interaction.sourceUrl);

                    return (
                      <button
                        key={interaction.id}
                        type="button"
                        disabled={!hasDestination}
                        onClick={() => {
                          if (hasTicketDestination) {
                            navigate(
                              `/messages?view=${interaction.queueView}&channel=${encodeURIComponent(interaction.channel)}&ticket=${encodeURIComponent(interaction.ticketNumber!)}`
                            );
                            return;
                          }
                          if (interaction.sourceUrl) {
                            window.open(interaction.sourceUrl, "_blank", "noopener,noreferrer");
                          }
                        }}
                        aria-label={
                          hasTicketDestination
                            ? `Open ${interaction.customer}'s ${interaction.channel} chat`
                            : interaction.sourceUrl
                            ? `Open ${interaction.customer}'s original ${getInteractionTypeLabel(interaction).toLowerCase()}`
                            : `${interaction.customer}'s ${getInteractionTypeLabel(interaction).toLowerCase()}`
                        }
                        className="flex w-full min-w-0 items-start gap-2 py-1.5 text-left enabled:hover:bg-[#182438] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500 disabled:cursor-default first:pt-0 last:pb-0"
                      >
                        <CustomerAvatar
                          profilePictureUrl={interaction.profilePictureUrl}
                          label={interaction.customer}
                          className="mt-0.5 h-5 w-5"
                          fallbackClassName="text-[9px]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-baseline gap-2">
                            <span className="truncate text-[10px] font-semibold text-slate-100">{interaction.customer}</span>
                            <span className="shrink-0 text-[9px] text-sky-300">{getInteractionTypeLabel(interaction)}</span>
                            <span className="shrink-0 text-[9px] text-slate-500">{formatDistanceToNow(new Date(interaction.time), { addSuffix: true })}</span>
                          </div>
                          <p className="line-clamp-1 text-[10px] text-slate-300">{interaction.text}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className="rounded bg-[#26344a] px-1.5 py-0.5 text-[9px] text-slate-200">{interaction.handlingLabel}</span>
                            {interaction.handedOverByAi && <span className="rounded bg-sky-950 px-1.5 py-0.5 text-[9px] text-sky-300">Handed over by AI</span>}
                          </div>
                        </div>
                        {interaction.sentiment && (
                          <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] capitalize" style={{ color: SENTIMENT_COLORS[interaction.sentiment], backgroundColor: `${SENTIMENT_COLORS[interaction.sentiment]}1a` }}>
                            {interaction.sentiment}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              <button type="button" className="mt-2 flex w-full items-center justify-end border-t border-[#26344a] pt-2 text-[10px] font-medium text-sky-300 hover:text-sky-200" onClick={() => navigate("/messages?view=new")}>
                View messages <span aria-hidden="true" className="ml-1">→</span>
              </button>
            </Panel>

          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
            <Panel title="Sentiment by Channel" note={viewLabel} className="lg:col-span-5">
              {data.totalInteractions === 0 ? <EmptyPanel>No {viewLabel.toLowerCase()} in this period.</EmptyPanel> : (
                <div className="h-40" role="img" aria-label="Sentiment counts by channel">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.channelRows} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: -14 }}>
                      <CartesianGrid horizontal={false} stroke="#26344a" />
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="label" width={72} tick={{ fill: "#cbd5e1", fontSize: 9 }} axisLine={false} tickLine={false} />
                      <ChartTooltip contentStyle={{ background: "#0b1220", border: "1px solid #344258", borderRadius: 6, color: "#f8fafc", fontSize: 11 }} />
                      <Bar dataKey="positive" name="Positive" stackId="sentiment" fill={SENTIMENT_COLORS.positive} />
                      <Bar dataKey="neutral" name="Neutral" stackId="sentiment" fill={SENTIMENT_COLORS.neutral} />
                      <Bar dataKey="negative" name="Negative" stackId="sentiment" fill={SENTIMENT_COLORS.negative} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            <Panel title="Sentiment by Category" note="Classified messages" className="lg:col-span-4">
              {topicRows.length === 0 ? <EmptyPanel>No categorized messages in this period.</EmptyPanel> : (
                <div className="h-40" role="img" aria-label="Sentiment counts by category">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topicRows} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: -14 }}>
                      <CartesianGrid horizontal={false} stroke="#26344a" />
                      <XAxis type="number" hide />
                      <YAxis type="category" dataKey="category" width={94} tick={{ fill: "#cbd5e1", fontSize: 9 }} axisLine={false} tickLine={false} />
                      <ChartTooltip contentStyle={{ background: "#0b1220", border: "1px solid #344258", borderRadius: 6, color: "#f8fafc", fontSize: 11 }} />
                      <Bar dataKey="positive" name="Positive" stackId="sentiment" fill={SENTIMENT_COLORS.positive} />
                      <Bar dataKey="neutral" name="Neutral" stackId="sentiment" fill={SENTIMENT_COLORS.neutral} />
                      <Bar dataKey="negative" name="Negative" stackId="sentiment" fill={SENTIMENT_COLORS.negative} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>

            <Panel title="Insights" note={PERIOD_LABELS[period]} className="lg:col-span-3">
              {insights.length === 0 ? <EmptyPanel>Insights will appear when message and sentiment data is available.</EmptyPanel> : (
                <div className="grid gap-2">
                  {insights.map((insight) => {
                    const Icon = insight.icon;
                    return (
                      <div key={insight.text} className="flex items-start gap-2 rounded-sm bg-[#182438] px-2 py-2">
                        <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${insight.color}`} />
                        <p className="text-[10px] leading-4 text-slate-300">{insight.text}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
