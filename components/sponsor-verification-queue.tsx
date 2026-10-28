"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/query-client";

type SponsorIdentityCandidate = {
  _id: string;
  isArchived?: boolean;
  profile?: { fullName?: string; email?: string; phone?: string };
};

type SponsorVerificationRequest = {
  _id: string;
  status: "pending" | "identity_review" | "duplicate" | "expired";
  profile: { fullName: string; email: string; phone: string };
  child?: { firstName?: string; secondName?: string; givenName?: string } | string;
  paymentMethod: "ach" | "stripe";
  donation: { amount: number; period: string };
  expiresAt: string;
  identityReviewReason?: string;
  emailDeliveryStatus?: "pending" | "sent" | "failed";
  adminFollowUp?: string;
  identityCandidates?: SponsorIdentityCandidate[];
  followUpHistory?: { note: string; createdAt: string }[];
};

export function SponsorVerificationQueue({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [busyRequestId, setBusyRequestId] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selectedSponsors, setSelectedSponsors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const { data: requests = [], isLoading, error } = useQuery<SponsorVerificationRequest[]>({
    queryKey: ["sponsors", "verification-requests", page],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/sponsors/public/verification-requests/pending?page=${page}&limit=50`,
      );
      return response.json();
    },
  });

  const refresh = async () =>
    queryClient.invalidateQueries({ queryKey: ["sponsors", "verification-requests"] });

  const resend = async (requestId: string) => {
    setBusyRequestId(requestId);
    setMessage("");
    try {
      const response = await apiRequest(
        "POST",
        `/sponsors/public/verification-requests/${requestId}/resend`,
      );
      const result = await response.json();
      setMessage(result.message || "Verification email resent.");
      await refresh();
    } catch (actionError) {
      setMessage(actionError instanceof Error ? actionError.message : "Unable to resend verification email.");
    } finally {
      setBusyRequestId("");
    }
  };

  const saveFollowUp = async (requestId: string, existingNote: string) => {
    const note = (notes[requestId] ?? existingNote).trim();
    if (!note) {
      setMessage("Enter a follow-up note before saving.");
      return;
    }
    setBusyRequestId(requestId);
    setMessage("");
    try {
      const response = await apiRequest(
        "PATCH",
        `/sponsors/public/verification-requests/${requestId}/follow-up`,
        { note },
      );
      const result = await response.json();
      setMessage(result.message || "Follow-up note saved.");
      await refresh();
    } catch (actionError) {
      setMessage(actionError instanceof Error ? actionError.message : "Unable to save follow-up.");
    } finally {
      setBusyRequestId("");
    }
  };

  const resolveIdentity = async (
    requestId: string,
    action: "link_existing" | "reject",
  ) => {
    setBusyRequestId(requestId);
    setMessage("");
    try {
      const response = await apiRequest(
        "POST",
        `/sponsors/public/verification-requests/${requestId}/resolve-identity`,
        { action, sponsorId: selectedSponsors[requestId] },
      );
      const result = await response.json();
      setMessage(result.message || "Identity review updated.");
      await refresh();
    } catch (actionError) {
      setMessage(actionError instanceof Error ? actionError.message : "Unable to resolve identity review.");
    } finally {
      setBusyRequestId("");
    }
  };

  return (
    <section className="mb-8 space-y-4 rounded-xl border border-border bg-card p-5 sm:p-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Sponsor email verification</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Contact details remain unconfirmed until the sponsor verifies their email. No relationship or payment starts before verification.
        </p>
      </div>
      {message ? <p role="status" className="rounded-md bg-muted p-3 text-sm">{message}</p> : null}
      {error ? (
        <p role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">
          Unable to load verification requests.
        </p>
      ) : null}
      {isLoading ? <p className="text-sm text-muted-foreground">Loading verification requests...</p> : null}
      {!isLoading && !error && requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">There are no pending or reviewed verification requests.</p>
      ) : null}
      <div className="space-y-3">
        {requests.map((request) => {
          const child = typeof request.child === "object" ? request.child : null;
          const childName = child
            ? [child.givenName || child.firstName, child.secondName].filter(Boolean).join(" ")
            : "Child";
          const candidate = request.identityCandidates || [];
          const isBusy = busyRequestId === request._id;

          return (
            <article key={request._id} className="space-y-3 rounded-lg border border-border p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">{request.profile.fullName} / {childName}</p>
                  <p className="text-sm text-foreground/80">
                    {request.profile.email} · {request.profile.phone}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {request.donation.amount} USD / {request.donation.period} · {request.paymentMethod.toUpperCase()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {request.status === "pending"
                      ? `Verification expires ${new Date(request.expiresAt).toLocaleString()}`
                      : request.identityReviewReason || `Status: ${request.status.replace("_", " ")}`}
                  </p>
                  {request.emailDeliveryStatus ? (
                    <p className="text-xs text-muted-foreground">
                      Verification email: {request.emailDeliveryStatus}
                    </p>
                  ) : null}
                </div>
                {canManage && ["pending", "expired"].includes(request.status) ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => resend(request._id)}
                  >
                    {isBusy ? "Working..." : "Resend verification"}
                  </Button>
                ) : null}
              </div>

              {request.status === "identity_review" && canManage ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                    aria-label={`Select verified sponsor identity for ${request.profile.fullName}`}
                    value={selectedSponsors[request._id] || ""}
                    onChange={(event) =>
                      setSelectedSponsors((current) => ({
                        ...current,
                        [request._id]: event.target.value,
                      }))
                    }
                  >
                    <option value="">Select matching sponsor record</option>
                    {candidate.map((item) => (
                      <option key={item._id} value={item._id} disabled={item.isArchived}>
                        {item.profile?.fullName || "Unnamed sponsor"} · {item.profile?.email} · {item.profile?.phone}
                        {item.isArchived ? " (archived)" : ""}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isBusy || !selectedSponsors[request._id]}
                    onClick={() => resolveIdentity(request._id, "link_existing")}
                  >
                    Link reviewed identity
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => resolveIdentity(request._id, "reject")}
                  >
                    Close request
                  </Button>
                </div>
              ) : null}

              {canManage ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={notes[request._id] ?? request.adminFollowUp ?? ""}
                    onChange={(event) =>
                      setNotes((current) => ({
                        ...current,
                        [request._id]: event.target.value,
                      }))
                    }
                    maxLength={1000}
                    aria-label={`Follow-up note for ${request.profile.fullName}`}
                    placeholder="Record contact attempt or follow-up note"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => saveFollowUp(request._id, request.adminFollowUp || "")}
                  >
                    Save follow-up
                  </Button>
                </div>
              ) : request.adminFollowUp ? (
                <p className="text-sm text-muted-foreground">Follow-up: {request.adminFollowUp}</p>
              ) : null}
              {request.followUpHistory?.length ? (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {request.followUpHistory.map((entry, index) => (
                    <li key={`${request._id}-follow-up-${index}`}>
                      {new Date(entry.createdAt).toLocaleString()}: {entry.note}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          );
        })}
      </div>
      <div className="flex items-center justify-between border-t border-border pt-3">
        <p className="text-xs text-muted-foreground">Page {page}</p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={requests.length < 50}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
