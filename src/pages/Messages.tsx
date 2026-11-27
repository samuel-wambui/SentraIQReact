import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Inbox,
  Loader2,
  MessageCircle,
  Search,
  Tag,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ChannelIcon } from "@/components/messages/ChannelIcon";
import { CustomerAvatar } from "@/components/messages/CustomerAvatar";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useConversations } from "@/hooks/useConversations";
import {
  categoryLabel,
  channelLabel,
  ConversationEntity,
  ConversationMessageEntity,
  getAssignedAgentId,
  getAssignedAgentUsername,
  getConversationChannel,
  getConversationCustomerLabel,
  isReturnedToAiConversation,
  getConversationId,
  getMessageText,
  getProfilePictureUrl,
  isActiveConversation,
  isHandedOverConversation,
  isNewQueueConversation,
  normalizeConversationChannel,
  SUPPORTED_CHANNELS,
} from "@/lib/conversations";
import {
  getTicketAssignmentMessageId,
  ticketToConversation,
  TicketsApi,
  ticketToConversationMessages,
} from "@/lib/tickets";
import { MessageTicketCard } from "./messages/MessageTicketCard";
import { MessageThreadPanel } from "./messages/MessageThreadPanel";
import {
  type CategorySummary,
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
  sortMessagesNewestFirst,
  shouldUsePreviewMessage,
  SENTIMENT_FILTERS,
} from "./messages/messages.utils";

const THREAD_POLLING_INTERVAL_MS = 5000;

interface CustomerNameSearchProps {
  id: string;
  conversations: ConversationEntity[];
  value: string;
  onChange: (value: string) => void;
}

const CustomerNameSearch = ({ id, conversations, value, onChange }: CustomerNameSearchProps) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const customerNames = Array.from(new Set(
    conversations.map((conversation) => getConversationCustomerLabel(conversation)).map((name) => name.trim()).filter(Boolean)
  ));
  const query = value.trim().toLowerCase();
  const filteredNames = customerNames.filter((name) => name.toLowerCase().includes(query));
  const showOptions = open && filteredNames.length > 0;

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [open]);

  const chooseName = (name: string) => {
    onChange(name);
    setOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div ref={containerRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        id={id}
        type="search"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showOptions}
        aria-controls={`${id}-options`}
        aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && filteredNames.length) {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((index) => Math.min(index + 1, filteredNames.length - 1));
          } else if (event.key === "ArrowUp" && filteredNames.length) {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter" && showOptions && activeIndex >= 0) {
            event.preventDefault();
            chooseName(filteredNames[activeIndex]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Search by customer name..."
        autoComplete="off"
        className="h-10 w-full rounded-md border border-[#344258] bg-[#0b1220] pl-9 pr-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
      />
      {showOptions && (
        <div id={`${id}-options`} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-md border border-[#344258] bg-[#111b2b] p-1 shadow-xl">
          {filteredNames.map((name, index) => (
            <button
              key={name}
              id={`${id}-option-${index}`}
              type="button"
              role="option"
              aria-selected={activeIndex === index}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => chooseName(name)}
              className={`w-full truncate rounded px-2.5 py-2 text-left text-xs ${activeIndex === index ? "bg-[#1d2b40] text-white" : "text-slate-300 hover:bg-[#1d2b40] hover:text-white"}`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

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
  const [threadConversation, setThreadConversation] = useState<ConversationEntity | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const replyInFlightRef = useRef(false);
  const threadPollInFlightRef = useRef(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [closeDialogConversation, setCloseDialogConversation] = useState<ConversationEntity | null>(null);
  const [closingRemarks, setClosingRemarks] = useState("");
  const [handoverDialogConversation, setHandoverDialogConversation] = useState<ConversationEntity | null>(null);
  const [handoverNote, setHandoverNote] = useState("");
  const [ticketSearch, setTicketSearch] = useState("");

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
  const selectedConversationId = searchParams.get("ticket") ?? searchParams.get("conversation");
  const globalSearch = searchParams.get("search")?.trim() ?? "";
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

  const selectedConversation = useMemo(() => {
    if (!selectedConversationId) return null;

    const queuedConversation = conversations.find(
      (conversation) => String(getConversationId(conversation)) === selectedConversationId
    );
    if (queuedConversation) return queuedConversation;
    if (!threadConversation) return null;

    return String(getConversationId(threadConversation)) === selectedConversationId
      ? threadConversation
      : null;
  }, [conversations, selectedConversationId, threadConversation]);

  const searchResults = useMemo(() => {
    const query = globalSearch.toLowerCase();
    if (!query) return [];
    return conversations.filter((conversation) =>
      [
        getConversationCustomerLabel(conversation),
        conversation.category,
        conversation.sentiment,
        conversation.latestMessage,
      ].some((value) => String(value ?? "").toLowerCase().includes(query))
    );
  }, [conversations, globalSearch]);

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

  const filteredNewConversations = useMemo(() => {
    const query = ticketSearch.trim().toLowerCase();
    if (!query) return selectedNewConversations;

    return selectedNewConversations.filter((conversation) => {
      const latestMessage = previewMessageByConversation.get(String(getConversationId(conversation)));
      return [
        getConversationCustomerLabel(conversation),
        conversation.category,
        conversation.sentiment,
        latestMessage ? getMessageText(latestMessage) : "",
      ].some((value) => String(value ?? "").toLowerCase().includes(query));
    });
  }, [previewMessageByConversation, selectedNewConversations, ticketSearch]);

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

        const list = sortMessagesNewestFirst(
          selectedNewConversations.flatMap((conversation) => conversation.messages ?? []).filter((message) => {
            return messageCategoryKey(message) === selectedCategory && getMessageSentimentKey(message) === selectedSentiment;
          })
        );

        setPreviewMessages(list);
        setPreviewMessagesError(null);
        logBackendDebug("previewMessages loaded", { count: list.length, list });
        return;
      }

      if (currentView === "handover") {
        const list = sortMessagesNewestFirst(
          selectedHandedOverConversations.flatMap((conversation) => conversation.messages ?? [])
        );

        setPreviewMessages(list);
        setPreviewMessagesError(null);
        return;
      }

      const list = sortMessagesNewestFirst(
        selectedActiveConversations.flatMap((conversation) => conversation.messages ?? [])
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
      setThreadConversation(null);
      resetThreadMessages();
      return;
    }

    if (!silent) {
      setThreadLoading(true);
    }

    try {
      const ticket = await TicketsApi.getTicket(selectedConversationId);
      setThreadConversation(ticketToConversation(ticket));
      const list = ticketToConversationMessages(ticket);

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
    setThreadConversation(null);
  }, [selectedConversationId]);

  useEffect(() => {
    if (selectedConversationId) return;
    const firstConversation = currentView === "active"
      ? selectedActiveConversations[0]
      : currentView === "handover"
      ? selectedHandedOverConversations[0]
      : null;
    const firstId = firstConversation ? getConversationId(firstConversation) : null;
    if (firstId) setParams({ ticket: String(firstId), conversation: null });
  }, [
    currentView,
    selectedActiveConversations,
    selectedConversationId,
    selectedHandedOverConversations,
    setParams,
  ]);

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
      await TicketsApi.replyTicket(conversationId, {
        message: trimmedMessage,
        username: currentUsername,
        firstName: user?.firstName ?? null,
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

    if (!currentUsername) {
      toast({
        title: "No support user",
        description: "Sign in with a username before assigning a ticket.",
        variant: "destructive",
      });
      return;
    }

    const actionKey = `pick-${conversationId}`;
    setActionLoading(actionKey);
    try {
      const payload = {
        username: currentUsername,
        messageId: getTicketAssignmentMessageId(conversation),
      };

      if (currentView === "handover" || conversation.ticketQueue === "handover") {
        await TicketsApi.assignHandedOverTicketToBankSupport(conversationId, payload);
      } else {
        await TicketsApi.assignNewTicketToBankSupport(conversationId, payload);
      }

      toast({ title: "Ticket assigned" });
      await refresh();
      setSearchParams({ view: "active", ticket: String(conversationId) });
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
      toast({
        title: "Pending endpoint not ready",
        description: "The new ticket controller does not expose pending-customer yet.",
        variant: "destructive",
      });
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
      await TicketsApi.closeTicket(conversationId, {
        closingRemarks: remarks,
        closedBy: currentUsername,
      });
      toast({ title: "Ticket closed" });
      resetCloseDialog();
      await refresh();
      setSearchParams({ view: "active" });
    } catch (closeError) {
      const description = closeError instanceof Error ? closeError.message : "Unable to close ticket.";
      toast({ title: "Ticket not closed", description, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const openHandoverDialog = (conversation: ConversationEntity) => {
    if (!currentUsername) {
      toast({
        title: "No support user",
        description: "Sign in with a username before handing over a ticket.",
        variant: "destructive",
      });
      return;
    }

    setHandoverDialogConversation(conversation);
    setHandoverNote("");
  };

  const resetHandoverDialog = () => {
    setHandoverDialogConversation(null);
    setHandoverNote("");
  };

  const confirmHandoverConversation = async () => {
    const conversation = handoverDialogConversation;
    if (!conversation) return;

    const conversationId = getConversationId(conversation);
    if (!conversationId) return;

    const actionKey = `handover-${conversationId}`;
    setActionLoading(actionKey);
    try {
      const payload = {
        messageId: getTicketAssignmentMessageId(conversation),
        handoverBy: currentUsername,
        handoverNote: handoverNote.trim() || null,
      };
      await TicketsApi.returnTicketToAi(conversationId, payload);
      toast({ title: "Conversation returned to AI agent" });
      await refresh();
      resetHandoverDialog();
      setSearchParams({ view: "handover" });
    } catch (handoverError) {
      const description = handoverError instanceof Error
        ? handoverError.message
        : "Unable to return conversation to AI agent.";
      toast({
        title: "Conversation not returned to AI agent",
        description,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const renderTicketWorkspace = (
    items: ConversationEntity[],
    mode: "active" | "handover"
  ) => {
    const query = ticketSearch.trim().toLowerCase();
    const visibleItems = query
      ? items.filter((conversation) => {
          const latestMessage = previewMessageByConversation.get(String(getConversationId(conversation)));
          return [
            getConversationCustomerLabel(conversation),
            conversation.category,
            latestMessage ? getMessageText(latestMessage) : conversation.latestMessage,
                  ].some((value) => String(value ?? "").toLowerCase().includes(query));
                })
              : items;

            const orderedVisibleItems = mode === "handover"
              ? [...visibleItems].sort((first, second) => {
                  const firstChannel = getConversationChannel(first) ?? "other";
                  const secondChannel = getConversationChannel(second) ?? "other";
                  return firstChannel.localeCompare(secondChannel);
                })
              : visibleItems;

            return (
              <div className="grid h-full min-h-0 grid-rows-[minmax(0,0.4fr)_minmax(0,0.6fr)] overflow-hidden rounded border border-[#26344a] bg-[#0b1220] sm:grid-rows-1 sm:grid-cols-[minmax(175px,0.6fr)_minmax(0,1.4fr)] xl:grid-cols-[minmax(310px,0.72fr)_minmax(540px,1.4fr)]">
                <aside className="flex min-h-0 flex-col border-b border-[#26344a] bg-[#101827] sm:border-b-0 sm:border-r">
                  <div className="border-b border-[#26344a] bg-[#101827] p-3">
                    <CustomerNameSearch
                      id="queue-customer-search"
                      conversations={items}
                      value={ticketSearch}
                      onChange={setTicketSearch}
                    />
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                    {orderedVisibleItems.length === 0 ? (
                      <div className="flex items-center gap-2 p-5 text-sm text-slate-400">
                        <Inbox className="h-4 w-4" /> No matching tickets
                      </div>
                    ) : (
                      orderedVisibleItems.map((conversation, index) => {
                        const conversationId = String(getConversationId(conversation));
                        const latestMessage = previewMessageByConversation.get(conversationId);
                        const selected = selectedConversationId === conversationId;
                        const conversationChannel = getConversationChannel(conversation);
                        const previousChannel = index > 0 ? getConversationChannel(orderedVisibleItems[index - 1]) : null;
                        const showChannelHeading = mode === "handover" && conversationChannel !== previousChannel;
                        const queueLabel = mode === "active"
                          ? "Active"
                          : isReturnedToAiConversation(conversation)
                          ? "Returned to AI"
                          : "To support agent";

                        return (
                          <div key={conversationId}>
                            {showChannelHeading && (
                              <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-[#26344a] bg-[#182438] px-4 py-2 text-[11px] font-semibold uppercase text-slate-300">
                                {conversationChannel && <ChannelIcon channel={conversationChannel} className="h-5 w-5" />}
                                {conversationChannel ? channelLabel(conversationChannel) : "Other"}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => setParams({ view: mode, ticket: conversationId, conversation: null })}
                              className={`w-full border-b border-[#26344a] px-4 py-4 text-left text-slate-100 transition ${selected
                                ? "border-l-[3px] border-l-sky-500 bg-[#182438]"
                                : "border-l-[3px] border-l-transparent hover:bg-[#182438]"
                              }`}
                            >
                              <span className="flex items-start gap-3">
                                <CustomerAvatar
                                  profilePictureUrl={getProfilePictureUrl(latestMessage, conversation)}
                                  label={getConversationCustomerLabel(conversation)}
                                  fallbackClassName="bg-[#1d2b40] text-slate-200"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center justify-between gap-2">
                                    <span className="truncate text-sm font-semibold text-slate-100">{getConversationCustomerLabel(conversation)}</span>
                                    <span className="shrink-0 text-[11px] text-slate-400">{formatDateTime(conversation.lastMessageAt)}</span>
                                  </span>
                                  <span className="mt-1 block truncate text-xs text-slate-300">
                                    {(latestMessage ? getMessageText(latestMessage) : conversation.latestMessage) || "Open ticket to view messages"}
                                  </span>
                                  <span className="mt-2 flex items-center gap-2 text-[10px]">
                                    <span className="rounded bg-[#26344a] px-2 py-0.5 font-medium text-slate-200">{queueLabel}</span>
                                    {conversation.category && <span className="truncate text-slate-400">{categoryLabel(conversation.category)}</span>}
                                  </span>
                                </span>
                              </span>
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </aside>
                <div className="min-h-0 min-w-0 bg-[#0b1220]">
                  {selectedConversation ? (
                    <MessageThreadPanel
                      selectedConversation={selectedConversation}
                      threadMessages={threadMessages}
                      threadLoading={threadLoading}
                      threadError={threadError}
                      replyText={replyText}
                      replySending={replySending}
                      currentUsername={currentUsername}
                      canPick={mode === "handover" && !isAssignedToCurrentUser(selectedConversation)}
                      pickLoading={actionLoading === `pick-${getConversationId(selectedConversation)}`}
                      canHandOver={mode === "active" && isAssignedToCurrentUser(selectedConversation)}
                      handoverLoading={actionLoading === `handover-${getConversationId(selectedConversation)}`}
                      canClose={mode === "active" && isAssignedToCurrentUser(selectedConversation)}
                      closeLoading={actionLoading === `close-${getConversationId(selectedConversation)}`}
                      onReplyTextChange={setReplyText}
                      onSendReply={sendConversationReply}
                      onPick={() => pickConversation(selectedConversation)}
                      onOpenHandover={() => openHandoverDialog(selectedConversation)}
                      onOpenClose={() => openCloseDialog(selectedConversation)}
                    />
                  ) : (
                    <div className="flex min-h-[600px] items-center justify-center gap-3 text-sm text-muted-foreground">
                      <MessageCircle className="h-5 w-5" /> Select a ticket to open its thread
                    </div>
                  )}
                </div>
              </div>
            );
  };

  return (
    <div className={selectedConversationId || (currentView === "new" && selectedChannel) ? "-mx-4 -my-4 h-[calc(100dvh-3.25rem)] min-h-0 overflow-hidden sm:-mx-6 sm:-my-6 lg:-mx-8 lg:-my-8" : "space-y-4"}>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {globalSearch && (
        <section className="space-y-4">
          <div>
            <h3 className="text-xl font-semibold text-foreground">Search results</h3>
            <p className="text-sm text-muted-foreground">{searchResults.length} tickets matching “{globalSearch}”</p>
          </div>
          {searchResults.length === 0 ? (
            <div className="flex items-center gap-3 rounded-md border bg-white p-6 text-muted-foreground">
              <Inbox className="h-5 w-5" /> No matching tickets
            </div>
          ) : threadLoading && selectedConversationId ? (
            <div className="flex min-h-[600px] items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading conversation
            </div>
          ) : (
            <div className="space-y-3">
              {searchResults.map((conversation) => (
                <MessageTicketCard
                  key={String(getConversationId(conversation))}
                  conversation={conversation}
                  mode={isActiveConversation(conversation) ? "active" : isHandedOverConversation(conversation) ? "handover" : "new"}
                  latestMessage={conversation.messages?.at(-1)}
                  actionLoading={actionLoading}
                  selectedConversationId={selectedConversationId}
                  currentUsername={currentUsername}
                  previewMessagesLoading={false}
                  onOpenThread={(conversationId) => setParams({ ticket: conversationId })}
                  onPickConversation={pickConversation}
                  onMarkPendingCustomer={markPendingCustomer}
                  onOpenCloseDialog={openCloseDialog}
                  onHandoverConversation={openHandoverDialog}
                  isAssignedToCurrentUser={isAssignedToCurrentUser}
                />
              ))}
            </div>
          )}
          {selectedConversation && (
            <div className="overflow-hidden rounded-md border bg-white">
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
            </div>
          )}
        </section>
      )}

      {currentView === "new" && selectedConversationId && !selectedChannel && !globalSearch && (
        <section className="h-full min-h-0 overflow-hidden rounded-md border border-[#26344a] bg-[#0b1220]">
          {selectedConversation ? (
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
          ) : threadLoading ? (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading conversation
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-4 text-sm text-rose-200">
              {threadError || "Unable to load this conversation."}
            </div>
          )}
        </section>
      )}

      {currentView === "new" && !selectedChannel && !globalSearch && !selectedConversationId && (
        <section className="space-y-3">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {channelStats.map((channel) => (
              <Card
                key={channel.id}
                role="button"
                tabIndex={0}
                className="group cursor-pointer transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"
                onClick={() =>
                  setParams({ view: "new", channel: channel.id, sentiment: null, category: null, ticket: null, conversation: null })
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setParams({
                      view: "new",
                      channel: channel.id,
                      sentiment: null,
                      category: null,
                      ticket: null,
                      conversation: null,
                    });
                  }
                }}
              >
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <ChannelIcon channel={channel.id} className="h-12 w-12" />
                    <p className="min-w-0 flex-1 text-lg font-semibold text-foreground">{channel.label}</p>
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted transition group-hover:bg-primary/10 group-hover:text-primary"><ArrowRight className="h-4 w-4" /></span>
                  </div>
                  <div className="mt-5 flex items-end gap-5">
                    <div><p className="text-2xl font-bold">{channel.activeCount}</p><p className="text-xs text-muted-foreground">active tickets</p></div>
                    <span className="mb-1 h-9 w-px bg-border" />
                    <div><p className="text-2xl font-bold">{channel.newCount}</p><p className="text-xs text-muted-foreground">new tickets</p></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {currentView === "new" && selectedChannel && !globalSearch && (
        <section className="flex h-full min-h-0 flex-col gap-3">
          {previewMessagesError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{previewMessagesError}</AlertDescription>
            </Alert>
          )}

          {selectedNewConversations.length === 0 && !selectedConversation && !threadLoading && !previewMessagesLoading ? (
            <Card>
              <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
                <Inbox className="h-5 w-5" />
                No new tickets
              </CardContent>
            </Card>
          ) : (
            <div className={`grid min-h-0 flex-1 overflow-hidden rounded-md border border-[#26344a] bg-[#0b1220] ${selectedConversationId ? "grid-rows-[minmax(0,0.4fr)_minmax(0,0.6fr)] sm:grid-rows-1 sm:grid-cols-[minmax(175px,0.6fr)_minmax(0,1.4fr)] xl:grid-cols-[minmax(310px,0.72fr)_minmax(520px,1.35fr)]" : "grid-cols-1 grid-rows-1"}`}>
              <aside className="flex min-h-0 flex-col border-b border-[#26344a] bg-[#101827] sm:border-b-0 sm:border-r">
                <div className="border-b border-[#26344a] bg-[#101827] p-3">
                  <CustomerNameSearch
                    id="new-customer-search"
                    conversations={selectedNewConversations}
                    value={ticketSearch}
                    onChange={setTicketSearch}
                  />
                </div>
                <div className="flex shrink-0 items-center gap-2 border-b border-[#26344a] bg-[#182438] px-4 py-2 text-[11px] font-semibold uppercase text-slate-300">
                  <ChannelIcon channel={selectedChannel} className="h-5 w-5" />
                  <span>{channelLabel(selectedChannel)}</span>
                  <span className="ml-auto font-normal normal-case text-slate-400">{selectedNewConversations.length} new</span>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                  {filteredNewConversations.length === 0 ? (
                    <div className="flex items-center gap-2 p-5 text-sm text-slate-400">
                      <Inbox className="h-4 w-4" /> No matching tickets
                    </div>
                  ) : (
                    filteredNewConversations.map((conversation) => {
                      const conversationId = String(getConversationId(conversation));
                      const latestMessage = previewMessageByConversation.get(conversationId);
                      const selected = selectedConversationId === conversationId;
                      return (
                        <button
                          key={conversationId}
                          type="button"
                          onClick={() => setParams({ view: "new", ticket: conversationId, conversation: null })}
                          className={`w-full border-b border-[#26344a] px-4 py-4 text-left text-slate-100 transition hover:bg-[#182438] ${selected ? "border-l-[3px] border-l-sky-500 bg-[#182438]" : "border-l-[3px] border-l-transparent"}`}
                        >
                          <div className="flex items-start gap-3">
                            <CustomerAvatar
                              profilePictureUrl={getProfilePictureUrl(latestMessage, conversation)}
                              label={getConversationCustomerLabel(conversation)}
                              fallbackClassName="bg-[#1d2b40] text-slate-200"
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <span className="truncate text-sm font-semibold text-slate-100">{getConversationCustomerLabel(conversation)}</span>
                                <span className="shrink-0 text-[11px] text-slate-400">{formatDateTime(conversation.lastMessageAt)}</span>
                              </span>
                              <span className="mt-1 block truncate text-xs text-slate-300">
                                {(latestMessage ? getMessageText(latestMessage) : "") || "Open ticket to view messages"}
                              </span>
                              <span className="mt-2 inline-flex rounded bg-amber-950 px-2 py-0.5 text-[10px] font-medium text-amber-300">New</span>
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </aside>
              {selectedConversationId && <div className="min-h-0 min-w-0 bg-[#0b1220]">
                {selectedConversation ? (
                  <MessageThreadPanel
                    selectedConversation={selectedConversation}
                    threadMessages={threadMessages}
                    threadLoading={threadLoading}
                    threadError={threadError}
                    replyText={replyText}
                    replySending={replySending}
                    currentUsername={currentUsername}
                    canPick={!isAssignedToCurrentUser(selectedConversation)}
                    pickLoading={actionLoading === `pick-${getConversationId(selectedConversation)}`}
                    onReplyTextChange={setReplyText}
                    onSendReply={sendConversationReply}
                    onPick={() => pickConversation(selectedConversation)}
                  />
                ) : threadLoading && selectedConversationId ? (
                  <div className="flex h-full min-h-0 items-center justify-center gap-2 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading conversation
                  </div>
                ) : (
                  <div className="flex h-full min-h-0 items-center justify-center gap-3 text-sm text-slate-400">
                    <MessageCircle className="h-5 w-5" /> Select a ticket to open its thread
                  </div>
                )}
              </div>}
            </div>
          )}
        </section>
      )}

      {currentView === "handover" && (
        <section className={selectedConversationId ? "h-full min-h-0" : "space-y-2"}>
          {previewMessagesError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{previewMessagesError}</AlertDescription>
            </Alert>
          )}

          {selectedHandedOverConversations.length === 0 && !selectedConversation && !threadLoading ? (
            <Card>
              <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
                <Inbox className="h-5 w-5" />
                No handed over tickets
              </CardContent>
            </Card>
          ) : (
            renderTicketWorkspace(selectedHandedOverConversations, "handover")
          )}
        </section>
      )}

      {currentView === "active" && (
        <section className={selectedConversationId ? "h-full min-h-0" : "space-y-2"}>
          {previewMessagesError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{previewMessagesError}</AlertDescription>
            </Alert>
          )}

          {selectedActiveConversations.length === 0 && !selectedConversation && !threadLoading ? (
            <Card>
              <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
                <Inbox className="h-5 w-5" />
                No active tickets
              </CardContent>
            </Card>
          ) : (
            renderTicketWorkspace(selectedActiveConversations, "active")
          )}

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

      <Dialog
        open={Boolean(handoverDialogConversation)}
        onOpenChange={(open) => {
          if (!open) resetHandoverDialog();
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Return conversation to AI agent</DialogTitle>
            <DialogDescription>
              {getConversationCustomerLabel(handoverDialogConversation)}
              {handoverDialogConversation
                ? ` will continue in the same ${getConversationChannel(handoverDialogConversation) ?? "channel"} conversation.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="handover-note">Handover note</Label>
            <Textarea
              id="handover-note"
              value={handoverNote}
              onChange={(event) => setHandoverNote(event.target.value)}
              placeholder={
                "Add context for the AI agent to continue the chat"
              }
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetHandoverDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={confirmHandoverConversation}
              disabled={actionLoading?.startsWith("handover-")}
            >
              {actionLoading?.startsWith("handover-") && <Loader2 className="h-4 w-4 animate-spin" />}
              Return to AI agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Messages;
