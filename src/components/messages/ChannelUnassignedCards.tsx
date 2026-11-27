import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ChannelIcon } from "@/components/messages/ChannelIcon";
import { ConversationChannel, ConversationChannelSummary } from "@/lib/conversations";

interface ChannelTicketCardProps {
  channel: ConversationChannel;
  label: string;
  newCount: number;
  onSelect: () => void;
}

export const ChannelTicketCard = ({
  channel,
  label,
  newCount,
  onSelect,
}: ChannelTicketCardProps) => (
  <Card
    className={`relative aspect-[2/1] cursor-pointer overflow-hidden border-0 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${channelTileColors[channel]}`}
    role="button"
    tabIndex={0}
    aria-label={`${label}: ${newCount} new messages`}
    title={`${label}: ${newCount} new messages`}
    onClick={onSelect}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect();
      }
    }}
  >
    <CardContent className="flex h-full items-center justify-center p-0">
      <ChannelIcon channel={channel} className={`h-11 w-11 rounded-full bg-white ${channelIconColors[channel]}`} />
      <span className="absolute right-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-[#dc2626] px-2 text-xs font-bold text-white shadow-sm">
        {newCount}
      </span>
    </CardContent>
  </Card>
);

const channelTileColors: Record<ConversationChannel, string> = {
  facebook: "bg-[#4369a7]",
  whatsapp: "bg-[#168b62]",
  instagram: "bg-[#c83f6f]",
  telegram: "bg-[#229ED9]",
  x: "bg-[#242424]",
};

const channelIconColors: Record<ConversationChannel, string> = {
  facebook: "text-[#4267B2]",
  whatsapp: "text-[#128C7E]",
  instagram: "text-[#E1306C]",
  telegram: "text-[#229ED9]",
  x: "text-black",
};

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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summary.map((channel) => (
          <ChannelTicketCard
            key={channel.channel}
            channel={channel.channel}
            label={channel.label}
            newCount={channel.unassigned}
            onSelect={() => navigate(`/messages?view=new&channel=${channel.channel}`)}
          />
        ))}
      </div>
    </section>
  );
};
