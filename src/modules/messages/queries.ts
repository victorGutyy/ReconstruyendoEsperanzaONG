import "server-only";

import { createClient } from "@/lib/supabase/server";

import { MESSAGE_TABS, MESSAGES_PAGE_SIZE, type MessageStatus, type MessageTab } from "./schema";

// Contact messages read through RLS: messages.read with MFA (editors and
// administrators). Call after authorizePage('messages.read').

export type MessageSummary = {
  id: string;
  fullName: string;
  preview: string;
  status: MessageStatus;
  createdAt: string;
};

export async function listMessages(
  tab: MessageTab,
  page: number,
): Promise<{ messages: MessageSummary[]; total: number; pageCount: number }> {
  const supabase = await createClient();
  const statuses = MESSAGE_TABS.find((item) => item.key === tab)!.statuses;
  const offset = (page - 1) * MESSAGES_PAGE_SIZE;
  const { data, error, count } = await supabase
    .from("contact_messages")
    .select("id, full_name, message, status, created_at", { count: "exact" })
    .in("status", [...statuses])
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + MESSAGES_PAGE_SIZE - 1);
  if (error && error.code !== "PGRST103") throw error;
  const total = count ?? 0;
  return {
    messages: (error ? [] : data).map((row) => ({
      id: row.id,
      fullName: row.full_name,
      preview: row.message.length > 140 ? `${row.message.slice(0, 140)}…` : row.message,
      status: row.status as MessageStatus,
      createdAt: row.created_at,
    })),
    total,
    pageCount: Math.ceil(total / MESSAGES_PAGE_SIZE),
  };
}

/** New messages nobody opened yet (for the dashboard). */
export async function countUnreadMessages(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("contact_messages")
    .select("id", { count: "exact", head: true })
    .eq("status", "new")
    .is("deleted_at", null);
  if (error) throw error;
  return count ?? 0;
}

export type MessageDetail = MessageSummary & {
  message: string;
  email: string | null;
  phone: string | null;
  policyVersion: string;
  handledAt: string | null;
  handledBy: string | null;
  inTrash: boolean;
};

export async function getMessage(id: string): Promise<MessageDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contact_messages")
    .select(
      "id, full_name, email, phone, message, status, created_at, privacy_policy_version, handled_at, handled_by, deleted_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;

  let handledBy: string | null = null;
  if (data.handled_by) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", data.handled_by)
      .maybeSingle();
    handledBy = profile?.full_name ?? null;
  }
  return {
    id: data.id,
    fullName: data.full_name,
    preview: "",
    message: data.message,
    email: data.email,
    phone: data.phone,
    status: data.status as MessageStatus,
    createdAt: data.created_at,
    policyVersion: data.privacy_policy_version,
    handledAt: data.handled_at,
    handledBy,
    inTrash: data.deleted_at !== null,
  };
}
