import React from "react";
import { cn } from "@/lib/utils";

interface MailAvatarProps {
  initials: string;
  tone: string;
  size?: "sm" | "md";
}

/** Initials in a tinted circle; the tone is derived from the address so it stays stable. */
export const MailAvatar = ({ initials, tone, size = "sm" }: MailAvatarProps) => (
  <span
    aria-hidden
    className={cn(
      "flex shrink-0 select-none items-center justify-center rounded-full font-semibold",
      size === "sm" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm",
      tone,
    )}
  >
    {initials}
  </span>
);
