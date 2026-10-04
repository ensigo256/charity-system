"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Mail, MailOpen, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Message {
  _id: string;
  name: string;
  email: string;
  subject: string;
  phone?: string;
  message: string;
  isRead: boolean;
  isArchived: boolean;
  reply?: { reply: string; repliedOn: string };
  createdAt: string;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function MessagesPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Message | null>(null);
  const [reply, setReply] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { can } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canManage = can("messages.manage");

  const { data: messages = [], isLoading, isError } = useQuery<Message[]>({
    queryKey: ["messages", "all"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/messages/all");
      return response.json();
    },
    refetchInterval: 10000,
    refetchIntervalInBackground: false,
  });

  const filteredMessages = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return messages;
    return messages.filter((item) =>
      [item.name, item.email, item.subject, item.message]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [messages, search]);

  const refreshMessages = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["messages", "all"] }),
      queryClient.invalidateQueries({ queryKey: ["messages", "unread-count"] }),
    ]);
  };

  const markRead = async (item: Message) => {
    if (item.isRead) return;
    try {
      await apiRequest("POST", `/messages/${item._id}/mark-read`);
      await refreshMessages();
    } catch (error) {
      toast({ variant: "destructive", title: "Unable to mark message as read", description: error instanceof Error ? error.message : "Please try again." });
    }
  };

  const deleteMessage = async (item: Message) => {
    if (!window.confirm(`Delete the message from ${item.name}?`)) return;
    setIsSaving(true);
    try {
      await apiRequest("DELETE", `/messages/${item._id}/delete`);
      if (selected?._id === item._id) setSelected(null);
      await refreshMessages();
      toast({ title: "Message deleted" });
    } catch (error) {
      toast({ variant: "destructive", title: "Unable to delete message", description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setIsSaving(true);
    try {
      await apiRequest("POST", `/messages/${selected._id}/reply`, { reply: reply.trim() });
      setReply("");
      await refreshMessages();
      const updated = messages.find((item) => item._id === selected._id);
      if (updated) setSelected({ ...updated, reply: { reply: reply.trim(), repliedOn: new Date().toISOString() } });
      toast({ title: "Reply saved", description: "The reply email was queued for delivery." });
    } catch (error) {
      toast({ variant: "destructive", title: "Unable to send reply", description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid min-h-full gap-6 p-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
      <section>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-foreground">Messages</h2>
            <p className="mt-1 text-foreground/70">Read and manage contact enquiries.</p>
          </div>
        </div>

        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search messages" className="mb-4" />

        {isError ? (
          <Card className="p-6 text-destructive">Unable to load messages. Check your access and try again.</Card>
        ) : isLoading ? (
          <Card className="p-6 text-foreground/70">Loading messages...</Card>
        ) : filteredMessages.length === 0 ? (
          <Card className="p-6 text-foreground/70">No messages found.</Card>
        ) : (
          <div className="space-y-3">
            {filteredMessages.map((item) => (
              <Card key={item._id} className={`cursor-pointer p-4 transition-colors hover:border-primary ${!item.isRead ? "border-primary/50 bg-primary/5" : ""}`} onClick={() => { setSelected(item); void markRead(item); }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.isRead ? <MailOpen className="h-4 w-4 text-foreground/50" /> : <Mail className="h-4 w-4 text-primary" />}
                      <p className="font-semibold text-foreground">{item.subject}</p>
                      {!item.isRead ? <Badge>Unread</Badge> : null}
                      {item.isArchived ? <Badge variant="outline">Archived</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-foreground/70">{item.name} &lt;{item.email}&gt;</p>
                    <p className="mt-2 line-clamp-2 text-sm text-foreground/80">{item.message}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-foreground/60">
                    <p>{formatDate(item.createdAt)}</p>
                    {canManage ? <Button variant="ghost" size="icon" className="mt-2 text-destructive" onClick={(event) => { event.stopPropagation(); void deleteMessage(item); }} aria-label={`Delete message from ${item.name}`}><Trash2 className="h-4 w-4" /></Button> : null}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Card className="h-fit p-6 lg:sticky lg:top-6">
        {selected ? (
          <>
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-foreground/60">From</p>
                <h3 className="text-xl font-bold text-foreground">{selected.name}</h3>
                <a className="text-sm text-primary hover:underline" href={`mailto:${selected.email}`}>{selected.email}</a>
              </div>
              <Eye className="h-5 w-5 text-foreground/50" />
            </div>
            <p className="mb-2 text-sm text-foreground/60">{formatDate(selected.createdAt)}</p>
            <h4 className="mb-3 text-lg font-semibold text-foreground">{selected.subject}</h4>
            <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/80">{selected.message}</p>
            {selected.phone ? <p className="mt-4 text-sm text-foreground/60">Phone: {selected.phone}</p> : null}

            {canManage ? (
              <div className="mt-6 border-t border-border pt-5">
                <label className="mb-2 block text-sm font-medium text-foreground">Reply by email</label>
                <Textarea value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write a reply" rows={5} />
                <Button className="mt-3 w-full" disabled={isSaving || !reply.trim()} onClick={() => void sendReply()}>Send Reply</Button>
                {selected.reply ? <p className="mt-3 text-xs text-foreground/60">Last reply: {formatDate(selected.reply.repliedOn)}</p> : null}
              </div>
            ) : null}
          </>
        ) : (
          <div className="py-12 text-center text-foreground/60">Select a message to read it.</div>
        )}
      </Card>
    </div>
  );
}
