"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Inbox,
  Mail,
  PencilLine,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type MailboxTab = "inbox" | "sent" | "archived";

interface MessageRecord {
  _id: string;
  name: string;
  email: string;
  from?: string;
  to?: string[];
  subject: string;
  message: string;
  text?: string;
  isRead: boolean;
  isArchived: boolean;
  direction?: "inbound" | "outbound" | "internal";
  source?: string;
  threadId?: string;
  reply?: { reply: string; repliedOn: string };
  createdAt: string;
}

interface MessageThread {
  key: string;
  messages: MessageRecord[];
  latest: MessageRecord;
}

interface SponsorRecipient {
  id: string;
  name: string;
  email: string;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function MessagesPage() {
  const [tab, setTab] = useState<MailboxTab>("inbox");
  const [search, setSearch] = useState("");
  const [selectedThreadKey, setSelectedThreadKey] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeSponsorId, setComposeSponsorId] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { can } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = can("messages.manage");

  const { data: messages = [], isLoading, isError } = useQuery<MessageRecord[]>({
    queryKey: ["messages", "all"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/messages/all?limit=100");
      return response.json();
    },
    refetchInterval: 15000,
    refetchIntervalInBackground: false,
  });
  const { data: sponsors = [], isError: sponsorsError } = useQuery<SponsorRecipient[]>({
    queryKey: ["messages", "sponsors"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/messages/sponsors");
      return response.json();
    },
    enabled: canManage && composeOpen,
  });

  const filteredThreads = useMemo(() => {
    const grouped = new Map<string, MessageRecord[]>();
    for (const message of messages) {
      const key = message.threadId || `message:${message._id}`;
      const thread = grouped.get(key) || [];
      thread.push(message);
      grouped.set(key, thread);
    }

    const threads = Array.from(grouped, ([key, threadMessages]) => {
      threadMessages.sort(
        (left, right) =>
          new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      );
      return {
        key,
        messages: threadMessages,
        latest: threadMessages[threadMessages.length - 1],
      };
    });
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = threads.filter(({ latest, messages: threadMessages }) => {
      if (tab === "inbox") {
        return threadMessages.some((item) => item.direction !== "outbound") && !latest.isArchived;
      }
      if (tab === "sent") {
        return !latest.isArchived && threadMessages.some((item) => item.direction === "outbound" || item.source === "dashboard");
      }
      return latest.isArchived;
    });

    if (!normalizedSearch) return filtered;

    return filtered.filter(({ messages: threadMessages }) => {
      const searchable = threadMessages
        .flatMap((item) => [
          item.name,
          item.email,
          item.from,
          item.subject,
          item.message,
          ...(item.to || []),
        ])
        .join(" ")
        .toLowerCase();
      return searchable.includes(normalizedSearch);
    });
  }, [messages, search, tab]);

  const selectedThread =
    filteredThreads.find((thread) => thread.key === selectedThreadKey) || null;

  useEffect(() => {
    if (!filteredThreads.length) {
      setSelectedThreadKey(null);
      return;
    }

    if (!selectedThreadKey || !filteredThreads.some((thread) => thread.key === selectedThreadKey)) {
      setSelectedThreadKey(filteredThreads[0].key);
    }
  }, [filteredThreads, selectedThreadKey]);

  const refreshMessages = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["messages", "all"] }),
      queryClient.invalidateQueries({ queryKey: ["messages", "unread-count"] }),
    ]);
  };

  const markRead = async (thread: MessageThread) => {
    const unread = thread.messages.find((item) => item.direction !== "outbound" && !item.isRead);
    if (!unread) return;
    try {
      await apiRequest("POST", `/messages/${unread._id}/mark-read`);
      await refreshMessages();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to mark this message as read",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const archiveToggle = async (thread: MessageThread) => {
    try {
      await apiRequest("POST", `/messages/${thread.latest._id}/toggle-archive`);
      await refreshMessages();
      toast({ title: thread.latest.isArchived ? "Message restored" : "Message archived" });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to update archive status",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    }
  };

  const deleteMessage = async (thread: MessageThread) => {
    if (!window.confirm(`Delete this conversation with ${thread.latest.name || thread.latest.email}?`)) return;
    setIsSaving(true);
    try {
      await apiRequest("DELETE", `/messages/${thread.latest._id}/delete`);
      if (selectedThreadKey === thread.key) setSelectedThreadKey(null);
      await refreshMessages();
      toast({ title: "Message deleted" });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to delete message",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const sendReply = async () => {
    const targetMessage =
      selectedThread?.messages
        .filter((item) => item.direction !== "outbound")
        .at(-1) || selectedThread?.latest;
    if (!targetMessage || !reply.trim()) return;
    setIsSaving(true);
    try {
      await apiRequest("POST", `/messages/${targetMessage._id}/reply`, { reply: reply.trim() });
      setReply("");
      await refreshMessages();
      toast({ title: "Reply sent", description: "The reply email was accepted for delivery." });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to send reply",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const sendDirectEmail = async () => {
    if (!composeSponsorId || !composeSubject.trim() || !composeBody.trim()) {
      toast({
        variant: "destructive",
        title: "Complete the sender details",
        description: "Choose a sponsor and add a subject and message before sending.",
      });
      return;
    }

    setIsSaving(true);
    try {
      await apiRequest("POST", "/messages/send", {
        sponsorId: composeSponsorId,
        subject: composeSubject.trim(),
        message: composeBody.trim(),
      });
      setComposeOpen(false);
      setComposeSponsorId("");
      setComposeSubject("");
      setComposeBody("");
      await refreshMessages();
      toast({ title: "Email sent", description: "The email was accepted for delivery." });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to send email",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-full space-y-6 p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-foreground/60">
            Communication hub
          </p>
          <h2 className="text-3xl font-bold text-foreground">Messages</h2>
        </div>
        {canManage ? (
          <Button onClick={() => setComposeOpen(true)} className="gap-2">
            <PencilLine className="h-4 w-4" />
            Compose
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <section className="space-y-4">
          <div className="flex gap-2 rounded-xl border border-border bg-card p-1">
            {[
              { key: "inbox", label: "Inbox", icon: Inbox },
              { key: "sent", label: "Sent", icon: Send },
              { key: "archived", label: "Archived", icon: Archive },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key as MailboxTab)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  tab === key ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-muted"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/50" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search messages"
              className="pl-9"
            />
          </div>

          {isError ? (
            <Card className="p-6 text-destructive">Unable to load messages.</Card>
          ) : isLoading ? (
            <Card className="p-6 text-foreground/70">Loading mailbox...</Card>
          ) : filteredThreads.length === 0 ? (
            <Card className="p-6 text-foreground/70">No messages in this folder.</Card>
          ) : (
            <div className="space-y-3">
              {filteredThreads.map((thread) => (
                <Card
                  key={thread.key}
                  className={`cursor-pointer p-4 transition ${
                    selectedThreadKey === thread.key ? "border-primary bg-primary/5" : "hover:border-primary/40"
                  }`}
                  onClick={() => {
                    setSelectedThreadKey(thread.key);
                    void markRead(thread);
                  }}
                >
                  {(() => {
                    const item = thread.latest;
                    return (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-foreground/60" />
                        <p className="truncate font-semibold text-foreground">{item.subject || "No subject"}</p>
                      </div>
                      <p className="mt-1 text-sm text-foreground/70">
                        {item.direction === "outbound" ? item.to?.[0] || item.email : item.name || item.email || item.from}
                      </p>
                      <p className="mt-2 line-clamp-2 text-sm text-foreground/80">{item.message}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2 text-xs text-foreground/60">
                      <span>{formatDate(item.createdAt)}</span>
                      {!item.isRead ? <Badge>Unread</Badge> : null}
                    </div>
                  </div>
                    );
                  })()}
                </Card>
              ))}
            </div>
          )}
        </section>

        <Card className="p-6">
          {selectedThread ? (
            <div className="space-y-6">
              {(() => {
                const selected = selectedThread.latest;
                return (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-foreground/50">
                    {selected.direction === "outbound" ? "To" : "From"}
                  </p>
                  <h3 className="text-2xl font-bold text-foreground">{selected.name || selected.email || selected.from}</h3>
                  <p className="text-sm text-foreground/70">{selected.email || selected.from || selected.to?.join(", ")}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => void archiveToggle(selectedThread)}>
                    {selected.isArchived ? "Restore" : "Archive"}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => void deleteMessage(selectedThread)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
                );
              })()}

              <div className="space-y-4">
                {selectedThread.messages.map((item) => (
                  <article key={item._id} className="rounded-xl border border-border bg-card p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">
                        {item.direction === "outbound" ? "Sent" : `From ${item.name || item.email}`}
                      </p>
                      <p className="text-xs text-foreground/60">{formatDate(item.createdAt)}</p>
                    </div>
                    <h4 className="mb-2 font-semibold text-foreground">{item.subject || "No subject"}</h4>
                    {item.source ? <Badge variant="outline">{item.source}</Badge> : null}
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground/80">
                      {item.message || item.text || "No content available."}
                    </p>
                  </article>
                ))}
              </div>

              {selectedThread.latest.direction !== "outbound" ? <div className="space-y-3 border-t border-border pt-5">
                <label className="text-sm font-medium text-foreground">Reply by email</label>
                <Textarea
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  rows={5}
                  placeholder="Write a reply to this message..."
                />
                <Button className="w-full" disabled={isSaving || !reply.trim()} onClick={() => void sendReply()}>
                  Send reply
                </Button>
              </div> : null}
            </div>
          ) : (
            <div className="flex h-full min-h-[320px] items-center justify-center text-foreground/60">
              Select a message to view details.
            </div>
          )}
        </Card>
      </div>

      {composeOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-2xl p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="text-2xl font-bold text-foreground">New message</h3>
              <Button variant="ghost" onClick={() => setComposeOpen(false)}>
                Close
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="message-sponsor" className="mb-2 block text-sm font-medium text-foreground">Sponsor</label>
                <select
                  id="message-sponsor"
                  value={composeSponsorId}
                  onChange={(event) => setComposeSponsorId(event.target.value)}
                  disabled={sponsorsError}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  required
                >
                  <option value="">{sponsorsError ? "Unable to load sponsors" : "Choose a sponsor"}</option>
                  {sponsors.map((sponsor) => (
                    <option key={sponsor.id} value={sponsor.id}>
                      {sponsor.name} ({sponsor.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Subject</label>
                <Input
                  value={composeSubject}
                  onChange={(event) => setComposeSubject(event.target.value)}
                  placeholder="Follow up on your sponsorship"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Message</label>
                <Textarea
                  value={composeBody}
                  onChange={(event) => setComposeBody(event.target.value)}
                  rows={8}
                  placeholder="Write your email here..."
                />
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setComposeOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => void sendDirectEmail()} disabled={isSaving || sponsorsError}>
                  Send email
                </Button>
              </div>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
