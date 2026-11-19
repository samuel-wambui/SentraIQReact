import { Inbox, Loader2, Send, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CustomerAvatar } from "@/components/messages/CustomerAvatar";
import type { FormEvent } from "react";
import type { ConversationEntity, ConversationMessageEntity } from "@/lib/conversations";
import {
  formatDateTime,
  getHandedOverAt,
  getHandoverNote,
  getLastAnsweredBy,
  isLastAnsweredByAiAgent,
  getMessageText,
  getHandoverAgentLabel,
} from "./messages.utils";
import {
  getConversationCustomerLabel,
  getConversationDisplayStatus,
  getMessageCustomerLabel,
  getMessageAnsweredBy,
  getProfilePictureUrl,
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
  canHandOver?: boolean;
  handoverLoading?: boolean;
  canClose?: boolean;
  closeLoading?: boolean;
  canPick?: boolean;
  pickLoading?: boolean;
  onReplyTextChange: (value: string) => void;
  onSendReply: (event: FormEvent<HTMLFormElement>) => void;
  onOpenHandover?: () => void;
  onOpenClose?: () => void;
  onPick?: () => void;
}

export const MessageThreadPanel = ({
  selectedConversation,
  threadMessages,
  threadLoading,
  threadError,
  replyText,
  replySending,
  currentUsername,
  canHandOver = false,
  handoverLoading = false,
  canClose = false,
  closeLoading = false,
  canPick = false,
  pickLoading = false,
  onReplyTextChange,
  onSendReply,
  onOpenHandover,
  onOpenClose,
  onPick,
}: MessageThreadPanelProps) => {
  const customerLabel = getConversationCustomerLabel(selectedConversation);
  const latestProfileMessage = [...threadMessages]
    .reverse()
    .find((message) => getProfilePictureUrl(message));
  const profilePictureUrl = getProfilePictureUrl(latestProfileMessage, selectedConversation);
  const handoverLabel = "Return to AI agent";
  const displayedStatus = getConversationDisplayStatus(selectedConversation);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[#111b2b] text-left text-slate-100">
      <div className="border-b border-[#26344a] bg-[#111b2b] px-5 py-4 text-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <CustomerAvatar
              profilePictureUrl={profilePictureUrl}
              label={customerLabel}
              className="h-11 w-11"
              fallbackClassName="bg-[#1d2b40] text-sky-300"
            />
            <div className="min-w-0">
              <p className="truncate font-semibold leading-tight">
                {customerLabel}
              </p>
              <p className="truncate text-xs text-slate-400">
                {selectedConversation.status && selectedConversation.category
                  ? `${displayedStatus} · ${selectedConversation.category}`
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
          {(canPick || canHandOver || canClose) && (
            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              {canPick && (
                <Button type="button" size="sm" onClick={onPick} disabled={pickLoading} className="bg-sky-600 text-white hover:bg-sky-500">
                  {pickLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                  Pick this ticket
                </Button>
              )}
              {canHandOver && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onOpenHandover}
                  disabled={handoverLoading}
                  className="border-[#344258] bg-[#111b2b] text-slate-200 hover:bg-[#1b293e] hover:text-white"
                >
                  {handoverLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {handoverLabel}
                </Button>
              )}
              {canClose && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onOpenClose}
                  disabled={closeLoading}
                  className="border-[#344258] bg-[#111b2b] text-slate-200 hover:bg-[#1b293e] hover:text-white"
                >
                  {closeLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Close
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#0b1220] px-3 py-4 sm:px-5">
        <div className="space-y-3">
          {getHandoverAgentLabel(selectedConversation) && (
            <div className="mx-auto max-w-[92%] rounded-full border border-[#26344a] bg-[#182438] px-3 py-1.5 text-center text-[11px] text-slate-300 sm:max-w-[72%]">
              Previous handler: {String(getHandoverAgentLabel(selectedConversation))}
              {getHandedOverAt(selectedConversation) ? ` · ${formatDateTime(getHandedOverAt(selectedConversation))}` : ""}
              {getHandoverNote(selectedConversation) ? ` · ${getHandoverNote(selectedConversation)}` : ""}
            </div>
          )}

          {threadError && (
            <Alert variant="destructive" className="border-rose-900/70 bg-rose-950/50 text-rose-200">
              <AlertDescription>{threadError}</AlertDescription>
            </Alert>
          )}

          {threadLoading ? (
            <div className="flex h-48 items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading thread
            </div>
          ) : threadMessages.length === 0 ? (
            <div className="flex h-48 items-center justify-center gap-3 text-sm text-slate-400">
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
                        ? "max-w-[92%] rounded-full border border-[#26344a] bg-[#182438] px-3 py-1.5 text-center text-xs text-slate-300 sm:max-w-[72%]"
                        : fromAgent
                        ? "max-w-[82%] rounded-md bg-[#173b67] px-3.5 py-3 text-sm text-white sm:max-w-[72%]"
                        : "max-w-[82%] rounded-md border border-[#26344a] bg-[#111b2b] px-3.5 py-3 text-sm text-slate-100 sm:max-w-[72%]"
                    }
                  >
                    {!isSystem && (
                      <p className="mb-1 text-[11px] font-semibold leading-none text-slate-300">
                        {senderLabel}
                        {answeredByAiAgent ? " · AI agent" : ""}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap break-words leading-5">
                      {getMessageText(message) || "No message body"}
                    </p>
                    {!isSystem && (
                      <p className="mt-1 text-right text-[10px] leading-none text-slate-400">
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

      <form onSubmit={onSendReply} className="shrink-0 border-t border-[#26344a] bg-[#111b2b] p-4">
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
            className="max-h-28 min-h-[74px] resize-none border-[#344258] bg-[#0b1220] px-4 py-3 text-slate-100 placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-sky-500 focus-visible:ring-offset-0"
          />
          <Button
            type="submit"
            size="icon"
            aria-label="Send reply"
            className="h-11 w-11 shrink-0 rounded-md bg-sky-600 text-white hover:bg-sky-500"
            disabled={replySending || threadLoading || !replyText.trim()}
          >
            {replySending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
};
