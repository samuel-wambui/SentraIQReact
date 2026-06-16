import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  Inbox,
  Loader2,
  MessageCircle,
  RefreshCw,
  Tag,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ChannelIcon } from "@/components/messages/ChannelIcon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useConversations } from "@/hooks/useConversations";
import {
  asArray,
  categoryLabel,
  channelLabel,
  ConversationChannelSummary,
  ConversationEntity,
  ConversationMessageEntity,
  ConversationThreadEntity,
  ConversationsApi,
  getAssignedAgentId,
  getAssignedAgentUsername,
  getConversationChannel,
  getConversationCustomerLabel,
  getConversationId,
  getConversationStatus,
  isActiveConversation,
  isHandedOverConversation,
  isNewQueueConversation,
  normalizeConversationChannel,
  SUPPORTED_CHANNELS,
} from "@/lib/conversations";
import { MessageTicketCard } from "./messages/MessageTicketCard";
import { MessageThreadPanel } from "./messages/MessageThreadPanel";
import { MessageHistoryPanel } from "./messages/MessageHistoryPanel";
import {
  type CategorySummary,
  type HistoryChannelBucket,
  type QueueView,
  type SentimentKey,
  type SentimentSummary,
  categoryValueFromKey,
  getCategoryKey,
  normalizeSentimentFilter,
  sentimentLabel,
  formatDateTime,
  sortNewestFirst,
  getConversationSentimentKey,
  getMessageSentimentKey,
  getMessageConversationId,
  messageCategoryKey,
  messageRowOrder,
  sortMessagesNewestFirst,
  shouldUsePreviewMessage,
  conversationIdSet,
  SENTIMENT_FILTERS,
  getChannelBuckets,
} from "./messages/messages.utils";

const THREAD_POLLING_INTERVAL_MS = 5000;

const Messages = () => {
  const { user, accessToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const {
    conversations,
    loading,
    error,
    refresh,
  } = useConversations({ token: accessToken });
  const [previewMessages, setPreviewMessages] = useState<ConversationMessageEntity[]>([]);
  const [previewMessagesLoading, setPreviewMessagesLoading] = useState(false);
  const [previewMessagesError, setPreviewMessagesError] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<ConversationMessageEntity[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const replyInFlightRef = useRef(false);
  const threadPollInFlightRef = useRef(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [closeDialogConversation, setCloseDialogConversation] = useState<ConversationEntity | null>(null);
  const [closingRemarks, setClosingRemarks] = useState("");
  const [historyAgent, setHistoryAgent] = useState("");
  const [historyCustomer, setHistoryCustomer] = useState("");
  const [historyChannel, setHistoryChannel] = useState<string | null>(null);
  const [historyStatus, setHistoryStatus] = useState("all");
  const [historyCategory, setHistoryCategory] = useState("all");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historySummary, setHistorySummary] = useState<ConversationChannelSummary[]>([]);
  const [historyThreads, setHistoryThreads] = useState<ConversationThreadEntity[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historySearched, setHistorySearched] = useState(false);

  const resetPreviewMessages = () => {
    setPreviewMessages([]);
    setPreviewMessagesError(null);
  };

  const resetThreadMessages = () => {
    setThreadMessages([]);
    setThreadError(null);
  };

  const logBackendDebug = (label: string, payload: unknown) => {
    console.debug(`[Messages] ${label}`, payload);
  };

  const viewParam = searchParams.get("view");
  const currentView: QueueView =
    viewParam === "active" ? "active" : viewParam === "handover" ? "handover" : "new";
  const selectedChannel = normalizeConversationChannel(searchParams.get("channel"));
  const selectedSentiment = normalizeSentimentFilter(searchParams.get("sentiment"));
  const selectedCategory = searchParams.get("category") || null;
  const selectedConversationId = searchParams.get("conversation");
  const currentUsername = user?.username ?? null;

  const setParams = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      });
      setSearchParams(next);
    },
    [searchParams, setSearchParams]
  );

  const newQueueConversations = useMemo(
    () => sortNewestFirst(conversations.filter(isNewQueueConversation)),
    [conversations]
  );

  const activeConversations = useMemo(
    () => sortNewestFirst(conversations.filter(isActiveConversation)),
    [conversations]
  );

  const handedOverConversations = useMemo(
    () => sortNewestFirst(conversations.filter(isHandedOverConversation)),
    [conversations]
  );

  const selectedChannelNewConversations = useMemo(
    () =>
      newQueueConversations.filter((conversation) => {
        const channel = getConversationChannel(conversation);
        if (selectedChannel && channel !== selectedChannel) return false;
        return true;
      }),
    [newQueueConversations, selectedChannel]
  );

  const selectedSentimentConversations = useMemo(
    () =>
      selectedChannelNewConversations.filter((conversation) => {
        if (selectedSentiment && getConversationSentimentKey(conversation) !== selectedSentiment) return false;
        return true;
      }),
    [selectedChannelNewConversations, selectedSentiment]
  );

  const selectedNewConversations = useMemo(
    () =>
      selectedSentimentConversations.filter((conversation) => {
        if (selectedCategory && getCategoryKey(conversation.category) !== selectedCategory) return false;
        return true;
      }),
    [selectedCategory, selectedSentimentConversations]
  );

  const selectedActiveConversations = useMemo(
    () =>
      activeConversations.filter((conversation) => {
        const channel = getConversationChannel(conversation);
        return !selectedChannel || channel === selectedChannel;
      }),
    [activeConversations, selectedChannel]
  );

  const selectedHandedOverConversations = useMemo(
    () =>
      handedOverConversations.filter((conversation) => {
        const channel = getConversationChannel(conversation);
        return !selectedChannel || channel === selectedChannel;
      }),
    [handedOverConversations, selectedChannel]
  );

  const selectedConversation = useMemo(
    () =>
      selectedConversationId
        ? conversations.find((conversation) => String(getConversationId(conversation)) === selectedConversationId)
        : null,
    [conversations, selectedConversationId]
  );

  const channelStats = useMemo(
    () =>
      SUPPORTED_CHANNELS.map((channel) => {
        const newCount = newQueueConversations.filter(
          (conversation) => getConversationChannel(conversation) === channel.id
        ).length;
        const activeCount = activeConversations.filter(
          (conversation) => getConversationChannel(conversation) === channel.id
        ).length;
        const handoverCount = handedOverConversations.filter(
          (conversation) => getConversationChannel(conversation) === channel.id
        ).length;

        return {
          ...channel,
          newCount,
          activeCount,
          handoverCount,
        };
      }),
    [activeConversations, handedOverConversations, newQueueConversations]
  );

  const sentimentSummaries = useMemo<SentimentSummary[]>(() => {
    const map = new Map<SentimentKey, SentimentSummary>();

    SENTIMENT_FILTERS.forEach((sentiment) => {
      map.set(sentiment.key, {
        ...sentiment,
        total: 0,
        latestAt: null,
      });
    });

    selectedChannelNewConversations.forEach((conversation) => {
      const key = getConversationSentimentKey(conversation);
      const current = map.get(key);
      if (!current) return;

      current.total += 1;
      if (
        conversation.lastMessageAt &&
        (!current.latestAt || new Date(conversation.lastMessageAt) > new Date(current.latestAt))
      ) {
        current.latestAt = conversation.lastMessageAt;
      }
    });

    return SENTIMENT_FILTERS.map((sentiment) => map.get(sentiment.key)!);
  }, [selectedChannelNewConversations]);

  const categorySummaries = useMemo<CategorySummary[]>(() => {
    if (!selectedChannel || !selectedSentiment) return [];

    const map = new Map<string, CategorySummary>();
    selectedSentimentConversations.forEach((conversation) => {
      const key = getCategoryKey(conversation.category);
      const current = map.get(key) ?? {
        key,
        label: categoryLabel(categoryValueFromKey(key)),
        total: 0,
        latestAt: null,
      };

      current.total += 1;
      if (
        conversation.lastMessageAt &&
        (!current.latestAt || new Date(conversation.lastMessageAt) > new Date(current.latestAt))
      ) {
        current.latestAt = conversation.lastMessageAt;
      }
      map.set(key, current);
    });

    return Array.from(map.values()).sort((first, second) => {
      const firstTime = first.latestAt ? new Date(first.latestAt).getTime() : 0;
      const secondTime = second.latestAt ? new Date(second.latestAt).getTime() : 0;
      return secondTime - firstTime || first.label.localeCompare(second.label);
    });
  }, [selectedChannel, selectedSentiment, selectedSentimentConversations]);

  const historyCategoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          conversations
            .map((conversation) => String(conversation.category || "").trim())
            .filter(Boolean)
        )
      ).sort((first, second) => first.localeCompare(second)),
    [conversations]
  );

  const historyChannelBuckets = useMemo<HistoryChannelBucket[]>(() => getChannelBuckets(historySummary), [historySummary]);

  const selectedHistoryBucket = useMemo(
    () => historyChannelBuckets.find((bucket) => bucket.key === historyChannel) ?? null,
    [historyChannel, historyChannelBuckets]
  );

  const previewMessageByConversation = useMemo(() => {
    const map = new Map<string, ConversationMessageEntity>();

    previewMessages.forEach((message) => {
      const conversationId = getMessageConversationId(message);
      if (!conversationId) return;

      const key = String(conversationId);
      const current = map.get(key);

      if (shouldUsePreviewMessage(message, current)) {
        map.set(key, message);
      }
    });

    return map;
  }, [previewMessages]);

  const isAssignedToCurrentUser = useCallback(
    (conversation: ConversationEntity) => {
      const assignedUsername = getAssignedAgentUsername(conversation);
      if (assignedUsername && currentUsername) {
        return assignedUsername.toLowerCase() === currentUsername.toLowerCase();
      }

      const assignedAgentId = getAssignedAgentId(conversation);
      if (assignedAgentId && user?.id) {
        return String(assignedAgentId) === String(user.id);
      }

      return false;
    },
    [currentUsername, user?.id]
  );

  const actionPayload = useMemo(
    () => ({ assignedAgentUsername: currentUsername }),
    [currentUsername]
  );

  const loadPreviewMessages = useCallback(async () => {
    logBackendDebug("loadPreviewMessages", {
      currentView,
      selectedChannel,
      selectedSentiment,
      selectedCategory,
      activeCount: selectedActiveConversations.length,
      handoverCount: selectedHandedOverConversations.length,
    });

    if (!accessToken) {
      resetPreviewMessages();
      return;
    }

    setPreviewMessagesLoading(true);
    try {
      if (currentView === "new") {
        if (!selectedChannel || !selectedSentiment || !selectedCategory) {
          setPreviewMessages([]);
          setPreviewMessagesError(null);
          return;
        }

        const targetConversationIds = conversationIdSet(selectedNewConversations);
        if (targetConversationIds.size === 0) {
          setPreviewMessages([]);
          setPreviewMessagesError(null);
          return;
        }

        const statuses = Array.from(
          new Set(selectedNewConversations.map((conversation) => getConversationStatus(conversation)))
        );
        const responses = await Promise.all(
          statuses.map((status) =>
            ConversationsApi.getMessages({
              source: selectedChannel,
              status,
              category: categoryValueFromKey(selectedCategory),
            })
          )
        );
        const list = sortMessagesNewestFirst(
          responses.flatMap((data) => asArray<ConversationMessageEntity>(data)).filter((message) => {
            const conversationId = getMessageConversationId(message);
            return (
              conversationId !== null &&
              conversationId !== undefined &&
              targetConversationIds.has(String(conversationId)) &&
              messageCategoryKey(message) === selectedCategory &&
              getMessageSentimentKey(message) === selectedSentiment
            );
          })
        );

        setPreviewMessages(list);
        setPreviewMessagesError(null);
        logBackendDebug("previewMessages loaded", { count: list.length, list });
        return;
      }

      if (currentView === "handover") {
        const targetConversationIds = conversationIdSet(selectedHandedOverConversations);
        if (targetConversationIds.size === 0) {
          setPreviewMessages([]);
          setPreviewMessagesError(null);
          return;
        }

        const data = await ConversationsApi.getMessages({
          source: selectedChannel ?? undefined,
          status: "HANDED_OVER",
        });
        const list = sortMessagesNewestFirst(
          asArray<ConversationMessageEntity>(data).filter((message) => {
            const conversationId = getMessageConversationId(message);
            return (
              conversationId !== null &&
              conversationId !== undefined &&
              targetConversationIds.has(String(conversationId))
            );
          })
        );

        setPreviewMessages(list);
        setPreviewMessagesError(null);
        return;
      }

      const targetConversationIds = conversationIdSet(selectedActiveConversations);
      if (targetConversationIds.size === 0) {
        setPreviewMessages([]);
        setPreviewMessagesError(null);
        return;
      }

      const activeStatuses = Array.from(
        new Set(selectedActiveConversations.map((conversation) => getConversationStatus(conversation)))
      );
      const responses = await Promise.all(
        activeStatuses.map((status) =>
          ConversationsApi.getMessages({
            source: selectedChannel ?? undefined,
            status,
          })
        )
      );
      const list = sortMessagesNewestFirst(
        responses.flatMap((data) =>
          asArray<ConversationMessageEntity>(data).filter((message) => {
            const conversationId = getMessageConversationId(message);
            return (
              conversationId !== null &&
              conversationId !== undefined &&
              targetConversationIds.has(String(conversationId))
            );
          })
        )
      );

      setPreviewMessages(list);
      setPreviewMessagesError(null);
      logBackendDebug("previewMessages loaded", { count: list.length, list });
    } catch (previewError) {
      const description =
        previewError instanceof Error ? previewError.message : "Unable to fetch ticket messages.";
      logBackendDebug("loadPreviewMessages error", previewError);
      setPreviewMessagesError(description);
      resetPreviewMessages();
    } finally {
      setPreviewMessagesLoading(false);
    }
  }, [
    accessToken,
    currentView,
    selectedActiveConversations,
    selectedCategory,
    selectedChannel,
    selectedHandedOverConversations,
    selectedNewConversations,
    selectedSentiment,
  ]);

  const loadThreadMessages = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    logBackendDebug("loadThreadMessages", { selectedConversationId });

    if (!accessToken || !selectedConversationId) {
      resetThreadMessages();
      return;
    }

    if (!silent) {
      setThreadLoading(true);
    }

    try {
      const data = await ConversationsApi.getConversationMessages(selectedConversationId);
      const list = asArray<ConversationMessageEntity>(data).sort((first, second) => {
        const firstTime = first.createdAt ? new Date(first.createdAt).getTime() : 0;
        const secondTime = second.createdAt ? new Date(second.createdAt).getTime() : 0;
        return firstTime - secondTime || messageRowOrder(first) - messageRowOrder(second);
      });

      setThreadMessages(list);
      setThreadError(null);
      logBackendDebug("threadMessages loaded", { count: list.length, list });
    } catch (threadLoadError) {
      const description =
        threadLoadError instanceof Error ? threadLoadError.message : "Unable to fetch conversation thread.";
      logBackendDebug("loadThreadMessages error", threadLoadError);
      setThreadError(description);
      if (!silent) {
        resetThreadMessages();
      }
    } finally {
      if (!silent) {
        setThreadLoading(false);
      }
    }
  }, [accessToken, selectedConversationId]);

  useEffect(() => {
    loadPreviewMessages();
  }, [loadPreviewMessages]);

  useEffect(() => {
    loadThreadMessages();
  }, [loadThreadMessages]);

  useEffect(() => {
    if (!accessToken || !selectedConversationId) return;

    const intervalId = window.setInterval(() => {
      if (threadPollInFlightRef.current || replyInFlightRef.current) return;

      threadPollInFlightRef.current = true;
      loadThreadMessages({ silent: true }).finally(() => {
        threadPollInFlightRef.current = false;
      });
    }, THREAD_POLLING_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [accessToken, loadThreadMessages, selectedConversationId]);

  useEffect(() => {
    setReplyText("");
  }, [selectedConversationId]);

  const handleRefresh = async () => {
    try {
      await refresh();
      await Promise.all([loadPreviewMessages(), loadThreadMessages()]);
    } catch {
      // The hooks already expose the error state.
    }
  };

  const historyFilterParams = (source?: string | null) => ({
    agentUsername: historyAgent.trim() || undefined,
    customerId: historyCustomer.trim() || undefined,
    source: source || undefined,
    status: historyStatus !== "all" ? historyStatus : undefined,
    category: historyCategory !== "all" ? historyCategory : undefined,
    from: historyFrom || undefined,
    to: historyTo || undefined,
  });

  const loadHistoryChannelSummary = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const params = historyFilterParams();
    logBackendDebug("loadHistoryChannelSummary", params);

    setHistoryLoading(true);
    setHistorySearched(true);
    setHistoryChannel(null);
    setHistorySummary([]);
    setHistoryThreads([]);
    try {
      const data = await ConversationsApi.getThreadSummary(params);

      logBackendDebug("historySummary loaded", { count: asArray<ConversationChannelSummary>(data).length, data });
      setHistorySummary(asArray<ConversationChannelSummary>(data));
      setHistoryError(null);
    } catch (historyLoadError) {
      const description =
        historyLoadError instanceof Error ? historyLoadError.message : "Unable to fetch conversation history.";
      setHistoryError(description);
      setHistorySummary([]);
      setHistoryThreads([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadHistoryThreadsForChannel = async (source: string) => {
    const params = historyFilterParams(source);
    logBackendDebug("loadHistoryThreadsForChannel", { source, params });

    setHistoryChannel(source);
    setHistoryLoading(true);
    setHistoryThreads([]);
    try {
      const data = await ConversationsApi.getThreads(params);

      logBackendDebug("historyThreads loaded", { count: asArray<ConversationThreadEntity>(data).length, data });
      setHistoryThreads(asArray<ConversationThreadEntity>(data));
      setHistoryError(null);
    } catch (historyLoadError) {
      const description =
        historyLoadError instanceof Error ? historyLoadError.message : "Unable to fetch conversation history.";
      setHistoryError(description);
      setHistoryThreads([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const sendConversationReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (replyInFlightRef.current) return;

    const conversationId = selectedConversation ? getConversationId(selectedConversation) : null;
    const trimmedMessage = replyText.trim();

    if (!conversationId) {
      toast({
        title: "No ticket selected",
        description: "Open a ticket thread before replying.",
        variant: "destructive",
      });
      return;
    }

    if (!trimmedMessage) {
      toast({
        title: "Missing reply",
        description: "Write a message before sending.",
        variant: "destructive",
      });
      return;
    }

    replyInFlightRef.current = true;
    setReplySending(true);
    try {
      await ConversationsApi.replyConversation(conversationId, {
        message: trimmedMessage,
        assignedAgentUsername: currentUsername,
      });

      setReplyText("");
      toast({ title: "Reply sent" });
      await Promise.all([refresh(), loadThreadMessages()]);
    } catch (replyError) {
      const description = replyError instanceof Error ? replyError.message : "Unable to send reply.";
      toast({ title: "Reply not sent", description, variant: "destructive" });
    } finally {
      replyInFlightRef.current = false;
      setReplySending(false);
    }
  };

  const pickConversation = async (conversation: ConversationEntity) => {
    const conversationId = getConversationId(conversation);
    if (!conversationId) return;

    const actionKey = `pick-${conversationId}`;
    setActionLoading(actionKey);
    try {
      await ConversationsApi.assignConversation(conversationId, actionPayload);
      toast({ title: "Ticket assigned" });
      await refresh();
      setSearchParams({ view: "active", conversation: String(conversationId) });
    } catch (pickError) {
      const description = pickError instanceof Error ? pickError.message : "Unable to assign ticket.";
      toast({ title: "Ticket not assigned", description, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const markPendingCustomer = async (conversation: ConversationEntity) => {
    const conversationId = getConversationId(conversation);
    if (!conversationId) return;

    const actionKey = `pending-${conversationId}`;
    setActionLoading(actionKey);
    try {
      await ConversationsApi.markPendingCustomer(conversationId, actionPayload);
      toast({ title: "Ticket marked pending customer" });
      await refresh();
    } catch (pendingError) {
      const description =
        pendingError instanceof Error ? pendingError.message : "Unable to mark ticket pending customer.";
      toast({ title: "Ticket not updated", description, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const openCloseDialog = (conversation: ConversationEntity) => {
    setCloseDialogConversation(conversation);
    setClosingRemarks("");
  };

  const resetCloseDialog = () => {
    setCloseDialogConversation(null);
    setClosingRemarks("");
  };

  const confirmCloseConversation = async () => {
    const conversationId = closeDialogConversation ? getConversationId(closeDialogConversation) : null;
    const remarks = closingRemarks.trim();

    if (!conversationId) return;

    if (!remarks) {
      toast({
        title: "Closing remarks required",
        description: "Add a short close note before closing the ticket.",
        variant: "destructive",
      });
      return;
    }

    const actionKey = `close-${conversationId}`;
    setActionLoading(actionKey);
    try {
      await ConversationsApi.closeConversation(conversationId, { closingRemarks: remarks });
      toast({ title: "Ticket closed" });
      resetCloseDialog();
      await refresh();
      setParams({ conversation: null });
    } catch (closeError) {
      const description = closeError instanceof Error ? closeError.message : "Unable to close ticket.";
      toast({ title: "Ticket not closed", description, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handoverConversation = async (conversation: ConversationEntity) => {
    const conversationId = getConversationId(conversation);
    if (!conversationId) return;

    const actionKey = `handover-${conversationId}`;
    setActionLoading(actionKey);
    try {
      await ConversationsApi.handoverConversation(conversationId);
      toast({ title: "Ticket handed over" });
      await refresh();
      setSearchParams({ view: "handover" });
    } catch (handoverError) {
      const description = handoverError instanceof Error ? handoverError.message : "Unable to hand over ticket.";
      toast({ title: "Ticket not handed over", description, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const goBack = () => {
    if (selectedConversationId) {
      setParams({ conversation: null });
      return;
    }

    if (selectedCategory) {
      setParams({ category: null });
      return;
    }

    if (selectedSentiment) {
      setParams({ sentiment: null, category: null });
      return;
    }

    if (selectedChannel) {
      setParams({ channel: null, sentiment: null, category: null });
      return;
    }

    setSearchParams({ view: currentView });
  };

  const showBack = Boolean(selectedChannel || selectedSentiment || selectedCategory || selectedConversationId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Messages</h2>
          <p className="text-muted-foreground">WhatsApp, Facebook, Instagram, and X service tickets</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showBack && (
            <Button type="button" variant="outline" onClick={goBack}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={handleRefresh}
            disabled={loading || previewMessagesLoading || threadLoading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs
        value={currentView}
        onValueChange={(value) => {
          const view = value === "active" || value === "handover" ? value : "new";
          setSearchParams({ view });
        }}
      >
        <TabsList>
          <TabsTrigger value="new">New messages</TabsTrigger>
          <TabsTrigger value="handover">Handed over</TabsTrigger>
          <TabsTrigger value="active">Active tickets</TabsTrigger>
        </TabsList>
      </Tabs>

      {selectedConversation && (
        <MessageThreadPanel
          selectedConversation={selectedConversation}
          threadMessages={threadMessages}
          threadLoading={threadLoading}
          threadError={threadError}
          replyText={replyText}
          replySending={replySending}
          currentUsername={currentUsername}
          onReplyTextChange={setReplyText}
          onSendReply={sendConversationReply}
        />
      )}

      {currentView === "new" && !selectedChannel && (
        <section className="space-y-3">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {channelStats.map((channel) => (
              <Card
                key={channel.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() =>
                  setParams({ view: "new", channel: channel.id, sentiment: null, category: null, conversation: null })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setParams({
                      view: "new",
                      channel: channel.id,
                      sentiment: null,
                      category: null,
                      conversation: null,
                    });
                  }
                }}
              >
                <CardContent className="flex items-center gap-4 p-5">
                  <ChannelIcon channel={channel.id} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{channel.label}</p>
                    <p className="text-sm text-muted-foreground">{channel.activeCount} active tickets</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-foreground">{channel.newCount}</p>
                    <p className="text-xs text-muted-foreground">new</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {currentView === "new" && selectedChannel && !selectedSentiment && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <ChannelIcon channel={selectedChannel} />
            <div>
              <h3 className="text-xl font-semibold text-foreground">{channelLabel(selectedChannel)}</h3>
              <p className="text-sm text-muted-foreground">{selectedChannelNewConversations.length} new tickets</p>
            </div>
          </div>

          {selectedChannelNewConversations.length === 0 ? (
            <Card>
              <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
                <Inbox className="h-5 w-5" />
                No new tickets
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {sentimentSummaries.map((sentiment) => (
                <Card
                  key={sentiment.key}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => setParams({ sentiment: sentiment.key, category: null, conversation: null })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setParams({ sentiment: sentiment.key, category: null, conversation: null });
                    }
                  }}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="truncate text-sm font-medium">{sentiment.label}</CardTitle>
                    <MessageCircle className="h-5 w-5 text-[#b71c1c]" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">{sentiment.total}</div>
                    <p className="mt-2 text-xs text-muted-foreground">{sentiment.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {currentView === "new" && selectedChannel && selectedSentiment && !selectedCategory && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <ChannelIcon channel={selectedChannel} />
            <div>
              <h3 className="text-xl font-semibold text-foreground">{sentimentLabel(selectedSentiment)}</h3>
              <p className="text-sm text-muted-foreground">
                {channelLabel(selectedChannel)} · {selectedSentimentConversations.length} new tickets
              </p>
            </div>
          </div>

          {categorySummaries.length === 0 ? (
            <Card>
              <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
                <Inbox className="h-5 w-5" />
                No new tickets
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {categorySummaries.map((category) => (
                <Card
                  key={category.key}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => setParams({ category: category.key, conversation: null })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setParams({ category: category.key, conversation: null });
                    }
                  }}
                >
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="truncate text-sm font-medium">{category.label}</CardTitle>
                    <Tag className="h-5 w-5 text-[#b71c1c]" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-foreground">{category.total}</div>
                    <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(category.latestAt)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      {currentView === "new" && selectedChannel && selectedSentiment && selectedCategory && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ChannelIcon channel={selectedChannel} />
              <div>
                <h3 className="text-xl font-semibold text-foreground">
                  {categoryLabel(categoryValueFromKey(selectedCategory))}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {channelLabel(selectedChannel)} · {sentimentLabel(selectedSentiment)} ·{" "}
                  {selectedNewConversations.length} new tickets
                </p>
              </div>
            </div>
            {previewMessagesLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading messages
              </div>
            )}
          </div>

          {previewMessagesError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{previewMessagesError}</AlertDescription>
            </Alert>
          )}

          {selectedNewConversations.length === 0 && !previewMessagesLoading ? (
            <Card>
              <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
                <Inbox className="h-5 w-5" />
                No new tickets
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {selectedNewConversations.map((conversation) => (
                <MessageTicketCard
                  key={String(getConversationId(conversation) ?? `${conversation.senderId}-${conversation.lastMessageAt}`)}
                  conversation={conversation}
                  mode="new"
                  latestMessage={previewMessageByConversation.get(String(getConversationId(conversation)))}
                  actionLoading={actionLoading}
                  selectedConversationId={selectedConversationId}
                  currentUsername={currentUsername}
                  previewMessagesLoading={previewMessagesLoading}
                  onOpenThread={(conversationId) => setParams({ view: "new", conversation: conversationId })}
                  onPickConversation={pickConversation}
                  onMarkPendingCustomer={markPendingCustomer}
                  onOpenCloseDialog={openCloseDialog}
                  onHandoverConversation={handoverConversation}
                  isAssignedToCurrentUser={isAssignedToCurrentUser}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {currentView === "handover" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-foreground">Handed over tickets</h3>
              <p className="text-sm text-muted-foreground">
                {selectedHandedOverConversations.length} waiting for reassignment
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={!selectedChannel ? "default" : "outline"}
                size="sm"
                onClick={() => setParams({ channel: null, sentiment: null, category: null, conversation: null })}
              >
                All
              </Button>
              {SUPPORTED_CHANNELS.map((channel) => (
                <Button
                  key={channel.id}
                  type="button"
                  variant={selectedChannel === channel.id ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    setParams({ channel: channel.id, sentiment: null, category: null, conversation: null })
                  }
                >
                  {channel.label}
                </Button>
              ))}
            </div>
          </div>

          {previewMessagesError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{previewMessagesError}</AlertDescription>
            </Alert>
          )}

          {selectedHandedOverConversations.length === 0 ? (
            <Card>
              <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
                <Inbox className="h-5 w-5" />
                No handed over tickets
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {selectedHandedOverConversations.map((conversation) => (
                <MessageTicketCard
                  key={String(getConversationId(conversation) ?? `${conversation.senderId}-${conversation.lastMessageAt}`)}
                  conversation={conversation}
                  mode="handover"
                  latestMessage={previewMessageByConversation.get(String(getConversationId(conversation)))}
                  actionLoading={actionLoading}
                  selectedConversationId={selectedConversationId}
                  currentUsername={currentUsername}
                  previewMessagesLoading={previewMessagesLoading}
                  onOpenThread={(conversationId) => setParams({ view: "handover", conversation: conversationId })}
                  onPickConversation={pickConversation}
                  onMarkPendingCustomer={markPendingCustomer}
                  onOpenCloseDialog={openCloseDialog}
                  onHandoverConversation={handoverConversation}
                  isAssignedToCurrentUser={isAssignedToCurrentUser}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {currentView === "active" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-foreground">Active tickets</h3>
              <p className="text-sm text-muted-foreground">{selectedActiveConversations.length} in progress</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={!selectedChannel ? "default" : "outline"}
                size="sm"
                onClick={() => setParams({ channel: null, sentiment: null, category: null, conversation: null })}
              >
                All
              </Button>
              {SUPPORTED_CHANNELS.map((channel) => (
                <Button
                  key={channel.id}
                  type="button"
                  variant={selectedChannel === channel.id ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    setParams({ channel: channel.id, sentiment: null, category: null, conversation: null })
                  }
                >
                  {channel.label}
                </Button>
              ))}
            </div>
          </div>

          {previewMessagesError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{previewMessagesError}</AlertDescription>
            </Alert>
          )}

          {selectedActiveConversations.length === 0 ? (
            <Card>
              <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
                <Inbox className="h-5 w-5" />
                No active tickets
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {selectedActiveConversations.map((conversation) => (
                <MessageTicketCard
                  key={String(getConversationId(conversation) ?? `${conversation.senderId}-${conversation.lastMessageAt}`)}
                  conversation={conversation}
                  mode="active"
                  latestMessage={previewMessageByConversation.get(String(getConversationId(conversation)))}
                  actionLoading={actionLoading}
                  selectedConversationId={selectedConversationId}
                  currentUsername={currentUsername}
                  previewMessagesLoading={previewMessagesLoading}
                  onOpenThread={(conversationId) => setParams({ view: "active", conversation: conversationId })}
                  onPickConversation={pickConversation}
                  onMarkPendingCustomer={markPendingCustomer}
                  onOpenCloseDialog={openCloseDialog}
                  onHandoverConversation={handoverConversation}
                  isAssignedToCurrentUser={isAssignedToCurrentUser}
                />
              ))}
            </div>
          )}

          <div className="space-y-4 border-t pt-5">
            <div>
              <h3 className="text-xl font-semibold text-foreground">Conversation history</h3>
              <p className="text-sm text-muted-foreground">
                Search full customer timelines by agent, customer, category, status, and date.
              </p>
            </div>

            <MessageHistoryPanel
              historyAgent={historyAgent}
              historyCustomer={historyCustomer}
              historyChannel={historyChannel}
              historyStatus={historyStatus}
              historyCategory={historyCategory}
              historyFrom={historyFrom}
              historyTo={historyTo}
              historySummary={historySummary}
              historyThreads={historyThreads}
              historyLoading={historyLoading}
              historyError={historyError}
              historySearched={historySearched}
              historyCategoryOptions={historyCategoryOptions}
              historyChannelBuckets={historyChannelBuckets}
              selectedHistoryBucket={selectedHistoryBucket}
              onSearchHistory={loadHistoryChannelSummary}
              onSelectHistoryChannel={loadHistoryThreadsForChannel}
              setHistoryAgent={setHistoryAgent}
              setHistoryCustomer={setHistoryCustomer}
              setHistoryStatus={setHistoryStatus}
              setHistoryCategory={setHistoryCategory}
              setHistoryFrom={setHistoryFrom}
              setHistoryTo={setHistoryTo}
            />
          </div>
        </section>
      )}

      <Dialog
        open={Boolean(closeDialogConversation)}
        onOpenChange={(open) => {
          if (!open) resetCloseDialog();
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Close ticket</DialogTitle>
            <DialogDescription>
              {getConversationCustomerLabel(closeDialogConversation)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="closing-remarks">Closing remarks</Label>
            <Textarea
              id="closing-remarks"
              value={closingRemarks}
              onChange={(event) => setClosingRemarks(event.target.value)}
              placeholder="Summarize the resolution"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetCloseDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmCloseConversation}
              disabled={!closingRemarks.trim() || actionLoading?.startsWith("close-")}
            >
              {actionLoading?.startsWith("close-") && <Loader2 className="h-4 w-4 animate-spin" />}
              Close ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Messages;
