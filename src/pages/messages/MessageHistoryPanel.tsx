import { Loader2, MessageCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ConversationChannelSummary, ConversationThreadEntity } from "@/lib/conversations";
import type { HistoryChannelBucket } from "./messages.utils";
import {
  DEFAULT_CONVERSATION_STATUSES,
  getConversationChannel,
  getConversationCustomerLabel,
  getMessageAnsweredBy,
  getMessageCustomerLabel,
  getMessageText,
  isLastAnsweredByAiAgent,
  isMessageAnsweredByAiAgent,
  statusLabel,
} from "@/lib/conversations";
import { categoryLabel } from "@/lib/conversations";
import type { FormEvent } from "react";

interface MessageHistoryPanelProps {
  historyAgent: string;
  historyCustomer: string;
  historyChannel: string | null;
  historyStatus: string;
  historyCategory: string;
  historyFrom: string;
  historyTo: string;
  historySummary: ConversationChannelSummary[];
  historyThreads: ConversationThreadEntity[];
  historyLoading: boolean;
  historyError: string | null;
  historySearched: boolean;
  historyCategoryOptions: string[];
  historyChannelBuckets: HistoryChannelBucket[];
  selectedHistoryBucket: HistoryChannelBucket | null;
  onSearchHistory: (event: FormEvent<HTMLFormElement>) => void;
  onSelectHistoryChannel: (channel: string) => void;
  setHistoryAgent: (value: string) => void;
  setHistoryCustomer: (value: string) => void;
  setHistoryStatus: (value: string) => void;
  setHistoryCategory: (value: string) => void;
  setHistoryFrom: (value: string) => void;
  setHistoryTo: (value: string) => void;
}

const renderHistoryBucket = (
  bucket: HistoryChannelBucket,
  selected: boolean,
  onSelect: (key: string) => void,
  disabled: boolean
) => {
  const statusText = Object.entries(bucket.statuses)
    .filter(([, total]) => Number(total) > 0)
    .sort(([firstStatus], [secondStatus]) => firstStatus.localeCompare(secondStatus))
    .slice(0, 2)
    .map(([status, total]) => `${statusLabel(status)} ${Number(total)}`)
    .join(" · ");

  return (
    <button
      key={bucket.key}
      type="button"
      disabled={disabled}
      onClick={() => onSelect(bucket.key)}
      className={`rounded-md border bg-card p-4 text-left transition ${
        selected ? "border-primary ring-1 ring-primary" : "hover:border-primary/50 hover:shadow-sm"
      } disabled:cursor-not-allowed disabled:opacity-70`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            {disabled ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageCircle className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{bucket.label}</p>
            {statusText && <p className="truncate text-xs text-muted-foreground">{statusText}</p>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-3xl font-bold leading-none text-foreground">{bucket.total}</p>
          <p className="text-xs text-muted-foreground">threads</p>
        </div>
      </div>
    </button>
  );
};

const renderHistoryThread = (thread: ConversationThreadEntity, index: number) => {
  const conversation = thread.conversation;
  const conversationId = conversation?.id ?? conversation?.conversationId ?? index;
  const channel = conversation ? getConversationChannel(conversation) : null;
  const messages = thread.messages ?? [];
  const agents = thread.agentUsernames ?? [];
  const lastAnsweredBy = conversation?.lastAnsweredBy;
  const answeredByAi = isLastAnsweredByAiAgent(conversation);
  const customerLabel = getConversationCustomerLabel(conversation);

  return (
    <Card key={`${conversationId}-${index}`}>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">{customerLabel}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {channel && <span>{channel}</span>}
              <span>{statusLabel(conversation?.status)}</span>
              <span>{categoryLabel(conversation?.category)}</span>
              {answeredByAi && <span>AI answered</span>}
              <span>{conversation?.lastMessageAt || ""}</span>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Badge variant="outline">{thread.agentCount ?? agents.length} agent(s)</Badge>
            {agents.map((agent) => (
              <Badge key={agent} variant="secondary">
                {agent}
              </Badge>
            ))}
          </div>
        </div>

        <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border bg-muted/20 p-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No messages found</p>
          ) : (
            messages.map((message, messageIndex) => {
              const senderType = String(message.senderType || "").toUpperCase();
              const fromAgent = senderType === "AGENT";
              const isSystem = senderType === "SYSTEM";
              const senderLabel = isSystem
                ? "System"
                : fromAgent
                ? getMessageAnsweredBy(message) || "Agent"
                : getMessageCustomerLabel(message, conversation);
              const answeredByAiAgent = isMessageAnsweredByAiAgent(message);

              return (
                <div
                  key={`${message.id ?? message.messageId ?? messageIndex}`}
                  className={fromAgent ? "ml-auto max-w-[85%]" : "max-w-[85%]"}
                >
                  <div
                    className={
                      isSystem
                        ? "rounded-md bg-background px-3 py-2 text-xs text-muted-foreground"
                        : fromAgent
                        ? "rounded-md bg-primary/10 px-3 py-2 text-sm text-foreground"
                        : "rounded-md bg-background px-3 py-2 text-sm text-foreground"
                    }
                  >
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="font-medium">
                        {senderLabel}
                        {answeredByAiAgent ? " · AI agent" : ""}
                      </span>
                      <span>{message.createdAt || ""}</span>
                    </div>
                    <p className="whitespace-pre-wrap break-words leading-5">{getMessageText(message) || "No message body"}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const MessageHistoryPanel = ({
  historyAgent,
  historyCustomer,
  historyChannel,
  historyStatus,
  historyCategory,
  historyFrom,
  historyTo,
  historySummary,
  historyThreads,
  historyLoading,
  historyError,
  historySearched,
  historyCategoryOptions,
  historyChannelBuckets,
  selectedHistoryBucket,
  onSearchHistory,
  onSelectHistoryChannel,
  setHistoryAgent,
  setHistoryCustomer,
  setHistoryStatus,
  setHistoryCategory,
  setHistoryFrom,
  setHistoryTo,
}: MessageHistoryPanelProps) => {
  return (
    <div className="space-y-4 border-t pt-5">
      <div>
        <h3 className="text-xl font-semibold text-foreground">Conversation history</h3>
        <p className="text-sm text-muted-foreground">
          Search full customer timelines by agent, customer, category, status, and date.
        </p>
      </div>

      <form onSubmit={onSearchHistory} className="rounded-md border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="history-agent">Agent</Label>
            <Input
              id="history-agent"
              value={historyAgent}
              onChange={(event) => setHistoryAgent(event.target.value)}
              placeholder="sw54903"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="history-customer">Customer</Label>
            <Input
              id="history-customer"
              value={historyCustomer}
              onChange={(event) => setHistoryCustomer(event.target.value)}
              placeholder="254..."
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={historyStatus} onValueChange={setHistoryStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {DEFAULT_CONVERSATION_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {statusLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={historyCategory} onValueChange={setHistoryCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {historyCategoryOptions.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="history-from">From</Label>
            <Input
              id="history-from"
              type="date"
              value={historyFrom}
              onChange={(event) => setHistoryFrom(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="history-to">To</Label>
            <Input
              id="history-to"
              type="date"
              value={historyTo}
              onChange={(event) => setHistoryTo(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full" disabled={historyLoading}>
              {historyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
            </Button>
          </div>
        </div>
      </form>

      {historyError && (
        <Alert variant="destructive">
          <AlertDescription>{historyError}</AlertDescription>
        </Alert>
      )}

      {historyLoading && historyChannelBuckets.length === 0 ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading history
        </div>
      ) : null}

      {historyChannelBuckets.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {historyChannelBuckets.map((bucket) =>
            renderHistoryBucket(bucket, historyChannel === bucket.key, onSelectHistoryChannel, historyLoading)
          )}
        </div>
      )}

      {selectedHistoryBucket && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="font-semibold text-foreground">{selectedHistoryBucket.label} history</h4>
              <p className="text-sm text-muted-foreground">{selectedHistoryBucket.total} conversation thread(s)</p>
            </div>
            {historyLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading {selectedHistoryBucket.label}
              </div>
            )}
          </div>

          {!historyLoading && historyThreads.length > 0 ? (
            <div className="space-y-3">
              {historyThreads.map(renderHistoryThread)}
            </div>
          ) : !historyLoading ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              No {selectedHistoryBucket.label} history found
            </div>
          ) : null}
        </div>
      )}

      {!historyLoading && historySearched && historyChannelBuckets.length === 0 && (
        <div className="rounded-md border p-4 text-sm text-muted-foreground">No matching history found</div>
      )}

      {!historyLoading && historySearched && historyChannelBuckets.length > 0 && !historyChannel && (
        <div className="rounded-md border p-4 text-sm text-muted-foreground">
          Select a channel to load the conversation threads
        </div>
      )}

      {!historyLoading && !historySearched && (
        <div className="rounded-md border p-4 text-sm text-muted-foreground">No history loaded</div>
      )}
    </div>
  );
};
