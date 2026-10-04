"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { jsPDF } from "jspdf";
import {
  Archive,
  ArrowLeft,
  CreditCard,
  Download,
  Unlink,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/query-client";
import { uploadImageToCloudinary } from "@/lib/cloudinary-upload";
import { Camera, Loader2 } from "lucide-react";

type SponsorDetail = {
  sponsor: {
    _id: string;
    profile?: {
      fullName?: string;
      email?: string;
      phone?: string;
      bio?: string;
    };
    sponsor?: {
      name?: string;
      email?: string;
      phone?: string;
    };
    location?: {
      address?: string;
      country?: string;
      city?: string;
      state?: string;
      region?: string;
      zipCode?: string;
    };
    paymentMethod?: string;
    child?: string | { _id?: string };
    donation?: {
      amount?: number;
      period?: string;
      expectedFundsDate?: string | Date | null;
      remindByEmail?: boolean;
    };
    startDate?: string;
    profileStatus?: string;
    image?: { url?: string; public_id?: string };
  };
  profileStatus?: string;
  profileCompletion?: number;
  children?: any[];
  paymentHistory?: any[];
  summary?: {
    totalChildren?: number;
    activeChildren?: number;
    pendingChildren?: number;
    totalPledged?: number;
    totalPaid?: number;
    lastPaymentDate?: string | null;
    nextPaymentDate?: string | null;
  };
};

function getStatusBadgeClass(status?: string) {
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

function createPaymentReference() {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 7 }, () =>
    characters.charAt(Math.floor(Math.random() * characters.length)),
  ).join("");
}

function formatDisplayDate(value?: string | Date | null) {
  if (!value) return "Not provided";

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return String(value);
  }

  return parsedDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function loadSponsorPdfImage(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Unable to load an image for the PDF.");

  const blob = await response.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to prepare PDF image."));
    reader.readAsDataURL(blob);
  });

  const dimensions = await new Promise<{ width: number; height: number }>(
    (resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.width, height: image.height });
      image.onerror = () => reject(new Error("Unable to read PDF image."));
      image.src = dataUrl;
    },
  );

  return {
    dataUrl,
    format: blob.type.includes("png") ? "PNG" : "JPEG",
    ...dimensions,
  } as const;
}

export default function SponsorDetailPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useParams();
  const sponsorId = typeof params?.id === "string" ? params.id : "";

  const [profile, setProfile] = useState<SponsorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "children" | "donations"
  >("overview");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingReminderPreference, setIsUpdatingReminderPreference] = useState(false);
  const [reminderPreferenceError, setReminderPreferenceError] = useState("");
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [unlinkTarget, setUnlinkTarget] = useState<{
    childId: string;
    childName: string;
  } | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [unlinkError, setUnlinkError] = useState("");
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    currency: "UGX",
    date: new Date().toISOString().slice(0, 10),
    method: "Cash",
    transactionId: "",
    notes: "",
    splitDonation: false,
    allocationMode: "equal" as "equal" | "custom",
    selectedSponsorshipIds: [] as string[],
    customAmounts: {} as Record<string, string>,
  });
  const [formError, setFormError] = useState("");
  const [formState, setFormState] = useState({
    fullName: "",
    email: "",
    phone: "",
    country: "",
    city: "",
    state: "",
    region: "",
    zipCode: "",
    bio: "",
    address: "",
    amount: "",
    period: "Monthly",
    expectedFundsDate: "",
    remindByEmail: true,
    paymentMethod: "zelle",
    childId: "",
    startDate: new Date().toISOString().slice(0, 10),
  });
  const [childrenOptions, setChildrenOptions] = useState<any[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const [isExportingProfile, setIsExportingProfile] = useState(false);

  useEffect(() => {
    if (!sponsorId) return;

    let isMounted = true;

    const fetchProfile = async () => {
      setLoading(true);

      try {
        const response = await apiRequest("GET", `/sponsors/${sponsorId}`);
        const data = await response.json();

        if (isMounted) {
          setProfile(data as SponsorDetail);
        }
      } catch (error) {
        console.error("Error loading sponsor profile:", error);
        if (isMounted) {
          setProfile(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchProfile();

    apiRequest("GET", "/children/profiles")
      .then((response) => response.json())
      .then((data) => {
        if (isMounted) setChildrenOptions(Array.isArray(data) ? data : []);
      })
      .catch((error) => console.error("Error loading child options:", error));

    return () => {
      isMounted = false;
    };
  }, [sponsorId]);

  const sponsor = profile?.sponsor || ({} as SponsorDetail["sponsor"]);
  const sponsorProfile = sponsor.profile || {};
  const sponsoredChildren = useMemo(
    () => (Array.isArray(profile?.children) ? profile.children : []),
    [profile],
  );

  const paymentHistory = useMemo(() => {
    if (
      Array.isArray(profile?.paymentHistory) &&
      profile.paymentHistory.length > 0
    ) {
      return profile.paymentHistory;
    }

    return sponsoredChildren.flatMap((entry: any) =>
      (entry.payments || []).map((payment: any) => ({
        ...payment,
        sponsorshipId: entry._id,
        child: entry.child,
      })),
    );
  }, [profile]);

  const exportRows = useMemo(
    () =>
      paymentHistory.map((payment: any) => ({
        date: payment.date ? new Date(payment.date).toLocaleDateString() : "",
        childId: String(payment.child?._id || payment.childId || ""),
        sponsorshipId: String(payment.sponsorshipId || ""),
        amount: String(Number(payment.amount || 0)),
        currency: payment.currency || "UGX",
        method: payment.method || payment.paymentMethod || "",
        status: payment.status || "Completed",
        reference: payment.transactionId || "",
        paymentGroupId: payment.paymentGroupId || "",
        notes: payment.notes || "",
      })),
    [paymentHistory],
  );

  const downloadFile = (content: BlobPart, filename: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;

  const exportPaymentsCsv = () => {
    if (exportRows.length === 0) return;
    const headers = [
      "Date",
      "Child ID",
      "Sponsorship ID",
      "Amount",
      "Currency",
      "Method",
      "Status",
      "Reference",
      "Payment Group ID",
      "Notes",
    ];
    const rows = exportRows.map((row) => [
      row.date,
      row.childId,
      row.sponsorshipId,
      row.amount,
      row.currency,
      row.method,
      row.status,
      row.reference,
      row.paymentGroupId,
      row.notes,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\r\n");
    downloadFile(
      `\ufeff${csv}`,
      `sponsor-donations-${sponsorId}.csv`,
      "text/csv;charset=utf-8",
    );
  };

  const exportPaymentsPdf = () => {
    if (exportRows.length === 0) return;
    const pdf = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });
    const margin = 10;
    const pageWidth = pdf.internal.pageSize.getWidth();
    const columnWidths = [22, 36, 36, 22, 18, 28, 22, 30, 38, 58];
    const headers = [
      "Date",
      "Child ID",
      "Sponsorship ID",
      "Amount",
      "Currency",
      "Method",
      "Status",
      "Reference",
      "Payment Group",
      "Notes",
    ];
    let y = 24;

    pdf.setFontSize(14);
    pdf.text(`Donation history: ${sponsorName}`, margin, 12);
    pdf.setFontSize(8);
    pdf.text(
      `Sponsor ID: ${sponsorId} | Exported: ${new Date().toLocaleDateString()}`,
      margin,
      18,
    );

    const drawRow = (values: string[], bold = false) => {
      let x = margin;
      pdf.setFont("helvetica", bold ? "bold" : "normal");
      values.forEach((value, index) => {
        const lines = pdf.splitTextToSize(value || "", columnWidths[index] - 2);
        pdf.text(lines, x + 1, y + 4);
        x += columnWidths[index];
      });
      const rowHeight =
        Math.max(
          ...values.map(
            (value, index) =>
              pdf.splitTextToSize(value || "", columnWidths[index] - 2).length,
          ),
          1,
        ) *
          4 +
        4;
      pdf.setDrawColor(220);
      pdf.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
      y += rowHeight;
    };

    drawRow(headers, true);
    exportRows.forEach((row) => {
      const values = [
        row.date,
        row.childId,
        row.sponsorshipId,
        row.amount,
        row.currency,
        row.method,
        row.status,
        row.reference,
        row.paymentGroupId,
        row.notes,
      ];
      const height =
        Math.max(
          ...values.map(
            (value, index) =>
              pdf.splitTextToSize(value || "", columnWidths[index] - 2).length,
          ),
          1,
        ) *
          4 +
        4;
      if (y + height > 195) {
        pdf.addPage();
        y = 16;
        drawRow(headers, true);
      }
      drawRow(values);
    });
    pdf.save(`sponsor-donations-${sponsorId}.pdf`);
  };

  const exportSponsorProfilePdf = async () => {
    if (!profile) return;

    setIsExportingProfile(true);
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 16;
      const contentWidth = pageWidth - margin * 2;
      const bottom = pageHeight - 18;
      const colors = {
        ink: [28, 36, 33] as [number, number, number],
        muted: [102, 112, 107] as [number, number, number],
        accent: [47, 112, 94] as [number, number, number],
        pale: [241, 245, 242] as [number, number, number],
        line: [218, 225, 220] as [number, number, number],
      };
      const value = (item: unknown) => {
        const text = String(item ?? "").trim();
        return text || "Not provided";
      };
      let cursor = margin;
      const setText = (color = colors.ink) => pdf.setTextColor(...color);
      const footer = () => {
        pdf.setDrawColor(...colors.line);
        pdf.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
        setText(colors.muted);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.text("Confidential sponsor profile", margin, pageHeight - 8);
        pdf.text(`Page ${pdf.getNumberOfPages()}`, pageWidth - margin, pageHeight - 8, { align: "right" });
      };
      const newPage = (title?: string) => {
        footer();
        pdf.addPage();
        cursor = margin;
        if (title) {
          setText(colors.ink);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(18);
          pdf.text(title, margin, cursor + 5);
          cursor += 15;
        }
      };
      const ensureSpace = (height: number, title?: string) => {
        if (cursor + height > bottom) newPage(title);
      };
      const section = (title: string) => {
        ensureSpace(18, title);
        cursor += 4;
        setText(colors.accent);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(13);
        pdf.text(title.toUpperCase(), margin, cursor);
        pdf.setDrawColor(...colors.accent);
        pdf.setLineWidth(0.8);
        pdf.line(margin, cursor + 4, pageWidth - margin, cursor + 4);
        cursor += 12;
      };
      const paragraph = (label: string, item: unknown) => {
        const lines = pdf.splitTextToSize(value(item), contentWidth);
        ensureSpace(10 + lines.length * 4.2);
        setText(colors.muted);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.text(label.toUpperCase(), margin, cursor);
        cursor += 5;
        setText(colors.ink);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9.5);
        pdf.text(lines, margin, cursor);
        cursor += lines.length * 4.2 + 5;
      };
      const twoColumns = (rows: Array<[string, unknown]>) => {
        const width = contentWidth / 2 - 5;
        for (let index = 0; index < rows.length; index += 2) {
          ensureSpace(14);
          const draw = ([label, item]: [string, unknown], x: number) => {
            setText(colors.muted);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(7.5);
            pdf.text(label.toUpperCase(), x, cursor);
            setText(colors.ink);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(9);
            pdf.text(pdf.splitTextToSize(value(item), width), x, cursor + 5);
          };
          draw(rows[index], margin);
          if (rows[index + 1]) draw(rows[index + 1], margin + contentWidth / 2 + 5);
          cursor += 14;
        }
      };
      const imageFrame = async (url: string | undefined, x: number, y: number, width: number, height: number) => {
        pdf.setFillColor(...colors.pale);
        pdf.roundedRect(x, y, width, height, 2, 2, "F");
        if (!url) {
          setText(colors.muted);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          pdf.text("Image not available", x + width / 2, y + height / 2, { align: "center" });
          return;
        }
        const image = await loadSponsorPdfImage(url);
        const scale = Math.min(width / image.width, height / image.height);
        pdf.addImage(image.dataUrl, image.format, x + (width - image.width * scale) / 2, y + (height - image.height * scale) / 2, image.width * scale, image.height * scale);
      };

      setText(colors.accent);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text("ENSIGO OF LOVE FOUNDATION", margin, cursor);
      setText(colors.muted);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text(new Date().toLocaleDateString(), pageWidth - margin, cursor, { align: "right" });
      cursor += 12;
      setText(colors.ink);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(24);
      pdf.text("PROFILE & BIO", margin, cursor);
      cursor += 8;
      setText(colors.muted);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text("A complete sponsor profile and sponsorship record.", margin, cursor);
      cursor += 10;

      const photoTop = cursor;
      await imageFrame(sponsor.image?.url, margin, photoTop, 62, 68);
      const detailsX = margin + 74;
      const details: Array<[string, unknown]> = [
        ["Name", sponsorName],
        ["Email", email],
        ["Phone", phone],
        ["Location", cityState],
        ["Status", profile.profileStatus || sponsor.profileStatus],
        ["Created", formatDisplayDate((sponsor as any).createdAt)],
      ];
      details.forEach(([label, item]) => {
        setText(colors.muted);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.text(label.toUpperCase(), detailsX, cursor);
        setText(colors.ink);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.text(pdf.splitTextToSize(value(item), contentWidth - 74), detailsX, cursor + 5);
        cursor += 10;
      });
      cursor = photoTop + 76;
      paragraph("Biography", sponsorProfile.bio);

      section("Family");
      twoColumns([
        ["Email", email],
        ["Phone", phone],
        ["Address", location.address],
        ["Country", location.country],
        ["City", location.city],
        ["Region", location.region],
      ]);

      section("Education");
      paragraph("Sponsor background", sponsorProfile.bio);
      paragraph("Linked children", sponsoredChildren.length);
      if (sponsoredChildren.length) {
        for (const entry of sponsoredChildren) {
          const child = entry.child || {};
          ensureSpace(32);
          const childName = child.givenName || [child.firstName, child.secondName].filter(Boolean).join(" ") || "Child";
          await imageFrame(child.image?.url, margin, cursor, 24, 27);
          setText(colors.ink);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(9.5);
          pdf.text(childName, margin + 31, cursor + 7);
          setText(colors.muted);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8.5);
          pdf.text(`${value(child.school)} | ${value(child.class)}`, margin + 31, cursor + 13);
          pdf.text(`Sponsorship: ${value(entry.status)} | ${value(entry.frequency)}`, margin + 31, cursor + 19);
          cursor += 34;
        }
      }

      section("Sponsor Details");
      twoColumns([
        ["Sponsorship status", profile.profileStatus || sponsor.profileStatus],
        ["Linked sponsorships", profile.summary?.totalChildren],
        ["Total pledged", `${totalPledged} ${plegedFrequency}`],
        ["Total paid", totalPaid],
        ["Payment method", sponsor.paymentMethod],
        ["Email reminders", sponsor.donation?.remindByEmail ? "Enabled" : "Disabled"],
      ]);
      if (paymentHistory.length) {
        paymentHistory.forEach((payment: any) => {
          paragraph("Payment", `${formatDisplayDate(payment.date)} | ${value(payment.amount)} ${value(payment.currency || "UGX")} | ${value(payment.method)} | ${value(payment.transactionId)}`);
        });
      } else {
        paragraph("Payment history", "No payment history available.");
      }
      footer();

      const reportCards = sponsoredChildren.flatMap((entry: any) =>
        (entry.child?.reportCards || []).map((card: any) => ({
          ...card,
          childName: entry.child?.givenName || entry.child?.firstName || "Child",
        })),
      );
      if (reportCards.length) {
        for (const card of reportCards) {
          newPage("REPORT CARDS");
          setText(colors.ink);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(13);
          pdf.text(`${value(card.childName)} - ${value(card.name)}`, margin, cursor);
          cursor += 8;
          if (String(card.fileType || "").toLowerCase().includes("pdf")) {
            paragraph("Document", "This report card is available as a separate PDF in the dashboard.");
          } else {
            await imageFrame(card.url, margin, cursor, contentWidth, pageHeight - cursor - 28);
          }
        }
        footer();
      }
      pdf.save(`sponsor-profile-${sponsorId}.pdf`);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "Unable to export sponsor profile PDF.");
    } finally {
      setIsExportingProfile(false);
    }
  };

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "children", label: "Children" },
    { key: "donations", label: "Donation history" },
  ] as const;

  const openEditDialog = () => {
    setFormState({
      fullName: sponsorProfile.fullName || sponsor.sponsor?.name || "",
      email: sponsorProfile.email || sponsor.sponsor?.email || "",
      phone: sponsorProfile.phone || sponsor.sponsor?.phone || "",
      country: (sponsorProfile as any).country || location.country || "",
      city: (sponsorProfile as any).city || location.city || "",
      state: (sponsorProfile as any).state || location.state || "",
      region: (sponsorProfile as any).region || location.region || "",
      zipCode: (sponsorProfile as any).zipCode || location.zipCode || "",
      bio: sponsorProfile.bio || "",
      address: location.address || "",
      amount: String(sponsor.donation?.amount || ""),
      period: sponsor.donation?.period || "Monthly",
      expectedFundsDate: sponsor.donation?.expectedFundsDate
        ? new Date(sponsor.donation.expectedFundsDate).toISOString().slice(0, 10)
        : "",
      remindByEmail: sponsor.donation?.remindByEmail !== false,
      paymentMethod: sponsor.paymentMethod || "zelle",
      childId:
        typeof sponsor.child === "string"
          ? sponsor.child
          : sponsor.child?._id || "",
      startDate: sponsor.startDate
        ? new Date(sponsor.startDate).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    });
    setFormError("");
    setIsEditOpen(true);
  };

  const handleReminderPreferenceChange = async (enabled: boolean) => {
    if (!sponsorId) return;

    setIsUpdatingReminderPreference(true);
    setReminderPreferenceError("");
    try {
      const response = await apiRequest(
        "PATCH",
        `/sponsors/profile/${sponsorId}`,
        { donation: { remindByEmail: enabled } },
      );
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to update reminder preference.");
      }

      setProfile((current) =>
        current
          ? { ...current, sponsor: { ...current.sponsor, ...result.sponsor } }
          : current,
      );
      setFormState((current) => ({ ...current, remindByEmail: enabled }));
      await queryClient.invalidateQueries({
        queryKey: ["sponsors", "profiles", "all"],
      });
    } catch (error) {
      setReminderPreferenceError(
        error instanceof Error
          ? error.message
          : "Unable to update reminder preference.",
      );
    } finally {
      setIsUpdatingReminderPreference(false);
    }
  };

  const handleSaveProfile = async () => {
    if (
      !sponsorId ||
      !formState.fullName.trim() ||
      !formState.email.trim() ||
      !formState.phone.trim() ||
      !formState.amount.trim()
    ) {
      setFormError(
        "Full name, email, phone, and donation amount are required.",
      );
      return;
    }

    const amount = Number(formState.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Please enter a valid donation amount.");
      return;
    }

    setIsSaving(true);
    setFormError("");

    try {
      const response = await apiRequest(
        "PATCH",
        `/sponsors/profile/${sponsorId}`,
        {
          profile: {
            fullName: formState.fullName.trim(),
            email: formState.email.trim(),
            phone: formState.phone.trim(),
            country: formState.country.trim(),
            city: formState.city.trim(),
            state: formState.state.trim(),
            region: formState.region.trim(),
            zipCode: formState.zipCode.trim(),
            bio: formState.bio.trim(),
          },
          location: {
            address: formState.address.trim(),
            country: formState.country.trim(),
            city: formState.city.trim(),
            state: formState.state.trim(),
            region: formState.region.trim(),
            zipCode: formState.zipCode.trim(),
          },
          donation: {
            amount,
            period: formState.period,
            expectedFundsDate: formState.expectedFundsDate || undefined,
            remindByEmail: formState.remindByEmail,
          },
          paymentMethod: formState.paymentMethod,
          childId: formState.childId || undefined,
          startDate: formState.startDate,
        },
      );

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || "Unable to save the sponsor profile.");
      }

      setProfile((current) =>
        current
          ? {
              ...current,
              sponsor: result.sponsor,
              profileStatus: result.profileStatus,
              profileCompletion: result.profileCompletion,
            }
          : current,
      );
      setIsEditOpen(false);
    } catch (error) {
      console.error("Error updating sponsor profile:", error);
      setFormError("Unable to save the sponsor profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchiveProfile = async () => {
    if (!sponsorId) return;

    setIsArchiving(true);
    setArchiveError("");
    try {
      await apiRequest("DELETE", `/sponsors/profile/${sponsorId}`);
      await queryClient.invalidateQueries({
        queryKey: ["sponsors", "profiles", "all"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["children", "profiles"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["dashboard", "summary"],
      });
      setIsArchiveDialogOpen(false);
      router.push("/dashboard/sponsorships");
    } catch (error) {
      console.error("Error archiving sponsor profile:", error);
      setArchiveError(
        "Unable to archive this sponsor profile. Please try again.",
      );
    } finally {
      setIsArchiving(false);
    }
  };

  const handleUnlinkChild = async () => {
    if (!unlinkTarget?.childId) return;

    setIsUnlinking(true);
    setUnlinkError("");

    try {
      await apiRequest(
        "PATCH",
        `/sponsors/child/${unlinkTarget.childId}/unlink`,
      );
      setProfile((current) =>
        current
          ? {
              ...current,
              children: current.children?.filter(
                (entry: any) =>
                  (entry.child?._id || entry.childId) !== unlinkTarget.childId,
              ),
            }
          : current,
      );
      await queryClient.invalidateQueries({
        queryKey: ["children", "profiles"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["sponsors", "profiles", "all"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["dashboard", "summary"],
      });
      setUnlinkTarget(null);
    } catch (error) {
      console.error("Error unlinking child sponsor:", error);
      setUnlinkError("Unable to unlink this child. Please try again.");
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleSponsorImageChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setImageError("Select a valid image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImageError("Sponsor images must be 5 MB or smaller.");
      return;
    }

    setIsUploadingImage(true);
    setImageError("");
    try {
      const upload = await uploadImageToCloudinary(file);
      const response = await apiRequest(
        "PATCH",
        `/sponsors/profile/${sponsorId}`,
        {
          image: {
            url: upload.secure_url,
            public_id: upload.public_id,
          },
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || "Unable to save sponsor image.");

      setProfile((current) =>
        current
          ? { ...current, sponsor: { ...current.sponsor, ...result.sponsor } }
          : current,
      );
      await queryClient.invalidateQueries({
        queryKey: ["sponsors", "profiles", "all"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["dashboard", "summary"],
      });
    } catch (error) {
      console.error("Error uploading sponsor image:", error);
      setImageError(
        error instanceof Error
          ? error.message
          : "Unable to upload sponsor image.",
      );
    } finally {
      setIsUploadingImage(false);
    }
  };

  const activeSponsoredChildren = sponsoredChildren.filter((entry: any) =>
    ["Active", "Pending"].includes(entry.status),
  );

  const openPaymentDialog = () => {
    setPaymentError("");
    setPaymentForm((current) => ({
      ...current,
      amount: "",
      date: new Date().toISOString().slice(0, 10),
      transactionId: createPaymentReference(),
      notes: "",
      splitDonation: activeSponsoredChildren.length > 1,
      allocationMode: "equal",
      selectedSponsorshipIds:
        activeSponsoredChildren.length > 1
          ? activeSponsoredChildren.map((entry: any) => String(entry._id))
          : [],
      customAmounts: {},
    }));
    setIsPaymentDialogOpen(true);
  };

  const togglePaymentChild = (sponsorshipId: string, checked: boolean) => {
    setPaymentForm((current) => ({
      ...current,
      selectedSponsorshipIds: checked
        ? current.splitDonation
          ? [...current.selectedSponsorshipIds, sponsorshipId]
          : [sponsorshipId]
        : current.selectedSponsorshipIds.filter((id) => id !== sponsorshipId),
    }));
  };

  const getPaymentAllocations = () => {
    const selected = activeSponsoredChildren.filter((entry: any) =>
      paymentForm.selectedSponsorshipIds.includes(String(entry._id)),
    );
    const total = Number(paymentForm.amount);

    if (
      paymentForm.allocationMode === "equal" &&
      selected.length > 0 &&
      Number.isFinite(total)
    ) {
      const base = Math.floor(total / selected.length);
      const remainder = total % selected.length;
      return selected.map((entry: any, index) => ({
        sponsorshipId: String(entry._id),
        childId: String(entry.child?._id || entry.childId),
        childName: entry.child?.firstName || entry.child?.name || "Child",
        amount: base + (index < remainder ? 1 : 0),
      }));
    }

    return selected.map((entry: any) => ({
      sponsorshipId: String(entry._id),
      childId: String(entry.child?._id || entry.childId),
      childName: entry.child?.firstName || entry.child?.name || "Child",
      amount: Number(paymentForm.customAmounts[String(entry._id)] || 0),
    }));
  };

  const handleRecordPayment = async () => {
    const allocations = getPaymentAllocations();
    const total = Number(paymentForm.amount);
    const allocatedTotal = allocations.reduce(
      (sum, allocation) => sum + allocation.amount,
      0,
    );

    if (!Number.isInteger(total) || total <= 0) {
      setPaymentError("Enter a positive whole-number donation amount.");
      return;
    }
    if (allocations.length === 0) {
      setPaymentError("Select at least one child.");
      return;
    }
    if (allocatedTotal !== total) {
      setPaymentError("Allocated amounts must equal the donation total.");
      return;
    }

    setIsRecordingPayment(true);
    setPaymentError("");
    try {
      const response = await apiRequest(
        "POST",
        `/sponsors/${sponsorId}/payments/split`,
        {
          amount: total,
          currency: paymentForm.currency,
          date: paymentForm.date,
          method: paymentForm.method,
          transactionId: paymentForm.transactionId.trim() || undefined,
          notes: paymentForm.notes.trim(),
          allocationMode: paymentForm.allocationMode,
          allocations: allocations.map(
            ({ sponsorshipId, childId, amount }) => ({
              sponsorshipId,
              childId,
              amount,
            }),
          ),
        },
      );
      const result = await response.json();
      const createdPayments = result.payments || [];

      setProfile((current) =>
        current
          ? {
              ...current,
              children: current.children?.map((entry: any) => {
                const created = createdPayments.find(
                  (payment: any) =>
                    String(payment.sponsorshipId) === String(entry._id),
                );
                if (!created) return entry;
                return {
                  ...entry,
                  totalPaid:
                    Number(entry.totalPaid || 0) + Number(created.amount || 0),
                  lastPayment: paymentForm.date,
                  payments: [...(entry.payments || []), created.payment].filter(
                    Boolean,
                  ),
                };
              }),
              summary: current.summary
                ? {
                    ...current.summary,
                    totalPaid: Number(current.summary.totalPaid || 0) + total,
                  }
                : current.summary,
            }
          : current,
      );
      await queryClient.invalidateQueries({
        queryKey: ["children", "profiles"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["sponsors", "profiles", "all"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["dashboard", "summary"],
      });
      const refreshedProfile = await apiRequest(
        "GET",
        `/sponsors/${sponsorId}`,
      );
      setProfile(await refreshedProfile.json());
      setIsPaymentDialogOpen(false);
    } catch (error) {
      console.error("Error recording donation:", error);
      setPaymentError(
        error instanceof Error ? error.message : "Unable to record donation.",
      );
    } finally {
      setIsRecordingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-8">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-72 w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-8">
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard/sponsorships")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2" size={16} /> Back to sponsorships
        </Button>
        <Card className="p-6">
          <h2 className="text-xl font-semibold">Sponsor profile not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The sponsor record could not be loaded.
          </p>
        </Card>
      </div>
    );
  }

  const sponsorName =
    sponsorProfile.fullName || sponsor.sponsor?.name || "Sponsor";
  const email =
    sponsorProfile.email || sponsor.sponsor?.email || "Not provided";
  const phone =
    sponsorProfile.phone || sponsor.sponsor?.phone || "Not provided";
  const location = sponsor.location || {};
  const cityState =
    [location.city, location.state, location.country]
      .filter(Boolean)
      .join(", ") || "Not provided";
  const totalPledged = Number(sponsor?.donation?.amount || 0);
  const totalPaid = Number(profile?.summary?.totalPaid || 0);
  const plegedFrequency = sponsor?.donation?.period || "Monthly";
  const lastPaymentDate = profile?.summary?.lastPaymentDate
    ? new Date(profile.summary.lastPaymentDate)
    : null;
  const nextPaymentDate = profile?.summary?.nextPaymentDate
    ? new Date(profile.summary.nextPaymentDate)
    : null;

  return (
    <div className="min-w-0 p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          onClick={() => router.push("/dashboard/sponsorships")}
          className="w-full bg-accent text-white hover:bg-accent/90 sm:w-auto"
        >
          <ArrowLeft className="mr-2" size={16} /> Back to sponsorships
        </Button>
        <Button
          className="w-full sm:w-auto"
          onClick={() => void exportSponsorProfilePdf()}
          disabled={isExportingProfile}
        >
          <Download className="mr-2 size-4" />
          {isExportingProfile ? "Preparing PDF..." : "Export profile"}
        </Button>
      </div>

      <div className="mt-2 grid min-w-0 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="relative h-full min-h-80">
            <img
              src={sponsor.image?.url || "/user.avif"}
              alt={sponsorName}
              className="h-full min-h-80 w-full object-cover"
            />
            <label
              title="Upload sponsor image"
              className="absolute bottom-4 right-4 inline-flex cursor-pointer items-center justify-center rounded-full bg-black/70 p-3 text-white transition hover:bg-black"
            >
              {isUploadingImage ? (
                <Loader2 className="size-5 animate-spin" />
              ) : (
                <Camera className="size-5" />
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={isUploadingImage}
                onChange={handleSponsorImageChange}
              />
            </label>
            {imageError ? (
              <p className="absolute bottom-1 left-3 right-3 rounded bg-black/75 px-2 py-1 text-xs text-red-200">
                {imageError}
              </p>
            ) : null}
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.3em] text-foreground/50">
                Sponsor profile
              </p>
              <h1 className="mt-2 break-words text-3xl font-bold text-foreground">
                {sponsorName}
              </h1>
              <p className="mt-2 text-sm text-foreground/70">{cityState}</p>
            </div>

            <div className="flex w-full flex-col gap-2 self-start sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              <Button variant="secondary" className="w-full sm:w-auto" onClick={openEditDialog}>
                Edit profile
              </Button>
              <Button
                variant="outline"
                className="w-full text-destructive hover:text-destructive sm:w-auto"
                onClick={() => setIsArchiveDialogOpen(true)}
              >
                <Archive className="mr-2 size-4" />
                Delete profile
              </Button>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(profile.profileStatus || sponsor.profileStatus)}`}
              >
                {profile.profileStatus || sponsor.profileStatus || "Incomplete"}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs uppercase tracking-wide text-foreground/60">
                Email
              </p>
              <p className="mt-1 break-all  text-sm font-semibold text-foreground">
                {email}
              </p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs uppercase tracking-wide text-foreground/60">
                Phone
              </p>
              <p className="mt-1 text-base font-semibold text-foreground">
                {phone}
              </p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs uppercase tracking-wide text-foreground/60">
                Children
              </p>
              <p className="mt-1 text-base font-semibold text-foreground">
                {sponsoredChildren.length}
              </p>
            </div>

            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs uppercase tracking-wide text-foreground/60">
                Payment method
              </p>
              <p className="mt-1 text-base font-semibold text-foreground">
                {sponsor.paymentMethod || "Not provided"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        <div className="rounded-xl border border-border bg-card p-2">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground/70 hover:bg-muted/80"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "overview" && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Users className="size-4 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">
                  Profile overview
                </h3>
              </div>
              <ul className="space-y-2 text-sm text-foreground/80">
                <li>
                  <span className="font-medium text-foreground">Name:</span>{" "}
                  {sponsorName}
                </li>
                <li>
                  <span className="font-medium text-foreground">Email:</span>{" "}
                  {email}
                </li>
                <li>
                  <span className="font-medium text-foreground">Phone:</span>{" "}
                  {phone}
                </li>
                <li>
                  <span className="font-medium text-foreground">Location:</span>{" "}
                  {cityState}
                </li>
                <li>
                  <span className="font-medium text-foreground">Bio:</span>{" "}
                  {sponsorProfile.bio || "Not provided"}
                </li>
              </ul>
              <div className="mt-4 flex items-center justify-between gap-4 border-t border-border pt-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Payment reminders by email
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {sponsor.donation?.remindByEmail === false
                      ? "Email reminders are off"
                      : "Email reminders are on"}
                  </p>
                </div>
                <Switch
                  checked={sponsor.donation?.remindByEmail !== false}
                  onCheckedChange={(enabled) =>
                    void handleReminderPreferenceChange(enabled)
                  }
                  disabled={isUpdatingReminderPreference}
                  aria-label="Send payment reminders by email"
                />
              </div>
              {reminderPreferenceError ? (
                <p role="alert" className="mt-2 text-sm text-destructive">
                  {reminderPreferenceError}
                </p>
              ) : null}
            </Card>

            <Card className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Wallet className="size-4 text-emerald-600" />
                <h3 className="text-lg font-semibold text-foreground">
                  Sponsorship summary
                </h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs uppercase tracking-wide text-foreground/60">
                    Total pledged
                  </p>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    ${totalPledged}-{plegedFrequency}
                  </p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs uppercase tracking-wide text-foreground/60">
                    Total paid
                  </p>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    ${totalPaid}
                  </p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs uppercase tracking-wide text-foreground/60">
                    Last payment
                  </p>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    {lastPaymentDate ? lastPaymentDate.toLocaleDateString() : "No payment yet"}
                  </p>
                </div>
                <div className="rounded-lg bg-muted p-3">
                  <p className="text-xs uppercase tracking-wide text-foreground/60">
                    Next expected funds
                  </p>
                  <p className="mt-2 text-xl font-semibold text-foreground">
                    {nextPaymentDate ? nextPaymentDate.toLocaleDateString() : "Not scheduled"}
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === "children" && (
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <Users className="size-4 text-primary" />
              <h3 className="text-lg font-semibold text-foreground">
                Children this sponsor is supporting
              </h3>
            </div>

            {sponsoredChildren.length > 0 ? (
              <div className="space-y-3">
                {sponsoredChildren.map((entry: any, index: number) => {
                  const child = entry.child || {};
                  const childId = child._id || entry.childId;
                  const childName =
                    child.firstName || child.name || "Unnamed child";
                  const amount = Number(entry.child.monthlyNeed ?? 0);
                  const status = entry.status || "Active";
                  const childImg = child?.image?.url;

                  return (
                    <div
                      key={childId || `${childName}-${index}`}
                      onClick={() =>
                        childId && router.push(`/dashboard/children/${childId}`)
                      }
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          if (childId)
                            router.push(`/dashboard/children/${childId}`);
                        }
                      }}
                      className="w-full cursor-pointer rounded-lg border border-border bg-muted/40 p-4 text-left transition hover:bg-muted/60"
                    >
                      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-center justify-center gap-2 cursor-pointer">
                          <img
                            src={childImg}
                            alt={childName}
                            className="size-16 rounded-full object-cover"
                          />
                          <span className="min-w-0">
                            <p className="break-words font-semibold text-accent">
                              {childName}
                            </p>
                            <p className="text-sm text-blue-600 underline">
                              View child profile
                            </p>
                          </span>
                        </div>
                        <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center">
                          <span
                            className={`inline-flex justify-center rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(status)}`}
                          >
                            {status}
                          </span>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              setUnlinkError("");
                              setUnlinkTarget({ childId, childName });
                            }}
                          >
                            <Unlink className="mr-1 size-4" />
                            Unlink
                          </Button>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-md bg-background p-3">
                          <p className="text-xs uppercase tracking-wide text-foreground/60">
                            Amount
                          </p>
                          <p className="mt-2 font-semibold text-foreground">
                            ${amount}
                          </p>
                        </div>
                        <div className="rounded-md bg-background p-3">
                          <p className="text-xs uppercase tracking-wide text-foreground/60">
                            Paid
                          </p>
                          <p className="mt-2 font-semibold text-foreground">
                            ${Number(entry.totalPaid || 0)}
                          </p>
                        </div>
                        <div className="rounded-md bg-background p-3">
                          <p className="text-xs uppercase tracking-wide text-foreground/60">
                            Last payment
                          </p>
                          <p className="mt-2 font-semibold text-foreground">
                            {entry.lastPayment
                              ? new Date(entry.lastPayment).toLocaleDateString()
                              : "No payment"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-background p-4 text-sm text-foreground/70">
                No children are currently assigned to this sponsor.
              </div>
            )}
          </Card>
        )}

        {activeTab === "donations" && (
          <Card className="p-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="size-4 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">
                  Sponsor's Donation History
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={exportRows.length === 0}
                    >
                      <Download className="mr-2 size-4" />
                      Export
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportPaymentsCsv}>
                      Export as CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportPaymentsPdf}>
                      Export as PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="default"
                  onClick={openPaymentDialog}
                  disabled={activeSponsoredChildren.length === 0}
                >
                  <Wallet className="mr-2 size-4" />
                  Record donation
                </Button>
              </div>
            </div>

            {paymentHistory.length > 0 ? (
              <>
              <div className="hidden max-w-full overflow-x-auto md:block">
                <table className="min-w-[680px] w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-foreground/70">
                      <th className="pb-2 pr-4">Date</th>
                      <th className="pb-2 pr-4">Child</th>
                      <th className="pb-2 pr-4">Amount</th>
                      <th className="pb-2 pr-4">Method</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">Transaction ID</th>
                      <th className="pb-2 pr-4">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paymentHistory.map((payment: any, index: number) => {
                      const child = payment.child || {};
                      return (
                        <tr
                          key={`${payment._id || payment.transactionId || "payment"}-${index}`}
                          className="border-b border-border last:border-0"
                        >
                          <td className="py-3 pr-4">
                            {payment.date
                              ? new Date(payment.date).toLocaleDateString()
                              : "Not provided"}
                          </td>
                          <td className="py-3 pr-4">
                            {child.firstName ||
                              child.name ||
                              payment.childName ||
                              "—"}
                          </td>
                          <td className="py-3 pr-4">
                            ${Number(payment.amount || 0)}
                          </td>
                          <td className="py-3 pr-4">
                            {payment.method || payment.paymentMethod || "—"}
                          </td>
                          <td className="py-3 pr-4">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${getStatusBadgeClass(payment.status)}`}
                            >
                              {payment.status || "Completed"}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            {payment.transactionId || "—"}
                          </td>
                          <td className="py-3 pr-4">{payment.notes || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 md:hidden">
                {paymentHistory.map((payment: any, index: number) => {
                  const child = payment.child || {};
                  return (
                    <article
                      key={`${payment._id || payment.transactionId || "payment"}-mobile-${index}`}
                      className="rounded-lg border border-border bg-muted/30 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Child
                          </p>
                          <p className="break-words font-semibold text-foreground">
                            {child.firstName || child.name || payment.childName || "No child"}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${getStatusBadgeClass(payment.status)}`}
                        >
                          {payment.status || "Completed"}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Date</p>
                          <p className="mt-1 text-foreground/80">
                            {payment.date
                              ? new Date(payment.date).toLocaleDateString()
                              : "Not provided"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Amount</p>
                          <p className="mt-1 font-semibold text-foreground">
                            ${Number(payment.amount || 0)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Method</p>
                          <p className="mt-1 break-words text-foreground/80">
                            {payment.method || payment.paymentMethod || "Not provided"}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Transaction ID</p>
                          <p className="mt-1 break-all text-foreground/80">
                            {payment.transactionId || "Not provided"}
                          </p>
                        </div>
                      </div>
                      {payment.notes ? (
                        <div className="mt-3 border-t border-border pt-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Note</p>
                          <p className="mt-1 break-words text-sm text-foreground/80">
                            {payment.notes}
                          </p>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-background p-4 text-sm text-foreground/70">
                No payment history is available for this sponsor yet.
              </div>
            )}
          </Card>
        )}
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit sponsor profile</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2 md:grid-cols-2">
            {[
              ["fullName", "Full name"],
              ["email", "Email"],
              ["phone", "Phone"],
              ["country", "Country"],
              ["city", "City"],
              ["state", "State"],
              ["region", "Region"],
              ["zipCode", "Zip code"],
            ].map(([field, label]) => (
              <div className="space-y-2" key={field}>
                <Label htmlFor={`editSponsor${field}`}>{label}</Label>
                <Input
                  id={`editSponsor${field}`}
                  type={field === "email" ? "email" : "text"}
                  value={String(
                    formState[field as keyof typeof formState] ?? "",
                  )}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      [field]: event.target.value,
                    }))
                  }
                />
              </div>
            ))}

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="editSponsorAddress">Address</Label>
              <Input
                id="editSponsorAddress"
                value={formState.address}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    address: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editSponsorPaymentMethod">Payment method</Label>
              <Select
                value={formState.paymentMethod}
                onValueChange={(value) =>
                  setFormState((current) => ({
                    ...current,
                    paymentMethod: value,
                  }))
                }
              >
                <SelectTrigger id="editSponsorPaymentMethod" className="w-full">
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

            <div className="space-y-2">
              <Label htmlFor="editSponsorAmount">Amount</Label>
              <Input
                id="editSponsorAmount"
                type="number"
                value={formState.amount}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editSponsorPeriod">Period</Label>
              <Select
                value={formState.period}
                onValueChange={(value) =>
                  setFormState((current) => ({ ...current, period: value }))
                }
              >
                <SelectTrigger id="editSponsorPeriod" className="w-full">
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

            <div className="space-y-2">
              <Label htmlFor="editSponsorExpectedFundsDate">
                Expected funds date
              </Label>
              <Input
                id="editSponsorExpectedFundsDate"
                type="date"
                value={formState.expectedFundsDate}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    expectedFundsDate: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editSponsorStartDate">Start date</Label>
              <Input
                id="editSponsorStartDate"
                type="date"
                value={formState.startDate}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    startDate: event.target.value,
                  }))
                }
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="editSponsorChild">Link to child</Label>
              <Select
                value={formState.childId}
                onValueChange={(value) =>
                  setFormState((current) => ({ ...current, childId: value }))
                }
              >
                <SelectTrigger id="editSponsorChild" className="w-full">
                  <SelectValue placeholder="Select a child (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {childrenOptions.map((child) => (
                    <SelectItem key={child._id} value={child._id}>
                      {child.firstName} {child.secondName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-md border border-border p-3 md:col-span-2">
              <Label htmlFor="editRemindByEmail">
                Send payment reminders by email
              </Label>
              <Switch
                id="editRemindByEmail"
                checked={formState.remindByEmail}
                onCheckedChange={(enabled) =>
                  setFormState((current) => ({
                    ...current,
                    remindByEmail: enabled,
                  }))
                }
                disabled={isSaving}
                aria-label="Send payment reminders by email"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="editSponsorBio">Bio</Label>
              <textarea
                id="editSponsorBio"
                value={formState.bio}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    bio: event.target.value,
                  }))
                }
                className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            {formError ? (
              <p className="text-sm text-red-500 md:col-span-2">{formError}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveProfile} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isPaymentDialogOpen}
        onOpenChange={(open) => {
          if (!isRecordingPayment) setIsPaymentDialogOpen(open);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record donation</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {paymentError ? (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {paymentError}
              </p>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="donationAmount">Total amount</Label>
                <Input
                  id="donationAmount"
                  type="number"
                  min="1"
                  step="1"
                  value={paymentForm.amount}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                  placeholder="e.g. 150000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="donationCurrency">Currency</Label>
                <Input
                  id="donationCurrency"
                  value={paymentForm.currency}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      currency: event.target.value.toUpperCase(),
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="donationDate">Date received</Label>
                <Input
                  id="donationDate"
                  type="date"
                  value={paymentForm.date}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      date: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="donationMethod">Payment method</Label>
                <Select
                  value={paymentForm.method}
                  onValueChange={(value) =>
                    setPaymentForm((current) => ({ ...current, method: value }))
                  }
                >
                  <SelectTrigger id="donationMethod">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[
                      "Cash",
                      "Bank Transfer",
                      "Mobile Money",
                      "Check",
                      "Other",
                    ].map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="font-medium text-foreground">Split donation</p>
                <p className="text-sm text-muted-foreground">
                  Allocate this donation across linked children.
                </p>
              </div>
              <Switch
                checked={paymentForm.splitDonation}
                onCheckedChange={(checked) => {
                  setPaymentForm((current) => ({
                    ...current,
                    splitDonation: checked,
                    selectedSponsorshipIds: checked
                      ? activeSponsoredChildren.map((entry: any) =>
                          String(entry._id),
                        )
                      : current.selectedSponsorshipIds.slice(0, 1),
                  }));
                }}
                aria-label="Split donation across children"
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">
                {paymentForm.splitDonation
                  ? "Children receiving this donation"
                  : "Child receiving this donation"}
              </p>
              {activeSponsoredChildren.map((entry: any) => {
                const entryId = String(entry._id);
                const childName =
                  entry.child?.firstName ||
                  entry.child?.name ||
                  "Unnamed child";
                const selected =
                  paymentForm.selectedSponsorshipIds.includes(entryId);
                return (
                  <div
                    key={entryId}
                    className="rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selected}
                        disabled={
                          !paymentForm.splitDonation &&
                          paymentForm.selectedSponsorshipIds.length > 0 &&
                          !selected
                        }
                        onCheckedChange={(checked) =>
                          togglePaymentChild(entryId, checked === true)
                        }
                        aria-label={`Select ${childName}`}
                      />
                      <div className="flex-1">
                        <p className="font-medium text-foreground">
                          {childName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Paid so far:{" "}
                          {Number(entry.totalPaid || 0).toLocaleString()} UGX
                        </p>
                      </div>
                      {selected && paymentForm.allocationMode === "custom" ? (
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          className="w-36"
                          value={paymentForm.customAmounts[entryId] || ""}
                          onChange={(event) =>
                            setPaymentForm((current) => ({
                              ...current,
                              customAmounts: {
                                ...current.customAmounts,
                                [entryId]: event.target.value,
                              },
                            }))
                          }
                          placeholder="Amount"
                        />
                      ) : selected ? (
                        <span className="text-sm font-semibold text-foreground">
                          {getPaymentAllocations()
                            .find(
                              (allocation) =>
                                allocation.sponsorshipId === entryId,
                            )
                            ?.amount.toLocaleString() || "0"}{" "}
                          {paymentForm.currency}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant={
                  paymentForm.allocationMode === "equal" ? "default" : "outline"
                }
                onClick={() =>
                  setPaymentForm((current) => ({
                    ...current,
                    allocationMode: "equal",
                  }))
                }
              >
                Split equally
              </Button>
              <Button
                type="button"
                variant={
                  paymentForm.allocationMode === "custom"
                    ? "default"
                    : "outline"
                }
                onClick={() => {
                  const equalAmounts = getPaymentAllocations().reduce<
                    Record<string, string>
                  >(
                    (amounts, allocation) => ({
                      ...amounts,
                      [allocation.sponsorshipId]: String(allocation.amount),
                    }),
                    {},
                  );
                  setPaymentForm((current) => ({
                    ...current,
                    allocationMode: "custom",
                    customAmounts: {
                      ...equalAmounts,
                      ...current.customAmounts,
                    },
                  }));
                }}
              >
                Custom amounts
              </Button>
              <p className="text-sm text-muted-foreground">
                Selected: {paymentForm.selectedSponsorshipIds.length} of{" "}
                {activeSponsoredChildren.length} children
                <span className="mx-2">·</span>
                Allocated:{" "}
                {getPaymentAllocations()
                  .reduce((sum, allocation) => sum + allocation.amount, 0)
                  .toLocaleString()}{" "}
                / {Number(paymentForm.amount || 0).toLocaleString()}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="donationReference">Reference</Label>
                <Input
                  id="donationReference"
                  value={paymentForm.transactionId}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      transactionId: event.target.value,
                    }))
                  }
                  placeholder="Optional receipt/reference"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="donationNotes">Notes</Label>
                <Input
                  id="donationNotes"
                  value={paymentForm.notes}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  placeholder="Optional notes"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPaymentDialogOpen(false)}
              disabled={isRecordingPayment}
            >
              Cancel
            </Button>
            <Button onClick={handleRecordPayment} disabled={isRecordingPayment}>
              {isRecordingPayment ? "Recording..." : "Record donation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(unlinkTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setUnlinkTarget(null);
            setUnlinkError("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Unlink {unlinkTarget?.childName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the child&apos;s active sponsorship and make the
              child available again. Sponsorship and payment history will be
              preserved.
            </AlertDialogDescription>
            {unlinkError ? (
              <p className="text-sm text-destructive">{unlinkError}</p>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUnlinking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleUnlinkChild();
              }}
              disabled={isUnlinking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isUnlinking ? "Unlinking..." : "Unlink child"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={isArchiveDialogOpen}
        onOpenChange={setIsArchiveDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sponsor profile?</AlertDialogTitle>
            <AlertDialogDescription>
              This will release the sponsor&apos;s active children and hide the
              profile from active lists. Sponsorship and payment history will be
              preserved.
            </AlertDialogDescription>
            {archiveError ? (
              <p className="text-sm text-destructive">{archiveError}</p>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleArchiveProfile();
              }}
              disabled={isArchiving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isArchiving ? "Deleting..." : "Delete profile"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
