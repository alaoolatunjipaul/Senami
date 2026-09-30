import { CHANNELS, CHANNEL_LABELS, type ChannelId } from "@/lib/config";

/**
 * Channel presentation mapping shared between the sidebar and channel pages.
 */
const DOT_CLASS: Record<ChannelId, string> = {
  instagram: "bg-channel-instagram",
  facebook: "bg-channel-facebook",
  x: "bg-channel-x",
  tiktok: "bg-channel-tiktok",
};

export function isChannelId(value: string): value is ChannelId {
  return (CHANNELS as readonly string[]).includes(value);
}

export function channelLabel(channelId: string): string {
  return isChannelId(channelId) ? CHANNEL_LABELS[channelId] : channelId;
}

export function channelDotClass(channelId: string): string {
  return isChannelId(channelId) ? DOT_CLASS[channelId] : "bg-ink-subtle";
}
