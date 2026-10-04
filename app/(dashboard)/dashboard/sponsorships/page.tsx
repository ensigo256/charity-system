"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  Users,
  DollarSign,
  ArrowUpRight,
  Loader,
  Plus,
  Archive,
  Upload,
  X,
} from "lucide-react";
import type { PaymentRecord, SponsorshipRecord } from "@/lib/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import { uploadImageToCloudinary } from "@/lib/cloudinary-upload";
import { ListPagination } from "@/components/dashboard/list-pagination";

const PAGE_SIZE = 25;

type SponsorshipStatus = SponsorshipRecord["status"];
type PaymentStatus = PaymentRecord["status"];

type SponsorProfile = {
  _id: string;
  profile?: {
    fullName?: string;
    email?: string;
    phone?: string;
    country?: string;
    city?: string;
    state?: string;
    region?: string;
    zipCode?: string;
    bio?: string;
  };
  location?: {
    address?: string;
    country?: string;
    city?: string;
    state?: string;
    region?: string;
    zipCode?: string;
  };
  donation?: {
    amount?: number;
    period?: string;
    expectedFundsDate?: string | Date | null;
    remindByEmail?: boolean;
  };
  paymentMethod?: string;
  profileStatus?: "Complete" | "Incomplete" | string;
  isArchived?: boolean;
  image?: { url?: string; public_id?: string };
};

type PaymentForm = {
  amount: string;
  method: string;
  txnId: string;
  note: string;
};

type SponsorForm = {
  name: string;
  email: string;
  phone: string;
  country: string;
  address: string;
  city: string;
  state: string;
  region: string;
  zipCode: string;
  bio: string;
  amount: string;
  period: string;
  expectedFundsDate: string;
  remindByEmail: boolean;
  paymentMethod: string;
  childId: string;
  startDate: string;
  image: { url: string; public_id: string };
};

const initialPayment: PaymentForm = {
  amount: "",
  method: "Select method",
  txnId: "",
  note: "",
};

const initialSponsorForm: SponsorForm = {
  name: "",
  email: "",
  phone: "",
  country: "",
  address: "",
  city: "",
  state: "",
  region: "",
  zipCode: "",
  bio: "",
  amount: "50",
  period: "Monthly",
  expectedFundsDate: "",
  remindByEmail: true,
  paymentMethod: "ach",
  childId: "",
  startDate: new Date().toISOString().slice(0, 10),
  image: { url: "", public_id: "" },
};

const emptySponsorshipRecords: SponsorshipRecord[] = [];

function getStatusClasses(status: SponsorshipStatus | string) {
  switch (status) {
    case "Active":
      return "bg-emerald-100 text-emerald-800";
    case "Pending":
      return "bg-amber-100 text-amber-800";
    case "Paused":
      return "bg-slate-100 text-slate-800";
    case "Completed":
      return "bg-sky-100 text-sky-800";
    case "Complete":
      return "bg-emerald-100 text-emerald-800";
    case "Incomplete":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
}

export default function SponsorshipsDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const { data: sponsorships, isLoading } = useQuery<SponsorProfile[]>({
    queryKey: ["sponsors", "profiles", "all", page],
    queryFn: async () => {
      const response = await apiRequest("GET", `/sponsors/profiles/all?page=${page}&limit=${PAGE_SIZE}`);
      return response.json();
    },
  });
  const { data: childrenData = [] } = useQuery<any[]>({
    queryKey: ["children", "profiles", page],
    queryFn: async () => {
      const response = await apiRequest("GET", `/children/profiles?page=${page}&limit=${PAGE_SIZE}`);
      return response.json();
    },
  });
  const { data: sponsorshipRecords = emptySponsorshipRecords } = useQuery<SponsorshipRecord[]>({
    queryKey: ["sponsors", "sponsorship", "records", page],
    queryFn: async () => {
      const response = await apiRequest("GET", `/sponsors/sponsorship/records?page=${page}&limit=${PAGE_SIZE}`);
      return response.json();
    },
  });

  const [records, setRecords] = useState<SponsorshipRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "Complete" | "Incomplete"
  >("all");
  const [selectedRecord, setSelectedRecord] =
    useState<SponsorshipRecord | null>(null);
  const [selectedSponsorProfile, setSelectedSponsorProfile] =
    useState<any>(null);
  const [selectedSponsorChildren, setSelectedSponsorChildren] = useState<any[]>(
    [],
  );
  const [selectedSponsorSummary, setSelectedSponsorSummary] =
    useState<any>(null);
  const [loadingSponsorChildren, setLoadingSponsorChildren] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sponsorSubmitting, setSponsorSubmitting] = useState(false);
  const [isUploadingSponsorImage, setIsUploadingSponsorImage] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<SponsorProfile | null>(
    null,
  );
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [sponsorFormError, setSponsorFormError] = useState("");
  const [paymentForm, setPaymentForm] = useState(initialPayment);
  const [activePledgeId, setActivePledgeId] = useState("");
  const [pledgeReceipt, setPledgeReceipt] = useState({
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    bankReference: "",
    notes: "",
  });
  const [pledgeError, setPledgeError] = useState("");
  const [pledgeSubmitting, setPledgeSubmitting] = useState(false);
  const [sponsorForm, setSponsorForm] =
    useState<SponsorForm>(initialSponsorForm);

  const sponsorProfiles = useMemo(
    () => (Array.isArray(sponsorships) ? sponsorships : []),
    [sponsorships],
  );
  const pendingPublicPledges = useMemo(
    () =>
      records.filter(
        (record) => record.publicPledgeReference && record.status === "Pending",
      ),
    [records],
  );

  useEffect(() => {
    setRecords(Array.isArray(sponsorshipRecords) ? sponsorshipRecords : []);
  }, [sponsorshipRecords]);

  const filteredRecords = useMemo(() => {
    return sponsorProfiles.filter((profile) => {
      const matchesSearch = [
        profile.profile?.fullName,
        profile.profile?.email,
        profile.profile?.phone,
        profile.location?.city,
        profile.location?.country,
      ]
        .join(" ")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || profile.profileStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [sponsorProfiles, searchQuery, statusFilter]);

  const totalActive = sponsorProfiles.filter(
    (profile) => profile.profileStatus === "Complete",
  ).length;

  const totalMonthly = sponsorProfiles.reduce(
    (sum, profile) => sum + Number(profile.donation?.amount || 0),
    0,
  );
  const totalPaid = 0;

  const openDetail = (profile: SponsorProfile) => {
    if (!profile._id) return;
    router.push(`/dashboard/sponsorships/${profile._id}`);
  };

  const resetSponsorForm = () => {
    setSponsorForm(initialSponsorForm);
    setSponsorFormError("");
  };

  const openProfileEditor = () => {
    const profile =
      selectedSponsorProfile?.profile || selectedSponsorProfile?.sponsor || {};
    const location = selectedSponsorProfile?.location || {};

    setSponsorForm((current) => ({
      ...current,
      name: profile.fullName || profile.name || current.name,
      email: profile.email || current.email,
      phone: profile.phone || current.phone,
      country: profile.country || location.country || current.country,
      city: profile.city || location.city || current.city,
      state: profile.state || location.state || current.state,
      region: profile.region || location.region || current.region,
      zipCode: profile.zipCode || location.zipCode || current.zipCode,
      bio: profile.bio || current.bio,
      amount: String(selectedSponsorProfile?.donation?.amount || current.amount || ""),
      period: selectedSponsorProfile?.donation?.period || current.period,
      expectedFundsDate:
        String(selectedSponsorProfile?.donation?.expectedFundsDate || current.expectedFundsDate || "").slice(0, 10),
      remindByEmail: Boolean(selectedSponsorProfile?.donation?.remindByEmail ?? current.remindByEmail),
      paymentMethod: selectedSponsorProfile?.paymentMethod || current.paymentMethod,
      image: selectedSponsorProfile?.image || current.image,
    }));
    setIsEditProfileOpen(true);
  };

  const handleUpdateProfile = async () => {
    const sponsorId = selectedSponsorProfile?._id || selectedRecord?.donor?._id;
    if (!sponsorId) return;

    try {
      const response = await apiRequest(
        "PATCH",
        `/sponsors/profile/${sponsorId}`,
        {
          profile: {
            fullName: sponsorForm.name.trim(),
            email: sponsorForm.email.trim(),
            phone: sponsorForm.phone.trim(),
            country: sponsorForm.country.trim(),
            city: sponsorForm.city.trim(),
            state: sponsorForm.state.trim(),
            region: sponsorForm.region.trim(),
            zipCode: sponsorForm.zipCode.trim(),
            bio: sponsorForm.bio.trim(),
          },
          donation: {
            amount: Number(sponsorForm.amount || 0),
            period: sponsorForm.period,
            expectedFundsDate: sponsorForm.expectedFundsDate || undefined,
            remindByEmail: sponsorForm.remindByEmail,
          },
          image: sponsorForm.image.url ? sponsorForm.image : undefined,
        },
      );

      if (!response.ok) throw new Error("Failed to update sponsor profile");

      const result = await response.json();
      setSelectedSponsorProfile(result.sponsor);
      setIsEditProfileOpen(false);
      await queryClient.invalidateQueries({
        queryKey: ["sponsors", "profiles", "all"],
      });
    } catch (error) {
      console.error("Error updating sponsor profile:", error);
      setSponsorFormError(
        "Failed to update sponsor profile. Please try again.",
      );
    }
  };

  const handleCreateSponsor = async () => {
    if (
      !sponsorForm.name.trim() ||
      !sponsorForm.email.trim() ||
      !sponsorForm.phone.trim() ||
      !sponsorForm.amount.trim()
    ) {
      setSponsorFormError(
        "Please provide the sponsor name, email, phone number, and donation amount.",
      );
      return;
    }

    const amount = Number(sponsorForm.amount);
    if (!/^\S+@\S+\.\S+$/.test(sponsorForm.email.trim())) {
      setSponsorFormError("Please enter a valid email address.");
      return;
    }
    if (isNaN(amount) || amount < 5 || amount > 100000) {
      setSponsorFormError("Enter an amount from $5 to $100,000.");
      return;
    }

    setSponsorSubmitting(true);
    setSponsorFormError("");

    try {
      const payload = {
        sponsor: {
          name: sponsorForm.name.trim(),
          email: sponsorForm.email.trim(),
          phone: sponsorForm.phone.trim(),
        },
        profile: {
          fullName: sponsorForm.name.trim(),
          email: sponsorForm.email.trim(),
          phone: sponsorForm.phone.trim(),
          country: sponsorForm.country.trim(),
          city: sponsorForm.city.trim(),
          state: sponsorForm.state.trim(),
          region: sponsorForm.region.trim(),
          zipCode: sponsorForm.zipCode.trim(),
          bio: sponsorForm.bio.trim(),
        },
        image: sponsorForm.image.url ? sponsorForm.image : undefined,
        childId: sponsorForm.childId || undefined,
        child: sponsorForm.childId || undefined,
        location: {
          address: sponsorForm.address.trim(),
          country: sponsorForm.country.trim(),
          city: sponsorForm.city.trim(),
          state: sponsorForm.state.trim(),
          region: sponsorForm.region.trim(),
          zipCode: sponsorForm.zipCode.trim(),
        },
        donation: {
          amount,
          period: sponsorForm.period,
          expectedFundsDate: sponsorForm.expectedFundsDate || undefined,
          remindByEmail: sponsorForm.remindByEmail,
        },
        paymentMethod: sponsorForm.paymentMethod,
        startDate: sponsorForm.startDate,
        expectedFundsDate: sponsorForm.expectedFundsDate || undefined,
        status: "Active",
        source: "dashboard",
      };

      const res = await apiRequest("POST", "/sponsors/profile/new", payload);
      if (!res.ok) {
        throw new Error("Failed to create sponsor profile");
      }

      await queryClient.invalidateQueries({
        queryKey: ["sponsors", "profiles", "all"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["children", "profiles"],
      });

      setIsCreateDialogOpen(false);
      resetSponsorForm();
    } catch (error) {
      console.error("Error creating sponsor profile:", error);
      setSponsorFormError(
        "Failed to create sponsor profile. Please try again.",
      );
    } finally {
      setSponsorSubmitting(false);
    }
  };

  const handleSponsorImageUpload = async (file?: File) => {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setSponsorFormError("Choose a JPEG, PNG, or WebP image up to 5 MB.");
      return;
    }

    setIsUploadingSponsorImage(true);
    setSponsorFormError("");
    try {
      const uploaded = await uploadImageToCloudinary(file);
      setSponsorForm((current) => ({
        ...current,
        image: {
          url: String(uploaded.secure_url || ""),
          public_id: String(uploaded.public_id || ""),
        },
      }));
    } catch (error) {
      console.error("Sponsor image upload failed:", error);
      setSponsorFormError("Unable to upload that image. Please try again.");
    } finally {
      setIsUploadingSponsorImage(false);
    }
  };

  const removeSponsorImage = () => {
    setSponsorForm((current) => ({
      ...current,
      image: { url: "", public_id: "" },
    }));
  };

  const handleArchiveSponsor = async () => {
    if (!archiveTarget?._id) return;

    setIsArchiving(true);
    setArchiveError("");
    try {
      await apiRequest("DELETE", `/sponsors/profile/${archiveTarget._id}`);
      await queryClient.invalidateQueries({
        queryKey: ["sponsors", "profiles", "all"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["children", "profiles"],
      });
      setArchiveTarget(null);
    } catch (error) {
      console.error("Error archiving sponsor profile:", error);
      setArchiveError(
        "Unable to archive this sponsor profile. Please try again.",
      );
    } finally {
      setIsArchiving(false);
    }
  };

  const handleUpdateStatus = async (status: SponsorshipStatus) => {
    if (!selectedRecord) return;

    try {
      const res = await apiRequest(
        "PATCH",
        `/sponsors/sponsorship/${selectedRecord._id}/status`,
        { status },
      );

      if (!res.ok) {
        throw new Error("Failed to update sponsorship status");
      }

      const updated: SponsorshipRecord = { ...selectedRecord, status };
      setSelectedRecord(updated);
      setRecords((current) =>
        current.map((record) =>
          record._id === updated._id ? updated : record,
        ),
      );
      await queryClient.invalidateQueries({
        queryKey: ["sponsors", "profiles", "all"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["children", "profiles"],
      });
    } catch (error) {
      console.error("Error updating sponsorship status:", error);
    }
  };

  const handleAddPayment = async () => {
    if (
      !selectedRecord ||
      !paymentForm.amount.trim() ||
      !paymentForm.txnId.trim()
    ) {
      return;
    }

    setLoading(true);
    try {
      const amountValue = Number(paymentForm.amount);
      if (isNaN(amountValue) || amountValue <= 0) {
        return;
      }

      const payLoad: any = {
        date: new Date().toISOString().slice(0, 10),
        amount: amountValue,
        method: paymentForm.method,
        status: "Completed" as PaymentStatus,
        transactionId: paymentForm.txnId.trim(),
        notes: paymentForm.note.trim(),
      };
      // const payLoad: any = {
      //   id: selectedRecord._id,
      //   date: new Date().toISOString().slice(0, 10),
      //   amount: amountValue,
      //   method: paymentForm.method,
      //   status: "Completed" as PaymentStatus,
      //   transactionId: `REC-${Date.now()}`,
      //   note: paymentForm.note.trim(),
      // };

      const res = await apiRequest(
        "POST",
        `/sponsors/sponsorship/${selectedRecord._id}/new/payment`,
        payLoad,
      );

      if (!res.ok) {
        throw new Error("Failed to add payment");
      }

      const newPayment: PaymentRecord = {
        date: payLoad.date,
        amount: payLoad.amount,
        method: payLoad.method,
        status: payLoad.status,
        transactionId: payLoad.transactionId,
        note: payLoad.notes,
      };

      const updatedRecord: SponsorshipRecord = {
        ...selectedRecord,
        lastPayment: newPayment.date,
        payments: [newPayment, ...selectedRecord.payments],
        status:
          selectedRecord.status === "Pending"
            ? "Active"
            : selectedRecord.status,
      };

      setSelectedRecord(updatedRecord);
      setRecords((current) =>
        current.map((record) =>
          record._id === updatedRecord._id ? updatedRecord : record,
        ),
      );
      await queryClient.invalidateQueries({
        queryKey: ["sponsors", "profiles", "all"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["children", "profiles"],
      });
      setPaymentForm(initialPayment);
    } catch (error) {
      console.error("Error adding payment:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPublicPledge = async () => {
    if (!activePledgeId || !pledgeReceipt.bankReference.trim()) {
      setPledgeError("Enter the bank transaction reference before confirming.");
      return;
    }

    const amount = Number(pledgeReceipt.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPledgeError("Enter a valid received amount.");
      return;
    }

    setPledgeSubmitting(true);
    setPledgeError("");
    try {
      await apiRequest(
        "POST",
        `/sponsors/public/pledges/${activePledgeId}/confirm-ach`,
        {
          amount,
          date: pledgeReceipt.date,
          bankReference: pledgeReceipt.bankReference.trim(),
          notes: pledgeReceipt.notes.trim(),
        },
      );
      setActivePledgeId("");
      setPledgeReceipt({
        amount: "",
        date: new Date().toISOString().slice(0, 10),
        bankReference: "",
        notes: "",
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sponsors", "profiles", "all"] }),
        queryClient.invalidateQueries({ queryKey: ["sponsors", "sponsorship", "records"] }),
        queryClient.invalidateQueries({ queryKey: ["children", "profiles"] }),
      ]);
    } catch (error) {
      setPledgeError(
        error instanceof Error ? error.message : "Unable to confirm transfer.",
      );
    } finally {
      setPledgeSubmitting(false);
    }
  };

  const handleCancelPublicPledge = async (pledgeId: string) => {
    setPledgeSubmitting(true);
    setPledgeError("");
    try {
      await apiRequest("POST", `/sponsors/public/pledges/${pledgeId}/cancel`, {
        notes: "Cancelled by staff before transfer confirmation.",
      });
      setActivePledgeId("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sponsors", "profiles", "all"] }),
        queryClient.invalidateQueries({ queryKey: ["sponsors", "sponsorship", "records"] }),
      ]);
    } catch (error) {
      setPledgeError(
        error instanceof Error ? error.message : "Unable to cancel pledge.",
      );
    } finally {
      setPledgeSubmitting(false);
    }
  };

  const downloadCsv = () => {
    const headers = [
      "Sponsor",
      "Email",
      "Phone",
      "Location",
      "DonationAmount",
      "Period",
      "ProfileStatus",
    ];
    const rows = sponsorProfiles.map((profile) => [
      profile.profile?.fullName || "",
      profile.profile?.email || "",
      profile.profile?.phone || "",
      [
        profile.location?.city,
        profile.location?.state,
        profile.location?.country,
      ]
        .filter(Boolean)
        .join(", "),
      String(profile.donation?.amount || 0),
      profile.donation?.period || "",
      profile.profileStatus || "Incomplete",
    ]);
    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "sponsor-profiles.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-w-0 p-4 sm:p-6 lg:p-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
            Dashboard / Sponsorships
          </p>
          <h1 className="text-3xl font-bold text-foreground">
            Sponsorship Tracking
          </h1>
          <p className="max-w-2xl text-foreground/70 mt-2">
            Track donors, payment history, and active sponsorship plans in one
            place.
          </p>
          <ListPagination
            page={page}
            hasNextPage={sponsorProfiles.length === PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
          <Button
            onClick={() => {
              resetSponsorForm();
              setIsCreateDialogOpen(true);
            }}
            className="w-full md:w-auto"
          >
            <Plus className="mr-2" size={16} /> Add sponsor profile
          </Button>
          <Button onClick={downloadCsv} className="w-full md:w-auto">
            <Download className="mr-2" size={16} /> Export CSV
          </Button>
        </div>
      </div>

      <div className="mb-8 grid gap-4 sm:gap-6 lg:grid-cols-3">
        {isLoading ? (
          <>
            <Card className="p-6 bg-card border-border">
              <div className="flex items-center gap-4">
                <Skeleton className="size-6 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            </Card>
            <Card className="p-6 bg-card border-border">
              <div className="flex items-center gap-4">
                <Skeleton className="size-6 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            </Card>
            <Card className="p-6 bg-card border-border">
              <div className="flex items-center gap-4">
                <Skeleton className="size-6 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            </Card>
          </>
        ) : (
          <>
            <Card className="p-6 bg-card border-border">
              <div className="flex items-center gap-4">
                <Users className="size-6 text-primary" />
                <div>
                  <p className="text-sm uppercase text-muted-foreground">
                    Complete profiles
                  </p>
                  <p className="text-3xl font-semibold text-foreground">
                    {totalActive}
                  </p>
                </div>
              </div>
            </Card>
            <Card className="p-6 bg-card border-border">
              <div className="flex items-center gap-4">
                <DollarSign className="size-6 text-emerald-600" />
                <div>
                  <p className="text-sm uppercase text-muted-foreground">
                    Pledged amount
                  </p>
                  <p className="text-3xl font-semibold text-foreground">
                    ${totalMonthly}
                  </p>
                </div>
              </div>
            </Card>
            <Card className="p-6 bg-card border-border">
              <div className="flex items-center gap-4">
                <ArrowUpRight className="size-6 text-sky-600" />
                <div>
                  <p className="text-sm uppercase text-muted-foreground">
                    Paid total
                  </p>
                  <p className="text-3xl font-semibold text-foreground">
                    {totalPaid ? `$${totalPaid}` : "View details"}
                  </p>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>

      <Card className="mb-8 border-border bg-card p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Pending public pledges
            </h2>
            <p className="text-sm text-muted-foreground">
              Record a transfer only after it appears in the organization&apos;s bank account.
            </p>
          </div>
          <Badge variant="secondary">{pendingPublicPledges.length} pending</Badge>
        </div>

        {pledgeError ? (
          <p role="alert" className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {pledgeError}
          </p>
        ) : null}

        {pendingPublicPledges.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            No pending public pledges.
          </p>
        ) : (
          <div className="space-y-3">
            {pendingPublicPledges.map((pledge) => {
              const donor = pledge.donor || {};
              const child = pledge.child || {};
              const isReviewing = activePledgeId === pledge._id;

              return (
                <div key={pledge._id} className="rounded-lg border border-border bg-background p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <p className="font-semibold text-foreground">
                        {donor.profile?.fullName || donor.sponsor?.name || "Sponsor"}
                        {child.firstName ? ` / ${child.firstName} ${child.secondName || ""}` : " / Child"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {donor.profile?.email || "No email"} · ${pledge.amount} {pledge.currency || "USD"} / {pledge.frequency || "Monthly"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Pledge reference: {pledge.publicPledgeReference}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={isReviewing ? "secondary" : "default"}
                        onClick={() => {
                          setActivePledgeId(isReviewing ? "" : pledge._id);
                          setPledgeReceipt({
                            amount: String(pledge.amount || ""),
                            date: new Date().toISOString().slice(0, 10),
                            bankReference: "",
                            notes: "",
                          });
                          setPledgeError("");
                        }}
                      >
                        {isReviewing ? "Close review" : "Record received transfer"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pledgeSubmitting}
                        onClick={() => void handleCancelPublicPledge(pledge._id)}
                      >
                        Cancel pledge
                      </Button>
                    </div>
                  </div>

                  {isReviewing ? (
                    <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label htmlFor={`receivedAmount-${pledge._id}`}>Received amount (USD)</Label>
                        <Input
                          id={`receivedAmount-${pledge._id}`}
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={pledgeReceipt.amount}
                          onChange={(event) => setPledgeReceipt({ ...pledgeReceipt, amount: event.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`receivedDate-${pledge._id}`}>Received date</Label>
                        <Input
                          id={`receivedDate-${pledge._id}`}
                          type="date"
                          value={pledgeReceipt.date}
                          onChange={(event) => setPledgeReceipt({ ...pledgeReceipt, date: event.target.value })}
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor={`bankReference-${pledge._id}`}>Bank transaction reference</Label>
                        <Input
                          id={`bankReference-${pledge._id}`}
                          value={pledgeReceipt.bankReference}
                          onChange={(event) => setPledgeReceipt({ ...pledgeReceipt, bankReference: event.target.value })}
                          autoComplete="off"
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor={`receiptNotes-${pledge._id}`}>Notes (optional)</Label>
                        <Input
                          id={`receiptNotes-${pledge._id}`}
                          value={pledgeReceipt.notes}
                          onChange={(event) => setPledgeReceipt({ ...pledgeReceipt, notes: event.target.value })}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <Button
                          type="button"
                          disabled={pledgeSubmitting}
                          onClick={() => void handleConfirmPublicPledge()}
                        >
                          {pledgeSubmitting ? "Recording..." : "Confirm bank receipt and activate"}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {!isLoading && (
        <Card className="mb-8 border-border bg-card p-4 sm:p-6">
          <div className="grid gap-4 md:grid-cols-[1fr_auto] items-end">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label  htmlFor="search">Search sponsors</Label>
                <Input 
                className = {`bg-background`}
                  id="search"
                  value={searchQuery}
                  placeholder="Search by name, email, or location"
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label  htmlFor="statusFilter">Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) =>
                    setStatusFilter(value as "all" | "Complete" | "Incomplete")
                  }
                >
                  <SelectTrigger id="statusFilter">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="Complete">Complete</SelectItem>
                    <SelectItem value="Incomplete">Incomplete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label >Records</Label>
                <p className="text-sm text-foreground/70">
                  {filteredRecords.length} sponsor profiles
                </p>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="min-w-0 overflow-hidden border-border bg-card">
        {isLoading ? (
          <div className="hidden max-w-full overflow-x-auto md:block">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead>Sponsor</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Donation amount</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Profile status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </TableCell>
                  <TableCell className="text-right">
                    <Skeleton className="h-8 w-16 ml-auto" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        ) : (
          <div className="hidden max-w-full overflow-x-auto md:block">
          <Table className="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead className="font-bold text-primary">
                  Sponsor
                </TableHead>
                <TableHead className="font-bold text-primary">
                  Contact
                </TableHead>
                <TableHead className="font-bold text-primary">
                  Location
                </TableHead>
                <TableHead className="font-bold text-primary">
                  Donation amount
                </TableHead>
                <TableHead className="font-bold text-primary">Period</TableHead>
                <TableHead className="font-bold text-primary">
                  Profile status
                </TableHead>
                {/* <TableHead className="text-right">Action</TableHead> */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.map((profile, index) => (
                <TableRow
                  className="cursor-pointer"
                  onClick={() => {
                    openDetail(profile);
                  }}
                  key={profile._id || index}
                >
                  <TableCell>
                    <div>
                      <p className="font-medium text-foreground">
                        {profile.profile?.fullName || "Unnamed sponsor"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {profile.profile?.bio || "No bio provided"}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm text-foreground/80">
                      <p>{profile.profile?.email || "No email"}</p>
                      <p>{profile.profile?.phone || "No phone"}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {[
                      profile.location?.city,
                      profile.location?.state,
                      profile.location?.country,
                    ]
                      .filter(Boolean)
                      .join(", ") || "No location"}
                  </TableCell>
                  <TableCell>
                    ${Number(profile.donation?.amount || 0)}
                  </TableCell>
                  <TableCell>
                    {profile.donation?.period || "Not provided"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusClasses(profile.profileStatus || "Incomplete")}`}
                    >
                      {profile.profileStatus || "Incomplete"}
                    </span>
                  </TableCell>
                  {/* <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openDetail(profile)}
                      >
                        View
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setArchiveTarget(profile)}
                      >
                        <Archive className="mr-1 size-4" />
                        Archive
                      </Button>
                    </div>
                  </TableCell> */}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}
        {isLoading ? (
          <div className="space-y-3 p-4 md:hidden">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-lg border border-border p-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="mt-3 h-4 w-56" />
                <Skeleton className="mt-2 h-4 w-32" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 p-4 md:hidden">
            {filteredRecords.map((profile, index) => (
              <button
                key={profile._id || index}
                type="button"
                onClick={() => openDetail(profile)}
                className="w-full rounded-lg border border-border bg-background p-4 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-foreground">
                      {profile.profile?.fullName || "Unnamed sponsor"}
                    </p>
                    <p className="mt-1 break-all text-sm text-foreground/70">
                      {profile.profile?.email || "No email"}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${getStatusClasses(profile.profileStatus || "Incomplete")}`}
                  >
                    {profile.profileStatus || "Incomplete"}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Phone
                    </p>
                    <p className="mt-1 break-words text-foreground/80">
                      {profile.profile?.phone || "No phone"}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Location
                    </p>
                    <p className="mt-1 break-words text-foreground/80">
                      {[
                        profile.location?.city,
                        profile.location?.state,
                        profile.location?.country,
                      ]
                        .filter(Boolean)
                        .join(", ") || "No location"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Donation
                    </p>
                    <p className="mt-1 font-medium text-foreground">
                      ${Number(profile.donation?.amount || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Period
                    </p>
                    <p className="mt-1 text-foreground/80">
                      {profile.donation?.period || "Not provided"}
                    </p>
                  </div>
                </div>
              </button>
            ))}
            {filteredRecords.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                No sponsor profiles match the current filters.
              </p>
            ) : null}
          </div>
        )}
      </Card>

      <Dialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setArchiveTarget(null);
            setArchiveError("");
          }
        }}
      >
        <DialogContent className="max-w-sm bg-card">
          <DialogHeader>
            <DialogTitle>Archive sponsor profile?</DialogTitle>
            <DialogDescription>
              This will release the sponsor&apos;s active children and hide the
              profile from active lists. Sponsorship and payment history will be
              preserved.
            </DialogDescription>
            {archiveError ? (
              <p className="text-sm text-destructive">{archiveError}</p>
            ) : null}
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isArchiving}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleArchiveSponsor}
              disabled={isArchiving}
            >
              {isArchiving ? (
                <Loader className="mr-2 size-4 animate-spin" />
              ) : (
                <Archive className="mr-2 size-4" />
              )}
              {isArchiving ? "Archiving..." : "Archive profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-h-[90vh] bg-card overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create sponsor profile</DialogTitle>
            <DialogDescription>
              Add a sponsor who can support a child and begin tracking the
              sponsorship relationship.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Sponsor basics
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sponsorImage">Profile photo (optional)</Label>
                <div className="flex items-center gap-4">
                  {sponsorForm.image.url ? (
                    <div className="relative h-16 w-16 overflow-hidden rounded-full border border-border">
                      <img
                        src={sponsorForm.image.url}
                        alt="Sponsor profile preview"
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={removeSponsorImage}
                        aria-label="Remove sponsor photo"
                        className="absolute right-0 top-0 rounded-full bg-background/90 p-1 text-foreground"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : null}
                  <input
                    id="sponsorImage"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={isUploadingSponsorImage}
                    onChange={(event) => {
                      void handleSponsorImageUpload(event.target.files?.[0]);
                      event.currentTarget.value = "";
                    }}
                    className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2"
                  />
                  {isUploadingSponsorImage ? (
                    <Loader className="size-4 animate-spin" aria-label="Uploading" />
                  ) : (
                    <Upload size={16} aria-hidden="true" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP; maximum 5 MB.</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label  htmlFor="sponsorName">Full name</Label>
                  <Input 
                  className = {`bg-background`}
                    id="sponsorName"
                    value={sponsorForm.name}
                    onChange={(event) =>
                      setSponsorForm({
                        ...sponsorForm,
                        name: event.target.value,
                      })
                    }
                    placeholder="Sponsor full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label  htmlFor="sponsorEmail">Email</Label>
                  <Input 
                  className = {`bg-background`}
                    id="sponsorEmail"
                    type="email"
                    value={sponsorForm.email}
                    onChange={(event) =>
                      setSponsorForm({
                        ...sponsorForm,
                        email: event.target.value,
                      })
                    }
                    placeholder="sponsor@example.com"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label  htmlFor="sponsorPhone">Phone</Label>
                  <Input 
                  className = {`bg-background`}
                    id="sponsorPhone"
                    type="tel"
                    value={sponsorForm.phone}
                    onChange={(event) =>
                      setSponsorForm({
                        ...sponsorForm,
                        phone: event.target.value,
                      })
                    }
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label  htmlFor="sponsorCountry">Country of origin</Label>
                  <Input 
                  className = {`bg-background`}
                    id="sponsorCountry"
                    value={sponsorForm.country}
                    onChange={(event) =>
                      setSponsorForm({
                        ...sponsorForm,
                        country: event.target.value,
                      })
                    }
                    placeholder="Country"
                  />
                </div>
                <div className="space-y-2">
                  <Label  className="text-muted-foreground" htmlFor="sponsorPaymentMethod">Payment method</Label>
                  <Select
                    value={sponsorForm.paymentMethod}
                    onValueChange={(value) =>
                      setSponsorForm({ ...sponsorForm, paymentMethod: value })
                    }
                  >
                    <SelectTrigger id="sponsorPaymentMethod" className="w-full bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zelle">Zelle</SelectItem>
                      <SelectItem value="stripe">Stripe</SelectItem>
                      <SelectItem value="check">Check</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="paypal">PayPal</SelectItem>
                      <SelectItem value="ach">ACH</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Location</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label  htmlFor="sponsorAddress">Address</Label>
                  <Input 
                  className = {`bg-background`}
                    id="sponsorAddress"
                    value={sponsorForm.address}
                    onChange={(event) =>
                      setSponsorForm({
                        ...sponsorForm,
                        address: event.target.value,
                      })
                    }
                    placeholder="Street address"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label  htmlFor="sponsorCity">City</Label>
                    <Input 
                    className = {`bg-background`}
                      id="sponsorCity"
                      value={sponsorForm.city}
                      onChange={(event) =>
                        setSponsorForm({
                          ...sponsorForm,
                          city: event.target.value,
                        })
                      }
                      placeholder="City"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label  htmlFor="sponsorState">State</Label>
                    <Input 
                    className = {`bg-background`}
                      id="sponsorState"
                      value={sponsorForm.state}
                      onChange={(event) =>
                        setSponsorForm({
                          ...sponsorForm,
                          state: event.target.value,
                        })
                      }
                      placeholder="State"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label  htmlFor="sponsorRegion">Region</Label>
                    <Input 
                    className = {`bg-background`}
                      id="sponsorRegion"
                      value={sponsorForm.region}
                      onChange={(event) =>
                        setSponsorForm({
                          ...sponsorForm,
                          region: event.target.value,
                        })
                      }
                      placeholder="Region"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label  htmlFor="sponsorZipCode">Zip code</Label>
                    <Input 
                    className = {`bg-background`}
                      id="sponsorZipCode"
                      value={sponsorForm.zipCode}
                      onChange={(event) =>
                        setSponsorForm({
                          ...sponsorForm,
                          zipCode: event.target.value,
                        })
                      }
                      placeholder="ZIP code"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label  htmlFor="sponsorBio">Bio</Label>
                  <textarea
                    id="sponsorBio"
                    value={sponsorForm.bio}
                    onChange={(event) =>
                      setSponsorForm({
                        ...sponsorForm,
                        bio: event.target.value,
                      })
                    }
                    placeholder="Tell us about the sponsor"
                    className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Donation details
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label  htmlFor="sponsorAmount">Amount</Label>
                  <Input 
                  className = {`bg-background`}
                    id="sponsorAmount"
                    type="number"
                    value={sponsorForm.amount}
                    onChange={(event) =>
                      setSponsorForm({
                        ...sponsorForm,
                        amount: event.target.value,
                      })
                    }
                    placeholder="150"
                  />
                </div>
                <div className="space-y-2">
                  <Label  htmlFor="sponsorPeriod">Period</Label>
                  <Select
                    value={sponsorForm.period}
                    onValueChange={(value) =>
                      setSponsorForm({ ...sponsorForm, period: value })
                    }
                  >
                    <SelectTrigger id="sponsorPeriod" className="w-full bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="3 Months">3 Months</SelectItem>
                      <SelectItem value="6 Months">6 Months</SelectItem>
                      <SelectItem value="Yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground" htmlFor="sponsorStartDate">Start date</Label>
                <Input 
                className = {`bg-background`}
                  id="sponsorStartDate"
                  type="date"
                  value={sponsorForm.startDate}
                  onChange={(event) =>
                    setSponsorForm({
                      ...sponsorForm,
                      startDate: event.target.value,
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label className="text-muted-foreground" htmlFor="expectedFundsDate">Expected funds date</Label>
                <Input
                  className="bg-background"
                  id="expectedFundsDate"
                  type="date"
                  value={sponsorForm.expectedFundsDate}
                  onChange={(event) =>
                    setSponsorForm({
                      ...sponsorForm,
                      expectedFundsDate: event.target.value,
                    })
                  }
                />
              </div>

              <div className="flex items-center gap-2">
                <input 
                
                  id="remindByEmail"
                  type="checkbox"
                  checked={sponsorForm.remindByEmail}
                  onChange={(event) =>
                    setSponsorForm({
                      ...sponsorForm,
                      remindByEmail: event.target.checked,
                    })
                  }
                  className="h-4 w-4 bg-background rounded border-border text-primary focus:ring-primary"
                />
                <Label  htmlFor="remindByEmail">Send reminders by email</Label>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Optional child assignment
                </p>
              </div>

              <div className="space-y-2">
                <Label  htmlFor="sponsorChild">Link to child</Label>
                <Select
                  value={sponsorForm.childId}
                  onValueChange={(value) =>
                    setSponsorForm({ ...sponsorForm, childId: value })
                  }
                >
                  <SelectTrigger id="sponsorChild" className="w-full bg-background">
                    <SelectValue placeholder="Select a child (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {childrenData.map((child) => (
                      <SelectItem key={child._id} value={child._id}>
                        {child.firstName} {child.secondName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {sponsorFormError ? (
              <p className="text-sm text-red-500">{sponsorFormError}</p>
            ) : null}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button
                variant="outline"
                onClick={() => {
                  resetSponsorForm();
                  setSponsorFormError("");
                }}
              >
                Cancel
              </Button>
            </DialogClose>
            <Button onClick={handleCreateSponsor} disabled={sponsorSubmitting}>
              {sponsorSubmitting ? (
                <>
                  Creating... <Loader className="ml-2 animate-spin" size={16} />
                </>
              ) : (
                "Create sponsor"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete sponsor profile</DialogTitle>
            <DialogDescription>
              Add or correct the sponsor information without changing
              sponsorship payments.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label  htmlFor="editSponsorName">Full name</Label>
              <Input 
              className = {`bg-background`}
                id="editSponsorName"
                value={sponsorForm.name}
                onChange={(event) =>
                  setSponsorForm({ ...sponsorForm, name: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label  htmlFor="editSponsorEmail">Email</Label>
              <Input 
              className = {`bg-background`}
                id="editSponsorEmail"
                type="email"
                value={sponsorForm.email}
                onChange={(event) =>
                  setSponsorForm({ ...sponsorForm, email: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label  htmlFor="editSponsorPhone">Phone</Label>
              <Input 
              className = {`bg-background`}
                id="editSponsorPhone"
                value={sponsorForm.phone}
                onChange={(event) =>
                  setSponsorForm({ ...sponsorForm, phone: event.target.value })
                }
              />
            </div>
            {[
              ["country", "Country of origin"],
              ["city", "City"],
              ["state", "State"],
              ["region", "Region"],
              ["zipCode", "Zip code"],
            ].map(([field, label]) => (
              <div className="space-y-2" key={field}>
                <Label  htmlFor={`editSponsor${field}`}>{label}</Label>
                <Input 
                className = {`bg-background`}
                  id={`editSponsor${field}`}
                  value={sponsorForm[field as keyof SponsorForm] as string}
                  onChange={(event) =>
                    setSponsorForm({
                      ...sponsorForm,
                      [field]: event.target.value,
                    })
                  }
                />
              </div>
            ))}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="editExpectedFundsDate">Expected funds date</Label>
              <Input
                id="editExpectedFundsDate"
                type="date"
                className="bg-background"
                value={sponsorForm.expectedFundsDate}
                onChange={(event) =>
                  setSponsorForm({
                    ...sponsorForm,
                    expectedFundsDate: event.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label  htmlFor="editSponsorBio">Bio</Label>
              <textarea
                id="editSponsorBio"
                value={sponsorForm.bio}
                onChange={(event) =>
                  setSponsorForm({ ...sponsorForm, bio: event.target.value })
                }
                className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            {sponsorFormError ? (
              <p className="text-sm text-red-500 md:col-span-2">
                {sponsorFormError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditProfileOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateProfile}>Save profile</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-175 overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sponsorship details</DialogTitle>
          </DialogHeader>
          {selectedRecord ? (
            <div className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-1">
                <Card className="p-6 relative   bg-card border-border">
                  <div className="space-y-4">
                    <div className="absolute top-5 right-3">
                      <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                        Status
                      </p>
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getStatusClasses(selectedRecord.status)}`}
                      >
                        {selectedRecord.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                        Child
                      </p>
                      <h2 className="text-xl font-semibold text-foreground">
                        {selectedRecord.child?.firstName}
                      </h2>
                      <p className="text-sm text-foreground/70">
                        {selectedRecord.plan}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                        Sponsor profile
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={openProfileEditor}
                      >
                        Complete profile
                      </Button>
                      <p className="text-lg font-semibold text-foreground">
                        {selectedSponsorProfile?.sponsor?.name ||
                          selectedSponsorProfile?.name ||
                          selectedRecord.donor?.sponsor?.name}
                      </p>
                      <a
                        href={`mailto:${selectedSponsorProfile?.sponsor?.email || selectedSponsorProfile?.email || selectedRecord.donor?.sponsor?.email}`}
                        className="text-sm text-accent underline"
                      >
                        {selectedSponsorProfile?.sponsor?.email ||
                          selectedSponsorProfile?.email ||
                          selectedRecord.donor?.sponsor?.email}
                      </a>{" "}
                      -{" "}
                      {selectedSponsorProfile?.sponsor?.phone ||
                        selectedSponsorProfile?.phone ||
                        selectedRecord.donor?.sponsor?.phone}
                      <p className="text-sm text-foreground/70">
                        {selectedSponsorProfile?.location?.city ||
                          selectedRecord.donor?.phone ||
                          "Location not provided"}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg bg-slate-100 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          {selectedRecord.donor?.donation?.period}
                        </p>
                        <p className="text-xl font-semibold text-foreground">
                          ${selectedRecord?.donor?.donation?.amount || 0}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-100 p-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                          All time Donations
                        </p>
                        <p className="text-xl font-semibold text-foreground">
                          $
                          {selectedRecord.payments
                            .map((p) => p.amount)
                            .reduce((sum, amount) => sum + amount, 0)}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-lg border border-border bg-background p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                          Sponsor relationship
                        </p>
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                          {(selectedSponsorSummary?.totalChildren ??
                            selectedSponsorChildren.length) ||
                            0}{" "}
                          children
                        </span>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-md bg-slate-100 p-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            Active
                          </p>
                          <p className="mt-2 text-lg font-semibold text-foreground">
                            {selectedSponsorSummary?.activeChildren ??
                              selectedSponsorChildren.filter(
                                (entry) => entry.status === "Active",
                              ).length}
                          </p>
                        </div>
                        <div className="rounded-md bg-slate-100 p-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            Pledged
                          </p>
                          <p className="mt-2 text-lg font-semibold text-foreground">
                            $
                            {selectedSponsorSummary?.totalPledged ??
                              selectedSponsorChildren.reduce(
                                (sum, entry) => sum + (entry.amount || 0),
                                0,
                              )}
                          </p>
                        </div>
                        <div className="rounded-md bg-slate-100 p-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            Paid
                          </p>
                          <p className="mt-2 text-lg font-semibold text-foreground">
                            $
                            {selectedSponsorSummary?.totalPaid ??
                              selectedSponsorChildren.reduce(
                                (sum, entry) => sum + (entry.totalPaid || 0),
                                0,
                              )}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {loadingSponsorChildren ? (
                          <div className="space-y-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                          </div>
                        ) : selectedSponsorChildren.length > 0 ? (
                          selectedSponsorChildren.map((entry, index) => {
                            const child = entry.child || {};
                            const childName =
                              child.firstName || child.name || "Unnamed child";
                            const lastPayment = entry.lastPayment
                              ? new Date(entry.lastPayment).toLocaleDateString()
                              : "No payment";

                            return (
                              <div
                                key={entry._id || index}
                                className="flex items-center justify-between gap-3 rounded-md border border-border bg-slate-50 p-3"
                              >
                                <div>
                                  <p className="font-medium text-foreground">
                                    {childName}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {entry.status} • ${entry.amount || 0} •{" "}
                                    {lastPayment}
                                  </p>
                                </div>
                                <span
                                  className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusClasses(entry.status)}`}
                                >
                                  {entry.status}
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <p className="rounded-md border border-dashed border-border p-3 text-sm text-foreground/70">
                            No children are currently linked to this sponsor.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-3">
                        <Label  htmlFor="recordStatus">Update status</Label>
                        <Select
                          value={selectedRecord.status}
                          onValueChange={handleUpdateStatus}
                          disabled={Boolean(selectedRecord.publicPledgeReference)}
                        >
                          <SelectTrigger id="recordStatus" className="w-full">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Paused">Paused</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        {selectedRecord.publicPledgeReference ? (
                          <p className="text-xs text-muted-foreground">
                            Public pledges must be confirmed from the Pending public pledges section after the bank transfer is received.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-1">
                <Card className="p-6 bg-card border-border">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                          Payment history
                        </p>
                        <p className="text-foreground/70">
                          Latest contributions for this sponsorship.
                        </p>
                      </div>
                      <Badge className="bg-slate-100 text-slate-800">
                        {selectedRecord.payments.length} entries
                      </Badge>
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Transaction ID</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedRecord.payments.map((payment, index) => (
                            <TableRow key={index}>
                              <TableCell>
                                {new Date(payment.date).toLocaleDateString()}
                              </TableCell>
                              <TableCell>${payment.amount}</TableCell>
                              <TableCell>{payment.method}</TableCell>
                              <TableCell>{payment.status}</TableCell>
                              <TableCell>{payment.transactionId}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </Card>
                <Card className="p-6 bg-card border-border">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
                        Record a payment
                      </p>
                      <p className="text-foreground/70">
                        Add a new donation or sponsor contribution.
                      </p>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label  htmlFor="paymentAmount">Amount</Label>
                        <Input 
                        className = {`bg-background`}
                          id="paymentAmount"
                          type="number"
                          value={paymentForm.amount}
                          placeholder="100"
                          onChange={(event) =>
                            setPaymentForm({
                              ...paymentForm,
                              amount: event.target.value,
                            })
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label  htmlFor="paymentMethod">Method</Label>
                        <Select
                          value={paymentForm.method}
                          onValueChange={(value) =>
                            setPaymentForm({ ...paymentForm, method: value })
                          }
                        >
                          <SelectTrigger id="paymentMethod" className="w-full ">
                            <SelectValue placeholder="Select method" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Zelle">Zelle</SelectItem>
                            <SelectItem value="Stripe">Stripe</SelectItem>
                            <SelectItem value="Check">Check</SelectItem>
                            <SelectItem value="PayPal">PayPal</SelectItem>
                            <SelectItem value="ACH">ACH</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label  htmlFor="paymentTxnId">Transaction ID</Label>
                        <Input 
                        className = {`bg-background`}
                          id="paymentTxnId"
                          type="text"
                          value={paymentForm.txnId}
                          placeholder="transaction ID / receipt No. from the payment method used"
                          onChange={(event) =>
                            setPaymentForm({
                              ...paymentForm,
                              txnId: event.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label  htmlFor="paymentNote">Note</Label>
                        <Input 
                        className = {`bg-background`}
                          id="paymentNote"
                          value={paymentForm.note}
                          placeholder="Gift update or memo"
                          onChange={(event) =>
                            setPaymentForm({
                              ...paymentForm,
                              note: event.target.value,
                            })
                          }
                        />
                      </div>
                      <Button
                        onClick={handleAddPayment}
                        className="w-full"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            Adding payment...{" "}
                            <Loader className="animate-spin" />
                          </>
                        ) : (
                          "Add payment"
                        )}
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-foreground/70">
              No sponsorship record selected.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
