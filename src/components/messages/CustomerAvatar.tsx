import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { UserRound, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface CustomerAvatarProps {
  profilePictureUrl?: string | null;
  label?: string | null;
  className?: string;
  fallbackClassName?: string;
}

export const CustomerAvatar = ({
  profilePictureUrl,
  label,
  className,
  fallbackClassName,
}: CustomerAvatarProps) => {
  const [imageFailed, setImageFailed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPosition, setPreviewPosition] = useState({ top: 0, left: 0, width: 224 });
  const avatarRef = useRef<HTMLSpanElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fallbackInitial = useMemo(() => String(label ?? "").trim().slice(0, 1).toUpperCase(), [label]);
  const imageUrl = useMemo(() => {
    const candidate = String(profilePictureUrl ?? "").trim();
    if (!candidate) return null;
    try {
      const parsed = new URL(candidate);
      return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
    } catch {
      return null;
    }
  }, [profilePictureUrl]);

  useEffect(() => {
    setImageFailed(false);
    if (!imageUrl) setPreviewOpen(false);
  }, [imageUrl]);

  useEffect(() => {
    if (!previewOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (!target || avatarRef.current?.contains(target) || previewRef.current?.contains(target)) return;
      setPreviewOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewOpen(false);
    };
    const closeOnLayoutChange = () => setPreviewOpen(false);

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeOnLayoutChange);
    window.addEventListener("scroll", closeOnLayoutChange, true);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeOnLayoutChange);
      window.removeEventListener("scroll", closeOnLayoutChange, true);
    };
  }, [previewOpen]);

  const canPreview = Boolean(imageUrl && !imageFailed);
  const closePreview = () => setPreviewOpen(false);
  const handleImageError = () => {
    setImageFailed(true);
    closePreview();
  };
  const togglePreview = () => {
    if (previewOpen) {
      closePreview();
      return;
    }

    const bounds = avatarRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const margin = 12;
    const gap = 10;
    const width = Math.min(224, window.innerWidth - margin * 2);
    const estimatedHeight = width + (label ? 52 : 16);
    const roomOnRight = bounds.right + gap + width <= window.innerWidth - margin;
    const left = roomOnRight
      ? bounds.right + gap
      : Math.max(margin, bounds.left - gap - width);
    const top = Math.min(
      Math.max(margin, bounds.top),
      Math.max(margin, window.innerHeight - estimatedHeight - margin)
    );

    setPreviewPosition({ top, left, width });
    setPreviewOpen(true);
  };

  return (
    <>
      <Avatar
        ref={avatarRef}
        className={cn(
          "h-10 w-10 shrink-0",
          canPreview && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2",
          className
        )}
        role={canPreview ? "button" : undefined}
        tabIndex={canPreview ? 0 : undefined}
        aria-expanded={canPreview ? previewOpen : undefined}
        aria-label={canPreview ? `Enlarge ${label || "customer"} profile picture` : undefined}
        onClick={(event) => {
          if (!canPreview) return;
          event.preventDefault();
          event.stopPropagation();
          togglePreview();
        }}
        onKeyDown={(event) => {
          if (!canPreview || (event.key !== "Enter" && event.key !== " ")) return;
          event.preventDefault();
          event.stopPropagation();
          togglePreview();
        }}
      >
        {imageUrl && !imageFailed && (
          <AvatarImage
            src={imageUrl}
            alt={label ? `${label} profile picture` : "Customer profile picture"}
            referrerPolicy="no-referrer"
            onError={handleImageError}
          />
        )}
        <AvatarFallback
          className={cn("bg-muted text-sm font-semibold text-muted-foreground", fallbackClassName)}
        >
          {fallbackInitial || <UserRound className="h-5 w-5" />}
        </AvatarFallback>
      </Avatar>

      {previewOpen && canPreview && imageUrl && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={previewRef}
              role="dialog"
              aria-label={label ? `${label} profile picture preview` : "Customer profile picture preview"}
              className="fixed z-[100] overflow-hidden rounded-lg border border-[#344258] bg-[#111b2b] p-2 shadow-2xl"
              style={previewPosition}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Close profile picture preview"
                className="absolute right-3 top-3 z-10 rounded-full bg-black/65 p-1.5 text-white transition hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  closePreview();
                }}
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex flex-col items-center gap-2">
                <img
                  src={imageUrl}
                  alt={label ? `${label} enlarged profile picture` : "Enlarged customer profile picture"}
                  referrerPolicy="no-referrer"
                  className="aspect-square w-full rounded-md bg-black/30 object-contain"
                  onError={handleImageError}
                />
                {label && <p className="w-full truncate px-1 text-center text-xs font-medium text-white">{label}</p>}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
};
