import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type ContactLike = {
  display_name?: string | null;
  phone_e164?: string | null;
  profile_pic_url?: string | null;
  profile_pic_preview_url?: string | null;
};

type Props = {
  contact: ContactLike | null | undefined;
  size?: number;
  className?: string;
};

export function ContactAvatar({ contact, size = 40, className }: Props) {
  const name = contact?.display_name ?? contact?.phone_e164 ?? "?";
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const src = contact?.profile_pic_preview_url || contact?.profile_pic_url || undefined;

  return (
    <Avatar
      className={cn("shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {src && (
        <AvatarImage
          src={src}
          alt={name}
          // shadcn AvatarImage clears itself on error and falls back automatically
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      <AvatarFallback
        className="font-medium"
        style={{ fontSize: Math.max(10, Math.round(size * 0.4)) }}
      >
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}
