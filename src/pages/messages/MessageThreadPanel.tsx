import { Inbox, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { FormEvent } from "react";
import type { ConversationEntity, ConversationMessageEntity } from "@/lib/conversations";
import {
  formatDateTime,
  getChatInitial,
  getHandedOverAt,
  getHandoverNote,
  getLastAnsweredBy,
  isLastAnsweredByAiAgent,
  getMessageText,
  getHandoverAgentLabel,
} from "./messages.utils";
import {
  getConversationCustomerLabel,
  getMessageCustomerLabel,
  getMessageAnsweredBy,
  isAiAgentHandoverActive,
  isMessageAnsweredByAiAgent,
} from "@/lib/conversations";

interface MessageThreadPanelProps {
  selectedConversation: ConversationEntity;
  threadMessages: ConversationMessageEntity[];
  threadLoading: boolean;
  threadError: string | null;
  replyText: string;
  replySending: boolean;
  currentUsername: string | null;
  onReplyTextChange: (value: string) => void;
  onSendReply: (event: FormEvent<HTMLFormElement>) => void;
}

export const MessageThreadPanel = ({
  selectedConversation,
  threadMessages,
  threadLoading,
  threadError,
  replyText,
  replySending,
  currentUsername,
  onReplyTextChange,
  onSendReply,
}: MessageThreadPanelProps) => {
  const customerLabel = getConversationCustomerLabel(selectedConversation);

  return (
    <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-md border bg-white text-left shadow-sm">
      <div className="bg-primary px-4 py-3 text-primary-foreground">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-sm font-semibold">
              {getChatInitial(customerLabel)}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold leading-tight">
                {customerLabel}
              </p>
              <p className="truncate text-xs text-white/75">
                {selectedConversation.status && selectedConversation.category
                  ? `${selectedConversation.status} · ${selectedConversation.category}`
                  : ""}
                {selectedConversation.assignedAgentUsername ? ` · ${selectedConversation.assignedAgentUsername}` : ""}
                {isAiAgentHandoverActive(selectedConversation) ? " · AI handover" : ""}
                {getLastAnsweredBy(selectedConversation)
                  ? ` · Answered by ${getLastAnsweredBy(selectedConversation)}${
                      isLastAnsweredByAiAgent(selectedConversation) ? " (AI)" : ""
                    }`
                  : ""}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="h-[380px] overflow-y-auto bg-[#efeae2] px-3 py-4 sm:px-5">
        <div className="space-y-3">
          {getHandoverAgentLabel(selectedConversation) && (
            <div className="mx-auto max-w-[92%] rounded-full bg-white/80 px-3 py-1.5 text-center text-[11px] text-stone-600 shadow-sm sm:max-w-[72%]">
              Previous handler: {String(getHandoverAgentLabel(selectedConversation))}
              {getHandedOverAt(selectedConversation) ? ` · ${formatDateTime(getHandedOverAt(selectedConversation))}` : ""}
              {getHandoverNote(selectedConversation) ? ` · ${getHandoverNote(selectedConversation)}` : ""}
            </div>
          )}

          {threadError && (
            <Alert variant="destructive" className="bg-white">
              <AlertDescription>{threadError}</AlertDescription>
            </Alert>
          )}

          {threadLoading ? (
            <div className="flex h-48 items-center justify-center gap-2 text-sm text-stone-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading thread
            </div>
          ) : threadMessages.length === 0 ? (
            <div className="flex h-48 items-center justify-center gap-3 text-sm text-stone-600">
              <Inbox className="h-5 w-5" />
              No messages found
            </div>
          ) : (
            threadMessages.map((message, index) => {
              const senderType = String(message.senderType || "").toUpperCase();
              const fromAgent = senderType === "AGENT";
              const isSystem = senderType === "SYSTEM";
              const answeredByAiAgent = isMessageAnsweredByAiAgent(message);
              const senderLabel = isSystem
                ? "System"
                : fromAgent
                ? getMessageAnsweredBy(message) || message.senderId || currentUsername || "Agent"
                : getMessageCustomerLabel(message, selectedConversation);

              return (
                <div
                  key={`${message.id ?? message.messageId ?? index}`}
                  className={isSystem ? "flex justify-center" : `flex ${fromAgent ? "justify-end" : "justify-start"}`}>
                  <div
                    className={
                      isSystem
                        ? "max-w-[92%] rounded-full bg-white/80 px-3 py-1.5 text-center text-xs text-stone-600 shadow-sm sm:max-w-[72%]"
                        : fromAgent
                        ? "max-w-[82%] rounded-2xl rounded-br-sm bg-primary/10 px-3.5 py-2 text-sm text-stone-950 shadow-sm sm:max-w-[68%]"
                        : "max-w-[82%] rounded-2xl rounded-bl-sm bg-white px-3.5 py-2 text-sm text-stone-950 shadow-sm sm:max-w-[68%]"
                    }
                  >
                    {!isSystem && (
                      <p className="mb-1 text-[11px] font-semibold leading-none text-stone-500">
                        {senderLabel}
                        {answeredByAiAgent ? " · AI agent" : ""}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap break-words leading-5">
                      {getMessageText(message) || "No message body"}
                    </p>
                    {!isSystem && (
                      <p className="mt-1 text-right text-[10px] leading-none text-stone-500">
                        {formatDateTime(message.createdAt)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <form onSubmit={onSendReply} className="border-t bg-[#f0f2f5] p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={replyText}
            onChange={(event) => onReplyTextChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Type a message"
            rows={1}
            disabled={replySending || threadLoading}
            className="max-h-24 min-h-[44px] resize-none rounded-full border-0 bg-white px-4 py-2.5 shadow-sm focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0"
          />
          <Button
            type="submit"
            size="icon"
            aria-label="Send reply"
            className="h-11 w-11 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={replySending || threadLoading || !replyText.trim()}
          >
            {replySending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
};
