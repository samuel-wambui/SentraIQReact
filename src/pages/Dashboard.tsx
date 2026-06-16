import { useNavigate } from "react-router-dom";
import { useAuth } from "@/components/auth/AuthProvider";
import { ChannelTicketCard } from "@/components/messages/ChannelUnassignedCards";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, MessageCircle } from "lucide-react";
import { useConversations } from "@/hooks/useConversations";

const Dashboard = () => {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const { summary: conversationSummary, loading, totalUnassigned } = useConversations({ token: accessToken });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Agent Dashboard</h2>
          <p className="text-muted-foreground">Message queues and active service tickets</p>
        </div>
        <div className="rounded-md border px-4 py-3 text-sm">
          <span className="text-muted-foreground">New tickets</span>
          <span className="ml-2 font-semibold text-foreground">{totalUnassigned}</span>
        </div>
      </div>

      {loading ? (
        <Card>
          <CardContent className="flex h-40 items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading dashboard
          </CardContent>
        </Card>
      ) : conversationSummary.length === 0 ? (
        <Card>
          <CardContent className="flex h-40 items-center justify-center gap-3 text-muted-foreground">
            <MessageCircle className="h-5 w-5" />
            No message channels found
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {conversationSummary.map((channel) => (
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
      )}
    </div>
  );
};

export default Dashboard;
