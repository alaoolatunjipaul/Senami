import { randomUUID } from "node:crypto";

import {
  attachmentKindOf,
  type MessageAttachment,
  type MessageAuthor,
} from "@/lib/domain/conversation";
import type { UserProfile } from "@/lib/domain/user";

/**
 * HTTP helpers shared by the conversation routes.
 *
 * The API never trusts a client-supplied author or attachment kind: the author
 * is built from the authenticated session and the attachment kind is derived
 * from the MIME type here, server-side.
 */

export interface AttachmentInput {
  readonly name: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly url?: string;
}

export function messageAuthorFromUser(user: UserProfile): MessageAuthor {
  return { id: user.id, name: user.name, type: "agent", role: user.role };
}

export function toAttachments(inputs: readonly AttachmentInput[]): MessageAttachment[] {
  return inputs.map((input) => ({
    id: `att_${randomUUID()}`,
    name: input.name,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    url: input.url && input.url.length > 0 ? input.url : `/demo/attachments/${encodeURIComponent(input.name)}`,
    kind: attachmentKindOf(input.mimeType),
  }));
}
