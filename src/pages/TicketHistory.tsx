import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  getAssignedAgentUsername,
  getConversationChannel,
  getConversationCustomerLabel,
  normalizeConversationChannel,
  type ConversationChannelSummary,
  type ConversationEntity,
  type ConversationThreadEntity,
} from "@/lib/conversations";
import {
  buildTicketSummary,
  TicketsApi,
  ticketToConversationThread,
  type TicketQueueKind,
  type TicketResponseDTO,
} from "@/lib/tickets";
import { MessageHistoryPanel } from "./messages/MessageHistoryPanel";
import {
  getCategoryKey,
  getChannelBuckets,
  type HistoryChannelBucket,
} from "./messages/messages.utils";

const collectTicketCategories = (tickets: TicketResponseDTO[]) =>
  Array.from(
    new Set(
      tickets
        .map((ticket) => String(ticket.category || "").trim())
        .filter(Boolean)
    )
  ).sort((first, second) => first.localeCompare(second));

const TicketHistory = () => {
  const { accessToken } = useAuth();
  const [historyAgent, setHistoryAgent] = useState("");
  const [historyCustomer, setHistoryCustomer] = useState("");
  const [historyChannel, setHistoryChannel] = useState<string | null>(null);
  const [historyStatus, setHistoryStatus] = useState("all");
  const [historyCategory, setHistoryCategory] = useState("all");
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [historySummary, setHistorySummary] = useState<ConversationChannelSummary[]>([]);
  const [historyThreads, setHistoryThreads] = useState<ConversationThreadEntity[]>([]);
  const [historyCategoryOptions, setHistoryCategoryOptions] = useState<string[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historySearched, setHistorySearched] = useState(false);

  const logBackendDebug = (label: string, payload: unknown) => {
    console.debug(`[TicketHistory] ${label}`, payload);
  };

  const mergeTicketCategories = useCallback((tickets: TicketResponseDTO[]) => {
    const nextCategories = collectTicketCategories(tickets);
    setHistoryCategoryOptions((currentCategories) =>
      Array.from(new Set([...currentCategories, ...nextCategories])).sort((first, second) =>
        first.localeCompare(second)
      )
    );
  }, []);

  useEffect(() => {
    let mounted = true;

    if (!accessToken) {
      setHistoryCategoryOptions([]);
      return () => {
        mounted = false;
      };
    }

    TicketsApi.getAllTickets()
      .then((tickets) => {
        if (mounted) {
          mergeTicketCategories(tickets);
        }
      })
      .catch((categoryLoadError) => {
        console.debug("[TicketHistory] category options not loaded", categoryLoadError);
      });

    return () => {
      mounted = false;
    };
  }, [accessToken, mergeTicketCategories]);

  const historyChannelBuckets = useMemo<HistoryChannelBucket[]>(
    () => getChannelBuckets(historySummary),
    [historySummary]
  );

  const selectedHistoryBucket = useMemo(
    () => historyChannelBuckets.find((bucket) => bucket.key === historyChannel) ?? null,
    [historyChannel, historyChannelBuckets]
  );

  const loadHistoryTicketThreads = useCallback(
    async (source?: string | null): Promise<ConversationThreadEntity[]> => {
      if (!accessToken) {
        throw new Error("Sign in before loading ticket history.");
      }

      const status = String(historyStatus || "all").toUpperCase();
      let ticketsWithQueue: Array<{ ticket: TicketResponseDTO; queue: TicketQueueKind }> = [];

      if (status === "CLOSED") {
        ticketsWithQueue = (await TicketsApi.getClosedTickets()).map((ticket) => ({ ticket, queue: "closed" }));
      } else if (status === "OPEN") {
        ticketsWithQueue = (await TicketsApi.getOpenTickets()).map((ticket) => ({ ticket, queue: "open" }));
      } else {
        ticketsWithQueue = (await TicketsApi.getAllTickets()).map((ticket) => ({ ticket, queue: "all" }));
      }

      mergeTicketCategories(ticketsWithQueue.map(({ ticket }) => ticket));

      const agentFilter = historyAgent.trim().toLowerCase();
      const customerFilter = historyCustomer.trim().toLowerCase();
      const categoryFilter = historyCategory !== "all" ? getCategoryKey(historyCategory) : null;
      const fromTime = historyFrom ? new Date(`${historyFrom}T00:00:00`).getTime() : null;
      const toTime = historyTo ? new Date(`${historyTo}T23:59:59`).getTime() : null;
      const sourceFilter = source ? normalizeConversationChannel(source) ?? source : null;

      return ticketsWithQueue
        .map(({ ticket, queue }) => ticketToConversationThread(ticket, queue))
        .filter((thread) => {
          const conversation = thread.conversation;
          if (!conversation) return false;

          if (sourceFilter && getConversationChannel(conversation) !== sourceFilter) {
            return false;
          }

          if (agentFilter) {
            const agentValues = [
              getAssignedAgentUsername(conversation),
              conversation.handedOverByUsername,
              ...(thread.agentUsernames ?? []),
            ]
              .map((value) => String(value ?? "").toLowerCase())
              .filter(Boolean);
            if (!agentValues.some((value) => value.includes(agentFilter))) return false;
          }

          if (customerFilter) {
            const customerValues = [
              getConversationCustomerLabel(conversation),
              conversation.senderId,
              conversation.senderName,
            ]
              .map((value) => String(value ?? "").toLowerCase())
              .filter(Boolean);
            if (!customerValues.some((value) => value.includes(customerFilter))) return false;
          }

          if (categoryFilter && getCategoryKey(conversation.category) !== categoryFilter) {
            return false;
          }

          const conversationTime = conversation.lastMessageAt ? new Date(conversation.lastMessageAt).getTime() : 0;
          if (fromTime && conversationTime < fromTime) return false;
          if (toTime && conversationTime > toTime) return false;

          return true;
        });
    },
    [
      accessToken,
      historyAgent,
      historyCategory,
      historyCustomer,
      historyFrom,
      historyStatus,
      historyTo,
      mergeTicketCategories,
    ]
  );

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
      const threads = await loadHistoryTicketThreads();
      const summary = buildTicketSummary(
        threads.map((thread) => thread.conversation).filter(Boolean) as ConversationEntity[]
      );

      logBackendDebug("historySummary loaded", { count: summary.length, summary });
      setHistorySummary(summary);
      setHistoryError(null);
    } catch (historyLoadError) {
      const description = historyLoadError instanceof Error ? historyLoadError.message : "Unable to fetch ticket history.";
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
      const threads = await loadHistoryTicketThreads(source);

      logBackendDebug("historyThreads loaded", { count: threads.length, threads });
      setHistoryThreads(threads);
      setHistoryError(null);
    } catch (historyLoadError) {
      const description = historyLoadError instanceof Error ? historyLoadError.message : "Unable to fetch ticket history.";
      setHistoryError(description);
      setHistoryThreads([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Ticket History</h2>
          <p className="text-muted-foreground">Search open and closed ticket timelines by channel, customer, and agent.</p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadHistoryChannelSummary()}
          disabled={historyLoading}
        >
          <RefreshCw className={historyLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </Button>
      </div>

      {!accessToken && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Sign in before loading ticket history.</AlertDescription>
        </Alert>
      )}

      <MessageHistoryPanel
        showHeader={false}
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
  );
};

export default TicketHistory;
