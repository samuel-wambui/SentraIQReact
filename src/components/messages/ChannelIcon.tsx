import { Instagram, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConversationChannel } from "@/lib/conversations";

interface ChannelIconProps {
  channel: ConversationChannel;
  className?: string;
}

export const ChannelIcon = ({ channel, className }: ChannelIconProps) => {
  if (channel === "whatsapp") {
    return (
      <span
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white",
          className
        )}
        aria-hidden="true"
      >
        <Phone className="h-5 w-5" />
      </span>
    );
  }

  if (channel === "facebook") {
    return (
      <span
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#1877F2] text-xl font-bold leading-none text-white",
          className
        )}
        aria-hidden="true"
      >
        f
      </span>
    );
  }

  if (channel === "instagram") {
    return (
      <span
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#E1306C] text-white",
          className
        )}
        aria-hidden="true"
      >
        <Instagram className="h-5 w-5" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full bg-black text-lg font-bold leading-none text-white",
        className
      )}
      aria-hidden="true"
    >
      X
    </span>
  );
};
