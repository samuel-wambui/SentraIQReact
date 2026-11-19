import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildConversationSummary,
  ConversationEntity,
} from "@/lib/conversations";
import { TicketsApi, ticketQueuesToConversations } from "@/lib/tickets";

interface UseConversationsOptions {
  token?: string | null;
  pollingIntervalMs?: number;
}

export const useConversations = ({
  token,
  pollingIntervalMs = 30000,
}: UseConversationsOptions) => {
  const [conversations, setConversations] = useState<ConversationEntity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const clearState = useCallback(() => {
    hasLoadedRef.current = false;
    setConversations([]);
    setLoading(false);
    setError(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!token) {
      clearState();
      return;
    }

    setLoading(!hasLoadedRef.current);
    try {
      const queues = await TicketsApi.getTicketQueues();
      setConversations(ticketQueuesToConversations(queues));
      hasLoadedRef.current = true;
      setError(null);
    } catch (refreshError) {
      const message =
        refreshError instanceof Error ? refreshError.message : "Unable to sync tickets.";
      setError(message);
      throw refreshError;
    } finally {
      setLoading(false);
    }
  }, [clearState, token]);

  useEffect(() => {
    if (!token) {
      clearState();
      return;
    }

    refresh().catch((refreshError) => {
      console.error("Unable to sync tickets", refreshError);
    });
  }, [clearState, refresh, token]);

  useEffect(() => {
    if (!token) return;

    const intervalId = window.setInterval(() => {
      refresh().catch((pollError) => {
        console.error("Unable to poll tickets", pollError);
      });
    }, pollingIntervalMs);

    return () => window.clearInterval(intervalId);
  }, [pollingIntervalMs, refresh, token]);

  const summary = useMemo(() => buildConversationSummary(conversations), [conversations]);
  const totalUnassigned = useMemo(
    () => summary.reduce((total, channel) => total + channel.unassigned, 0),
    [summary]
  );

  return {
    conversations,
    summary,
    totalUnassigned,
    loading,
    error,
    refresh,
  };
};
