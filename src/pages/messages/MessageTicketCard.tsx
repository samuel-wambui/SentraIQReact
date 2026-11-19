import { MoreHorizontal, Clock, MessageCircle, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CustomerAvatar } from "@/components/messages/CustomerAvatar";
import {
  categoryLabel,
  channelLabel,
  getConversationChannel,
  getConversationCustomerLabel,
  getConversationDisplayStatus,
  getConversationStatus,
  getMessageText,
  getProfilePictureUrl,
  isAiAgentHandoverActive,
  isConversationUnassigned,
  isReturnedToAiConversation,
} from "@/lib/conversations";
import type { ConversationEntity, ConversationMessageEntity } from "@/lib/conversations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  QueueView,
  getAgentLabel,
  getHandoverAgentLabel,
  getHandedOverAt,
  getHandoverNote,
  getLastAnsweredAt,
  getLastAnsweredBy,
  isLastAnsweredByAiAgent,
  formatDateTime,
  statusBadgeVariant,
} from "./messages.utils";

interface MessageTicketCardProps {
  conversation: ConversationEntity;
  mode: QueueView;
  latestMessage?: ConversationMessageEntity;
  actionLoading: string | null;
  selectedConversationId?: string | null;
  currentUsername?: string | null;
  previewMessagesLoading?: boolean;
  onOpenThread: (conversationId: string) => void;
  onPickConversation: (conversation: ConversationEntity) => void;
  onMarkPendingCustomer: (conversation: ConversationEntity) => void;
  onOpenCloseDialog: (conversation: ConversationEntity) => void;
  onHandoverConversation: (conversation: ConversationEntity) => void;
  isAssignedToCurrentUser: (conversation: ConversationEntity) => boolean;
}

export const MessageTicketCard = ({
  conversation,
  mode,
  latestMessage,
  actionLoading,
  selectedConversationId,
  currentUsername,
  previewMessagesLoading = false,
  onOpenThread,
  onPickConversation,
  onMarkPendingCustomer,
  onOpenCloseDialog,
  onHandoverConversation,
  isAssignedToCurrentUser,
}: MessageTicketCardProps) => {
  const conversationId = conversation ? String(conversation.id ?? conversation.conversationId ?? "") : "";
  const status = getConversationStatus(conversation);
  const channel = getConversationChannel(conversation);
  const assignedToMe = isAssignedToCurrentUser(conversation);
  const messageText = getMessageText(latestMessage ?? conversation);
  const customerLabel = getConversationCustomerLabel(conversation, latestMessage);
  const handoverAgent = getHandoverAgentLabel(conversation);
  const handoverTime = getHandedOverAt(conversation);
  const handoverNote = getHandoverNote(conversation);
  const lastAnsweredBy = getLastAnsweredBy(conversation);
  const lastAnsweredAt = getLastAnsweredAt(conversation);
  const answeredByAi = isLastAnsweredByAiAgent(conversation);
  const isThreadOpen = conversationId && selectedConversationId === conversationId;
  const returnedToAi = isReturnedToAiConversation(conversation);
  const displayedStatus = getConversationDisplayStatus(conversation);

  const actionButtonLabel =
    mode === "handover"
      ? "Assign to me"
      : !isConversationUnassigned(conversation)
      ? "Take over ticket"
      : "Pick this ticket";

  const renderTicketActions = () => {
    const pickActionKey = `pick-${conversationId}`;
    const handoverActionKey = `handover-${conversationId}`;
    const closeActionKey = `close-${conversationId}`;

    if (mode === "active") {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="text-foreground">
              <MoreHorizontal className="h-4 w-4" />
              Actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!isThreadOpen && (
              <DropdownMenuItem disabled={!conversationId} onSelect={() => onOpenThread(conversationId)}>
                Open thread
              </DropdownMenuItem>
            )}
            {assignedToMe && (
              <DropdownMenuItem
                disabled={!conversationId || actionLoading === handoverActionKey}
                onSelect={() => onHandoverConversation(conversation)}
              >
                Return to AI agent
              </DropdownMenuItem>
            )}
            {assignedToMe && (
              <DropdownMenuItem
                disabled={!conversationId || actionLoading === closeActionKey}
                onSelect={() => onOpenCloseDialog(conversation)}
              >
                Close ticket
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return (
      <div className="flex flex-wrap items-center gap-2">
        {!isThreadOpen && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenThread(conversationId)}
            disabled={!conversationId}
          >
            Open thread
          </Button>
        )}
        {(!assignedToMe || mode === "new") && (
          <Button
            type="button"
            size="sm"
            onClick={() => onPickConversation(conversation)}
            disabled={!conversationId || actionLoading === pickActionKey}
          >
            {actionLoading === pickActionKey ? (
              <div className="h-4 w-4 animate-spin rounded-full border border-current border-t-transparent" />
            ) : (
              <UserCheck className="h-4 w-4" />
            )}
            {actionButtonLabel}
          </Button>
        )}
      </div>
    );
  };

  return (
    <Card key={conversationId || `${conversation.senderId}-${conversation.lastMessageAt}`}>
      <CardContent className="space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <CustomerAvatar
              profilePictureUrl={getProfilePictureUrl(latestMessage, conversation)}
              label={customerLabel}
            />
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">
                {customerLabel}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {channel && (
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {channelLabel(channel)}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDateTime(latestMessage?.createdAt ?? conversation.lastMessageAt)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Badge variant={statusBadgeVariant(status)}>{displayedStatus}</Badge>
            <Badge variant="outline">{categoryLabel(conversation.category)}</Badge>
            {isAiAgentHandoverActive(conversation) && <Badge variant="secondary">AI handover</Badge>}
            {lastAnsweredBy && (
              <Badge variant={answeredByAi ? "secondary" : "outline"}>
                Answered by {lastAnsweredBy}
              </Badge>
            )}
            {mode === "active" && (
              <Badge variant={assignedToMe ? "default" : "secondary"}>
                {assignedToMe ? "Assigned to me" : String(getAgentLabel(conversation))}
              </Badge>
            )}
            {handoverAgent && !returnedToAi && <Badge variant="outline">Handed over by {String(handoverAgent)}</Badge>}
            {returnedToAi && <Badge variant="secondary">AI handling</Badge>}
          </div>
        </div>

        {handoverAgent && (
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Previous handler:</span> {String(handoverAgent)}
            {handoverTime ? ` · ${formatDateTime(handoverTime)}` : ""}
            {handoverNote ? ` · ${handoverNote}` : ""}
          </div>
        )}

        {lastAnsweredBy && (
          <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Answered by:</span> {lastAnsweredBy}
            {answeredByAi ? " · AI agent" : ""}
            {lastAnsweredAt ? ` · ${formatDateTime(lastAnsweredAt)}` : ""}
          </div>
        )}

        {mode !== "active" && (
          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
            {messageText || (previewMessagesLoading ? "Loading message" : "No message body")}
          </p>
        )}

        {mode !== "active" && (latestMessage?.sentiment || conversation.sentiment || conversation.confidence) && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {(latestMessage?.sentiment || conversation.sentiment) && (
              <Badge variant="secondary">{latestMessage?.sentiment || conversation.sentiment}</Badge>
            )}
            {(latestMessage?.confidence || conversation.confidence) && (
              <span>Confidence {latestMessage?.confidence || conversation.confidence}</span>
            )}
          </div>
        )}

        {renderTicketActions()}
      </CardContent>
    </Card>
  );
};
