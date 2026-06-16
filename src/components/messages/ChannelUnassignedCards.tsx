import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ChannelIcon } from "@/components/messages/ChannelIcon";
import { ConversationChannel, ConversationChannelSummary } from "@/lib/conversations";

interface ChannelTicketCardProps {
  channel: ConversationChannel;
  label: string;
  activeCount: number;
  newCount: number;
  onSelect: () => void;
  showArrow?: boolean;
}

export const ChannelTicketCard = ({
  channel,
  label,
  activeCount,
  newCount,
  onSelect,
  showArrow = true,
}: ChannelTicketCardProps) => (
  <Card
    className="cursor-pointer transition-shadow hover:shadow-md"
    role="button"
    tabIndex={0}
    onClick={onSelect}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect();
      }
    }}
  >
    <CardContent className="flex items-center gap-4 p-5">
      <ChannelIcon channel={channel} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">{activeCount} active tickets</p>
      </div>
      <div className="text-right">
        <p className="text-3xl font-bold text-foreground">{newCount}</p>
        <p className="text-xs text-muted-foreground">new</p>
      </div>
      {showArrow && (
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground">
          <ArrowRight className="h-4 w-4" />
        </span>
      )}
    </CardContent>
  </Card>
);

interface ChannelUnassignedCardsProps {
  summary: ConversationChannelSummary[];
  loading?: boolean;
}

export const ChannelUnassignedCards = ({ summary, loading = false }: ChannelUnassignedCardsProps) => {
  const navigate = useNavigate();
  const totalUnassigned = summary.reduce((total, channel) => total + channel.unassigned, 0);

  return (
    <section className="mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Message Channels</h3>
          <p className="text-sm text-muted-foreground">New unassigned tickets by channel</p>
        </div>
        <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          <span className="text-muted-foreground">Total unassigned</span>
          <span className="font-semibold text-foreground">{totalUnassigned}</span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summary.map((channel) => (
          <ChannelTicketCard
            key={channel.channel}
            channel={channel.channel}
            label={channel.label}
            activeCount={channel.total}
            newCount={channel.unassigned}
            onSelect={() => navigate(`/messages?view=new&channel=${channel.channel}`)}
          />
        ))}
      </div>
    </section>
  );
};
