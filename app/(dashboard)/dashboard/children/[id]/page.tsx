"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/query-client";
import { uploadImageToCloudinary } from "@/lib/cloudinary-upload";
import { toast } from "@/hooks/use-toast";
import { ServerError } from "@/components/ui/server-error";
import { jsPDF } from "jspdf";
import type {
  SponsorRecord,
  SponsorshipProfile,
  SponsorshipRecord,
} from "@/lib/types";
import {
  calculateAgeFromDateOfBirth,
  toDateInputValue,
} from "@/lib/child-profile-form";
import {
  ArrowLeft,
  Download,
  Link2,
  Search,
  Trash2,
  Unlink,
  Upload,
  X,
} from "lucide-react";

interface SponsorOption {
  _id: string;
  name: string;
  email: string;
  phone: string;
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

function formatList(value: any) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(", ") || "Not provided";
  }

  if (typeof value === "string") {
    return value.trim() || "Not provided";
  }

  return value || "Not provided";
}

async function loadPdfImage(url: string) {
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

  const format = blob.type.includes("png") ? "PNG" : "JPEG";
  return { dataUrl, format, ...dimensions };
}

function getStatusBadgeClass(status?: string) {
  switch (status) {
    case "Available":
      return "bg-emerald-100 text-emerald-800";
    case "Sponsored":
      return "bg-sky-100 text-sky-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
}

export default function ChildDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const childId = typeof params?.id === "string" ? params.id : "";

  const [profile, setProfile] = useState<SponsorshipProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "education" | "family" | "sponsor" | "history" | "documents"
  >("overview");
  const [history, setHistory] = useState<SponsorshipRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [pageError, setPageError] = useState("");
  const [formState, setFormState] = useState<any>(null);
  const [isUnlinkDialogOpen, setIsUnlinkDialogOpen] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [unlinkError, setUnlinkError] = useState("");
  const [unlinkSponsorshipId, setUnlinkSponsorshipId] = useState("");
  const [sponsorOptions, setSponsorOptions] = useState<SponsorOption[]>([]);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [selectedSponsorId, setSelectedSponsorId] = useState("");
  const [sponsorshipStartDate, setSponsorshipStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [isLinkingSponsor, setIsLinkingSponsor] = useState(false);
  const [linkSponsorError, setLinkSponsorError] = useState("");
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [reportPreview, setReportPreview] = useState("");
  const [reportTitle, setReportTitle] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [reportError, setReportError] = useState("");
  const [isUploadingReport, setIsUploadingReport] = useState(false);
  const [deletingReportId, setDeletingReportId] = useState("");
  const [downloadingReportId, setDownloadingReportId] = useState("");
  const [isExportingProfile, setIsExportingProfile] = useState(false);
  const [isExportingHistory, setIsExportingHistory] = useState(false);

  useEffect(() => {
    if (!childId) return;

    let isMounted = true;

    const fetchProfile = async () => {
      setLoading(true);

      try {
        const response = await apiRequest(
          "GET",
          `/children/profile/${childId}`,
        );
        const data = await response.json();

        if (isMounted) {
          setProfile(data);
        }
      } catch (error) {
        console.error("Error fetching child profile:", error);
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

    return () => {
      isMounted = false;
    };
  }, [childId]);

  useEffect(() => {
    if (!childId) {
      setHistory([]);
      return;
    }

    let isMounted = true;

    const fetchHistory = async () => {
      setHistoryLoading(true);

      try {
        const response = await apiRequest("GET", `/sponsors/child/${childId}`);
        const data = await response.json();

        if (isMounted) {
          setHistory(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Error loading child sponsorship history:", error);
        if (isMounted) {
          setHistory([]);
        }
      } finally {
        if (isMounted) {
          setHistoryLoading(false);
        }
      }
    };

    fetchHistory();

    return () => {
      isMounted = false;
    };
  }, [childId]);

  useEffect(() => {
    let isMounted = true;

    const fetchSponsors = async () => {
      try {
        const response = await apiRequest("GET", "/sponsors/profiles/all");
        if (!response.ok) throw new Error("Unable to load sponsors.");
        const records: SponsorRecord[] = await response.json();
        const seen = new Set<string>();
        const options = (Array.isArray(records) ? records : [])
          .map((record) => {
            const sponsor =
              record?.profile || record?.sponsor || record?.donor?.sponsor || {};
            return {
              _id: String(record?._id || record?.donor?._id || ""),
              name: sponsor.fullName || sponsor.name || "",
              email: sponsor.email || "",
              phone: sponsor.phone || "",
            };
          })
          .filter((option) => {
            const key = `${option.email}-${option.phone}-${option.name}`;
            if (!option._id || seen.has(key)) return false;
            seen.add(key);
            return true;
          });

        if (isMounted) setSponsorOptions(options);
      } catch (error) {
        console.error("Error loading sponsors:", error);
      }
    };

    fetchSponsors();
    return () => {
      isMounted = false;
    };
  }, []);

  const tabs = [
    { key: "overview", label: "Overview" },
    { key: "education", label: "Education" },
    { key: "family", label: "Family" },
    { key: "sponsor", label: "Sponsor details" },
    { key: "history", label: "Sponsorship history" },
    { key: "documents", label: "Documents" },
  ] as const;

  const openEditDialog = () => {
    if (!profile) return;

    setFormState({
      firstName: profile.firstName || "",
      secondName: profile.secondName || "",
      givenName: profile.givenName || "",
      gender: profile.gender || "Female",
      dateOfBirth: toDateInputValue(profile.dateOfBirth),
      age:
        calculateAgeFromDateOfBirth(toDateInputValue(profile.dateOfBirth)) ??
        profile.age ??
        0,
      class: profile.class || "",
      nationality: profile.nationality || "",
      familyStatus: profile.familyStatus || "Single Parent",
      numberOfParents: profile.numberOfParents || 1,
      guardianName: profile.guardianName || "",
      guardianContact: profile.guardianContact || "",
      guardianRelation: profile.guardianRelation || "caretaker",
      background: profile.background || "",
      school: profile.school || "",
      location: profile.location || "",
      needsInput: Array.isArray(profile.needs)
        ? profile.needs.join(", ")
        : typeof profile.needs === "string"
          ? profile.needs
          : "",
      monthlyNeed: String(profile.monthlyNeed ?? ""),
      sponsorshipStatus: profile.sponsorshipStatus || "Available",
      education: {
        currentLevel: profile.education?.currentLevel || "",
        currentClass: profile.education?.currentClass || "",
        schoolName: profile.education?.schoolName || profile.school || "",
        academicYear: profile.education?.academicYear || "",
        lastTermResult: profile.education?.lastTermResult || "",
        graduationTarget: profile.education?.graduationTarget || "",
        estimatedGraduationYear:
          profile.education?.expectedGraduationYear ||
          profile.education?.estimatedGraduationYear ||
          "",
        educationNotes: profile.education?.educationNotes || "",
      },
    });
    setFormError("");
    setIsEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!profile || !formState) return;

    setIsSaving(true);
    setFormError("");
    setPageError("");

    try {
      const payload = {
        firstName: formState.firstName.trim(),
        secondName: formState.secondName.trim(),
        givenName: formState.givenName.trim() || formState.firstName.trim(),
        gender: formState.gender,
        dateOfBirth: formState.dateOfBirth,
        age: Number(formState.age) || 0,
        class: formState.class,
        nationality: formState.nationality,
        familyStatus: formState.familyStatus,
        numberOfParents: Number(formState.numberOfParents) || 1,
        guardianName: formState.guardianName.trim(),
        guardianContact: formState.guardianContact.trim(),
        guardianRelation: formState.guardianRelation,
        image: profile.image || { url: "", public_id: "" },
        background: formState.background.trim(),
        school: formState.school.trim(),
        location: formState.location.trim(),
        needs: formState.needsInput
          .split(",")
          .map((item: string) => item.trim())
          .filter(Boolean),
        monthlyNeed: formState.monthlyNeed,
        education: {
          ...profile.education,
          ...formState.education,
          schoolName: formState.education.schoolName || formState.school.trim(),
        },
        reportCards: profile.reportCards || [],
      };

      const res = await apiRequest(
        "PUT",
        `/children/profile/${profile._id}/update`,
        payload,
      );
      if (!res.ok) throw new Error("Unable to save the profile.");
      const data = await res.json();
      setProfile((current) => ({
        ...(current || profile),
        ...data.profile,
        _id: profile._id,
      }));
      await queryClient.invalidateQueries({
        queryKey: ["dashboard", "summary"],
      });
      setIsEditOpen(false);
      toast({ title: "Child profile updated", description: "The child profile was updated successfully." });
    } catch (error) {
      console.error("Error saving child profile:", error);
      setFormError("Unable to save the profile. Please try again.");
      setPageError(
        error instanceof Error ? error.message : "Unable to save the profile.",
      );
      toast({ variant: "destructive", title: "Unable to save child profile", description: "Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  const resetReportDialog = () => {
    setReportFile(null);
    setReportPreview("");
    setReportTitle("");
    setReportError("");
  };

  const handleReportFileChange = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setReportError("Select an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setReportError("Report card images must be 5 MB or smaller.");
      return;
    }

    setReportError("");
    setReportFile(file);
    setReportPreview(URL.createObjectURL(file));
  };

  const handleUploadReportCard = async () => {
    if (!childId || !reportFile) {
      setReportError("Select an image first.");
      return;
    }
    if (!reportTitle.trim()) {
      setReportError("Enter a title for this report card.");
      return;
    }

    setIsUploadingReport(true);
    setReportError("");
    setPageError("");
    try {
      const upload = await uploadImageToCloudinary(reportFile);
      const response = await apiRequest(
        "POST",
        `/children/profile/${childId}/report-cards`,
        {
          name: reportTitle.trim(),
          url: upload.secure_url,
          public_id: upload.public_id,
          fileType: reportFile.type,
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || "Unable to save report card.");

      setProfile((current) =>
        current ? { ...current, ...result.profile } : current,
      );
      await queryClient.invalidateQueries({
        queryKey: ["dashboard", "summary"],
      });
      setIsReportDialogOpen(false);
      resetReportDialog();
      toast({ title: "Report card uploaded", description: "The report card was uploaded successfully." });
    } catch (error) {
      console.error("Error uploading report card:", error);
      setReportError(
        error instanceof Error
          ? error.message
          : "Unable to upload report card.",
      );
      setPageError(
        error instanceof Error ? error.message : "Unable to upload report card.",
      );
      toast({ variant: "destructive", title: "Unable to upload report card", description: "Please try again." });
    } finally {
      setIsUploadingReport(false);
    }
  };

  const handleDeleteReportCard = async (reportCard: any) => {
    if (!childId || !reportCard?._id) return;
    if (!window.confirm(`Delete ${reportCard.name || "this report card"}?`))
      return;

    setDeletingReportId(reportCard._id);
    setPageError("");
    try {
      const response = await apiRequest(
        "DELETE",
        `/children/profile/${childId}/report-cards/${reportCard._id}`,
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.message || "Unable to delete report card.");
      setProfile((current) =>
        current ? { ...current, ...result.profile } : current,
      );
      await queryClient.invalidateQueries({
        queryKey: ["dashboard", "summary"],
      });
      toast({ title: "Report card deleted", description: "The report card was deleted successfully." });
    } catch (error) {
      setReportError(
        error instanceof Error
          ? error.message
          : "Unable to delete report card.",
      );
      setPageError(
        error instanceof Error ? error.message : "Unable to delete report card.",
      );
      toast({ variant: "destructive", title: "Unable to delete report card", description: "Please try again." });
    } finally {
      setDeletingReportId("");
    }
  };

  const handleDownloadReportPdf = async (reportCard: any) => {
    if (!reportCard?.url) return;

    setDownloadingReportId(
      reportCard._id || reportCard.public_id || reportCard.url,
    );
    try {
      const response = await fetch(reportCard.url);
      if (!response.ok) throw new Error("Unable to download report image.");

      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result));
        reader.onerror = () =>
          reject(new Error("Unable to prepare report PDF."));
        reader.readAsDataURL(blob);
      });

      const image = new Image();
      image.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Unable to read report image."));
      });

      const pdf = new jsPDF({
        orientation: image.width > image.height ? "landscape" : "portrait",
        unit: "mm",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const scale = Math.min(
        (pageWidth - margin * 2) / image.width,
        (pageHeight - margin * 2) / image.height,
      );
      const imageWidth = image.width * scale;
      const imageHeight = image.height * scale;
      pdf.addImage(
        dataUrl,
        "JPEG",
        (pageWidth - imageWidth) / 2,
        (pageHeight - imageHeight) / 2,
        imageWidth,
        imageHeight,
      );
      pdf.save(
        `${String(reportCard.name || "report-card").replace(/[^a-z0-9-_]+/gi, "-")}.pdf`,
      );
    } catch (error) {
      setReportError(
        error instanceof Error
          ? error.message
          : "Unable to download report PDF.",
      );
    } finally {
      setDownloadingReportId("");
    }
  };

  const filteredReportCards = (profile?.reportCards || []).filter((card: any) =>
    String(card.name || "")
      .toLowerCase()
      .includes(reportSearch.toLowerCase()),
  );

  const handleUnlinkSponsor = async () => {
    if (!childId || !unlinkSponsorshipId) return;

    setIsUnlinking(true);
    setUnlinkError("");
    setPageError("");

    try {
      const response = await apiRequest(
        "PATCH",
        `/sponsors/child/${childId}/unlink`,
        { sponsorshipId: unlinkSponsorshipId },
      );
      if (!response.ok) throw new Error("Unable to unlink this sponsor.");
      const data = await response.json();

      setProfile((current) =>
        current
          ? {
              ...current,
              ...data.child,
            }
          : current,
      );
      await queryClient.invalidateQueries({
        queryKey: ["dashboard", "summary"],
      });
      setHistory((current) =>
        current.map((record) =>
          record._id === unlinkSponsorshipId
            ? { ...record, status: "Cancelled" }
            : record,
        ),
      );
      setUnlinkSponsorshipId("");
      setIsUnlinkDialogOpen(false);
      toast({ title: "Sponsorship cancelled", description: "This sponsor-child relationship was cancelled." });
    } catch (error) {
      console.error("Error unlinking sponsor:", error);
      setUnlinkError("Unable to unlink this sponsor. Please try again.");
      setPageError(
        error instanceof Error ? error.message : "Unable to unlink this sponsor.",
      );
      toast({ variant: "destructive", title: "Unable to unlink sponsor", description: "Please try again." });
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleLinkSponsor = async () => {
    if (!profile) return;

    const selectedSponsor = sponsorOptions.find(
      (option: any) => option._id === selectedSponsorId,
    );
    if (!selectedSponsor) {
      setLinkSponsorError("Please select a sponsor.");
      return;
    }

    setIsLinkingSponsor(true);
    setLinkSponsorError("");
    try {
      const response = await apiRequest("PATCH", "/sponsors/reassign", {
        childId: profile._id,
        child: profile._id,
        sponsorId: selectedSponsor._id,
        sponsor: {
          name: selectedSponsor.name,
          email: selectedSponsor.email,
          phone: selectedSponsor.phone,
        },
        location: { address: profile.location || "" },
        donation: {
          amount:
            Number(String(profile.monthlyNeed || "").replace(/[^0-9.]/g, "")) || 0,
          period: "Monthly",
          remindByEmail: true,
        },
        startDate: sponsorshipStartDate,
        status: "Active",
      });
      if (!response.ok) throw new Error("Failed to link sponsor.");

      setProfile((current) =>
        current
          ? {
              ...current,
              sponsorshipStatus: "Sponsored",
            }
          : current,
      );
      const historyResponse = await apiRequest(
        "GET",
        `/sponsors/child/${profile._id}`,
      );
      const sponsorshipHistory = await historyResponse.json();
      setHistory(Array.isArray(sponsorshipHistory) ? sponsorshipHistory : []);
      await queryClient.invalidateQueries({ queryKey: ["children", "profiles"] });
      await queryClient.invalidateQueries({ queryKey: ["sponsors", "profiles", "all"] });
      setIsLinkDialogOpen(false);
      setSelectedSponsorId("");
      toast({ title: "Sponsor linked", description: "The sponsor was linked to this child successfully." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to link sponsor.";
      setLinkSponsorError(message);
      toast({ variant: "destructive", title: "Unable to link sponsor", description: message });
    } finally {
      setIsLinkingSponsor(false);
    }
  };

  const activeSponsorships = history.filter((record) =>
    ["Active", "Pending"].includes(record.status),
  );
  const sponsorProfile = activeSponsorships[0]?.donor || null;
  const education = profile?.education || {};
  const reportCards = profile?.reportCards || [];
  const needsList = Array.isArray(profile?.needs)
    ? profile.needs
    : typeof profile?.needs === "string"
      ? profile.needs
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

  const exportChildProfilePdf = async () => {
    if (!profile) return;

    setIsExportingProfile(true);

    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 16;
      const contentWidth = pageWidth - margin * 2;
      const footerY = pageHeight - 10;
      const usableBottom = pageHeight - 18;
      const colors = {
        ink: [28, 36, 33] as [number, number, number],
        muted: [102, 112, 107] as [number, number, number],
        accent: [47, 112, 94] as [number, number, number],
        pale: [241, 245, 242] as [number, number, number],
        line: [218, 225, 220] as [number, number, number],
      };
      const displayValue = (item: unknown) => {
        const text = String(item ?? "").trim();
        return text || "Not provided";
      };
      const fullName = displayValue(
        [profile.firstName, profile.secondName, profile.givenName]
          .filter(Boolean)
          .join(" "),
      );
      const sponsorName = sponsorProfile?.profile?.fullName || sponsorProfile?.sponsor?.name;
      let cursor = margin;

      const setText = (color = colors.ink) => pdf.setTextColor(...color);
      const addFooter = () => {
        pdf.setDrawColor(...colors.line);
        pdf.setLineWidth(0.2);
        pdf.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
        setText(colors.muted);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.text("Confidential child profile", margin, footerY);
        pdf.text(`Page ${pdf.getNumberOfPages()}`, pageWidth - margin, footerY, {
          align: "right",
        });
      };
      const startPage = (title?: string) => {
        if (pdf.getNumberOfPages() > 0) addFooter();
        pdf.addPage();
        cursor = margin;
        if (title) {
          setText(colors.ink);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(18);
          pdf.text(title, margin, cursor + 4);
          cursor += 14;
        }
      };
      const ensureSpace = (height: number, title = "Child Profile") => {
        if (cursor + height > usableBottom) startPage(title);
      };
      const addSection = (title: string) => {
        ensureSpace(17, title);
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
      const addRow = (label: string, item: unknown, width = contentWidth) => {
        const text = displayValue(item);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        const lines = pdf.splitTextToSize(text, width - 42);
        ensureSpace(Math.max(9, lines.length * 4 + 6));
        setText(colors.muted);
        pdf.setFont("helvetica", "bold");
        pdf.text(label.toUpperCase(), margin, cursor);
        setText(colors.ink);
        pdf.setFont("helvetica", "normal");
        pdf.text(lines, margin + 42, cursor);
        cursor += Math.max(9, lines.length * 4 + 4);
      };
      const addTwoColumnRows = (rows: Array<[string, unknown]>) => {
        for (let index = 0; index < rows.length; index += 2) {
          ensureSpace(11);
          const columnWidth = contentWidth / 2 - 5;
          const draw = (row: [string, unknown], x: number) => {
            const [label, item] = row;
            setText(colors.muted);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(7.5);
            pdf.text(label.toUpperCase(), x, cursor);
            setText(colors.ink);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(9);
            pdf.text(pdf.splitTextToSize(displayValue(item), columnWidth), x, cursor + 5);
          };
          draw(rows[index], margin);
          if (rows[index + 1]) draw(rows[index + 1], margin + contentWidth / 2 + 5);
          cursor += 14;
        }
      };
      const addParagraph = (label: string, item: unknown) => {
        const lines = pdf.splitTextToSize(displayValue(item), contentWidth);
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
      const addImageFrame = async (
        url: string | undefined,
        x: number,
        y: number,
        width: number,
        height: number,
      ) => {
        pdf.setFillColor(...colors.pale);
        pdf.roundedRect(x, y, width, height, 2, 2, "F");
        if (!url) {
          setText(colors.muted);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          pdf.text("Image not available", x + width / 2, y + height / 2, {
            align: "center",
          });
          return;
        }
        const image = await loadPdfImage(url);
        const scale = Math.min(width / image.width, height / image.height);
        const imageWidth = image.width * scale;
        const imageHeight = image.height * scale;
        pdf.addImage(
          image.dataUrl,
          image.format,
          x + (width - imageWidth) / 2,
          y + (height - imageHeight) / 2,
          imageWidth,
          imageHeight,
        );
      };

      pdf.deletePage(1);
      startPage();
      const logo = await loadPdfImage("/dark-logo.jpeg");
      const logoSize = 9;
      const logoScale = Math.min(logoSize / logo.width, logoSize / logo.height);
      const logoWidth = logo.width * logoScale;
      const logoHeight = logo.height * logoScale;
      pdf.addImage(
        logo.dataUrl,
        logo.format,
        margin,
        cursor - 5,
        logoWidth,
        logoHeight,
      );
      setText(colors.accent);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text("ENSIGO OF LOVE FOUNDATION", margin + logoSize + 3, cursor);
      setText(colors.muted);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text(new Date().toLocaleDateString(), pageWidth - margin, cursor, {
        align: "right",
      });
      cursor += 12;
      setText(colors.ink);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(24);
      pdf.text("PROFILE & BIO", margin, cursor);
      cursor += 8;
      setText(colors.muted);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text("A detailed child profile for care, education, and sponsorship planning.", margin, cursor);
      cursor += 10;

      const imageTop = cursor;
      const imageWidth = 62;
      const imageHeight = 68;
      await addImageFrame(profile.image?.url, margin, imageTop, imageWidth, imageHeight);
      const detailsX = margin + imageWidth + 12;
      const detailsWidth = contentWidth - imageWidth - 12;
      const summaryRows: Array<[string, unknown]> = [
        ["Name", fullName],
        ["Gender", profile.gender],
        ["Age", profile.age],
        ["Date of birth", formatDisplayDate(profile.dateOfBirth)],
        ["Nationality", profile.nationality],
        ["Location", profile.location],
      ];
      summaryRows.forEach(([label, item]) => {
        setText(colors.muted);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.text(label.toUpperCase(), detailsX, cursor);
        setText(colors.ink);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.text(pdf.splitTextToSize(displayValue(item), detailsWidth), detailsX, cursor + 5);
        cursor += 10;
      });
      cursor = imageTop + imageHeight + 10;
      addParagraph("Biography", profile.background);
      addParagraph("Current needs", needsList.join(", "));

      addSection("Family");
      addTwoColumnRows([
        ["Family status", profile.familyStatus],
        ["Number of parents", profile.numberOfParents],
        ["Guardian", profile.guardianName],
        ["Relationship", profile.guardianRelation],
        ["Contact", profile.guardianContact],
      ]);

      addSection("Education");
      addTwoColumnRows([
        ["Is studying", education.isStudying === undefined ? "Not provided" : education.isStudying ? "Yes" : "No"],
        ["Education stage", education.educationStage || education.currentLevel],
        ["School", education.schoolName || profile.school],
        ["Class / grade", education.classGrade || education.currentClass || profile.class],
        [
          "Expected graduation year",
          education.expectedGraduationYear || education.estimatedGraduationYear,
        ],
        ...(education.educationStage === "vocational" || education.educationStage === "university"
          ? ([
              ["Course start date", education.enrollmentDate ? formatDisplayDate(education.enrollmentDate) : "Not provided"],
              ["Course / program", education.courseName],
              [
                "Course duration",
                education.courseDurationValue
                  ? `${education.courseDurationValue} ${education.courseDurationUnit || "months"}`
                  : "Not provided",
              ],
            ] as Array<[string, unknown]>)
          : []),
      ]);

      addSection("Sponsor Details");
      addTwoColumnRows([
        ["Sponsorship status", profile.sponsorshipStatus],
        ["Sponsor", sponsorName],
        ["Monthly need", profile.monthlyNeed],
        ["Sponsorship records", history.length],
      ]);
      if (history.length) {
        history.forEach((record: any) => {
          addRow(
            "Plan",
            `${displayValue(record.status)} | ${displayValue(record.amount)} | ${displayValue(record.frequency)}`,
          );
          (record.payments || []).forEach((payment: any) => {
            addRow(
              "Payment",
              `${formatDisplayDate(payment.date)} | ${displayValue(payment.amount)} ${displayValue(payment.currency || "UGX")} | ${displayValue(payment.method)}`,
            );
          });
        });
      } else {
        addParagraph("Payment history", "No sponsorship history available.");
      }
      addFooter();

      if (reportCards.length === 0) {
        startPage("REPORT CARDS");
        setText(colors.muted);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.text("No report cards have been uploaded for this child.", margin, cursor);
      } else {
        for (const card of reportCards) {
          startPage("REPORT CARDS");
          setText(colors.ink);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(13);
          pdf.text(displayValue(card.name), margin, cursor);
          cursor += 6;
          setText(colors.muted);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
          pdf.text(
            `Uploaded ${card.uploadedAt ? formatDisplayDate(card.uploadedAt) : "date not provided"}`,
            margin,
            cursor,
          );
          cursor += 8;
          if (String(card.fileType || "").toLowerCase().includes("pdf")) {
            pdf.setFontSize(10);
            pdf.text("This report card is available as a separate PDF document in the dashboard.", margin, cursor);
          } else {
            await addImageFrame(card.url, margin, cursor, contentWidth, pageHeight - cursor - 28);
          }
        }
      }
      addFooter();
      pdf.save(`child-profile-${profile._id}.pdf`);
    } catch (error) {
      setReportError(
        error instanceof Error ? error.message : "Unable to export child profile PDF.",
      );
    } finally {
      setIsExportingProfile(false);
    }
  };

  const exportSponsorshipHistoryPdf = async () => {
    if (!profile) return;

    setIsExportingHistory(true);

    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 16;
      const contentWidth = pageWidth - margin * 2;
      const footerY = pageHeight - 10;
      const usableBottom = pageHeight - 18;
      const colors = {
        ink: [28, 36, 33] as [number, number, number],
        muted: [102, 112, 107] as [number, number, number],
        accent: [47, 112, 94] as [number, number, number],
        pale: [241, 245, 242] as [number, number, number],
        line: [218, 225, 220] as [number, number, number],
      };
      const displayValue = (value: unknown) => {
        const text = String(value ?? "").trim();
        return text || "Not provided";
      };
      const fullName = [profile.firstName, profile.secondName, profile.givenName]
        .filter(Boolean)
        .join(" ");
      const setText = (color: [number, number, number]) => pdf.setTextColor(...color);
      let cursor = margin;

      const addFooter = () => {
        pdf.setDrawColor(...colors.line);
        pdf.setLineWidth(0.2);
        pdf.line(margin, footerY - 4, pageWidth - margin, footerY - 4);
        setText(colors.muted);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(7.5);
        pdf.text("Confidential sponsorship history", margin, footerY);
        pdf.text(`Page ${pdf.getNumberOfPages()}`, pageWidth - margin, footerY, {
          align: "right",
        });
      };
      const startPage = () => {
        if (pdf.getNumberOfPages() > 0) addFooter();
        pdf.addPage();
        cursor = margin;
      };
      const ensureSpace = (height: number) => {
        if (cursor + height > usableBottom) startPage();
      };
      const addSection = (title: string) => {
        ensureSpace(17);
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
      const addRow = (label: string, value: unknown) => {
        const lines = pdf.splitTextToSize(displayValue(value), contentWidth - 48);
        ensureSpace(Math.max(9, lines.length * 4 + 6));
        setText(colors.muted);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.text(label.toUpperCase(), margin, cursor);
        setText(colors.ink);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.text(lines, margin + 48, cursor);
        cursor += Math.max(9, lines.length * 4 + 4);
      };
      const addTwoColumnRows = (rows: Array<[string, unknown]>) => {
        for (let index = 0; index < rows.length; index += 2) {
          ensureSpace(13);
          const columnWidth = contentWidth / 2 - 5;
          rows.slice(index, index + 2).forEach(([label, value], offset) => {
            const x = margin + offset * (contentWidth / 2 + 5);
            setText(colors.muted);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(7.5);
            pdf.text(label.toUpperCase(), x, cursor);
            setText(colors.ink);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(9);
            pdf.text(pdf.splitTextToSize(displayValue(value), columnWidth), x, cursor + 5);
          });
          cursor += 14;
        }
      };
      const addPaymentTable = (payments: Array<{ payment: any; sponsor: string }>) => {
        const columns: Array<[string, number]> = [
          ["Date", 25],
          ["Sponsor", 38],
          ["Amount", 30],
          ["Method", 25],
          ["Status", 25],
          ["Reference", 35],
        ];
        const drawHeader = () => {
          pdf.setFillColor(...colors.accent);
          pdf.rect(margin, cursor - 4, contentWidth, 8, "F");
          let x = margin;
          setText([255, 255, 255]);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(7);
          columns.forEach(([label, width]) => {
            pdf.text(label.toUpperCase(), x + 2, cursor + 1);
            x += width;
          });
          cursor += 9;
        };

        drawHeader();
        payments.forEach(({ payment, sponsor }, index) => {
          const values = [
            formatDisplayDate(payment.date),
            sponsor,
            `${displayValue(payment.amount)} ${displayValue(payment.currency || "UGX")}`,
            payment.method,
            payment.status || "Completed",
            payment.transactionId || "No reference",
          ];
          const lines = values.map((value, columnIndex) =>
            pdf.splitTextToSize(displayValue(value), columns[columnIndex][1] - 4),
          );
          const rowHeight = Math.max(10, ...lines.map((row) => row.length * 3.5 + 5));

          if (cursor + rowHeight > usableBottom) {
            startPage();
            addSection("Payment ledger (continued)");
            drawHeader();
          }

          if (index % 2 === 0) {
            pdf.setFillColor(...colors.pale);
            pdf.rect(margin, cursor - 4, contentWidth, rowHeight, "F");
          }
          let x = margin;
          setText(colors.ink);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(7.5);
          lines.forEach((cellLines, columnIndex) => {
            pdf.text(cellLines, x + 2, cursor + 1);
            x += columns[columnIndex][1];
          });
          cursor += rowHeight;
        });
      };
      const donorName = (record: any) => {
        const donor = record.donor || {};
        return donor.profile?.fullName || donor.sponsor?.name || donor.name || "Unknown sponsor";
      };
      const allPayments = history.flatMap((record: any) =>
        Array.isArray(record.payments)
          ? record.payments.map((payment: any) => ({ payment, sponsor: donorName(record) }))
          : [],
      );
      const totalPayments = allPayments.reduce(
        (total: number, { payment }: { payment: any }) => total + Number(payment.amount || 0),
        0,
      );

      const logo = await loadPdfImage("/dark-logo.jpeg");
      const logoSize = 9;
      const logoScale = Math.min(logoSize / logo.width, logoSize / logo.height);
      pdf.addImage(
        logo.dataUrl,
        logo.format,
        margin,
        cursor - 5,
        logo.width * logoScale,
        logo.height * logoScale,
      );
      setText(colors.accent);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text("ENSIGO OF LOVE FOUNDATION", margin + logoSize + 3, cursor);
      setText(colors.muted);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text(formatDisplayDate(new Date()), pageWidth - margin, cursor, { align: "right" });
      cursor += 16;
      setText(colors.ink);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.text("SPONSORSHIP HISTORY", margin, cursor);
      cursor += 8;
      setText(colors.muted);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text("A complete record of sponsorship activity and payments.", margin, cursor);
      cursor += 12;

      addSection("Child profile");
      addTwoColumnRows([
        ["Child", fullName],
        ["Child ID", profile._id],
        ["Sponsorship status", profile.sponsorshipStatus],
        ["Number of sponsorships", history.length],
      ]);

      addSection("Sponsorship records");
      if (history.length === 0) {
        addRow("History", "No sponsorship history is available for this child.");
      } else {
        history.forEach((record: any, index: number) => {
          const donor = record.donor || {};
          const amount = Number(record.amount ?? donor.donation?.amount ?? 0);
          ensureSpace(38);
          pdf.setFillColor(...colors.pale);
          pdf.roundedRect(margin, cursor - 4, contentWidth, 30, 2, 2, "F");
          setText(colors.ink);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10);
          pdf.text(`${index + 1}. ${donorName(record)}`, margin + 5, cursor + 2);
          setText(colors.muted);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8.5);
          pdf.text(`Status: ${displayValue(record.status || "Pending")}`, margin + 5, cursor + 8);
          pdf.text(`Frequency: ${displayValue(record.frequency || donor.donation?.period || "Monthly")}`, margin + 5, cursor + 14);
          pdf.text(`Started: ${formatDisplayDate(record.startDate)}`, margin + 5, cursor + 20);
          pdf.text(`Amount: ${amount.toLocaleString()} ${displayValue(record.currency || "USD")}`, pageWidth - margin - 5, cursor + 8, { align: "right" });
          pdf.text(`Payments: ${Array.isArray(record.payments) ? record.payments.length : 0}`, pageWidth - margin - 5, cursor + 14, { align: "right" });
          cursor += 36;
        });
      }

      addSection("Payment ledger");
      if (allPayments.length === 0) {
        addRow("Payments", "No payment records are available.");
      } else {
        addPaymentTable(allPayments);
      }
      addSection("Summary");
      addTwoColumnRows([
        ["Sponsorship records", history.length],
        ["Payment records", allPayments.length],
        ["Total recorded payments", `${totalPayments.toLocaleString()} UGX`],
        ["Report generated", formatDisplayDate(new Date())],
      ]);
      addFooter();
      pdf.save(`sponsorship-history-${profile._id}.pdf`);
    } catch (error) {
      console.error("Error exporting sponsorship history:", error);
      toast({
        variant: "destructive",
        title: "Unable to export sponsorship history",
        description: "Please try again.",
      });
    } finally {
      setIsExportingHistory(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-8">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-72 w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
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
          onClick={() => router.back()}
          className="mb-6"
        >
          <ArrowLeft className="mr-2" size={16} /> Back
        </Button>
        <Card className="p-6">
          <h2 className="text-xl font-semibold">Child not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The child profile could not be loaded.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8">
      <Button
        onClick={() => router.push("/dashboard/children")}
        className="mb-6 bg-accent text-white hover:bg-accent/90"
      >
        <ArrowLeft className="mr-2" size={16} /> Back to children
      </Button>
      <Button
        className="absolute top-18 right-8"
        onClick={() => void exportChildProfilePdf()}
        disabled={isExportingProfile}
      >
        <Download className="mr-2 size-4" />
        {isExportingProfile ? "Preparing PDF..." : "Export profile"}
      </Button>

      <div className="mt-2 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <img
            src={profile.image?.url || "/no-staff.avif"}
            alt={profile.firstName || "Child profile"}
            className="h-full min-h-80 w-full object-cover"
          />
        </div>

        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-foreground/50">
                Child profile
              </p>
              <h1 className="mt-2 text-3xl font-bold text-foreground">
                {profile.firstName} {profile.secondName}
              </h1>
              <p className="mt-2 text-sm text-foreground/70">
                {profile.school} • {profile.location}
              </p>
            </div>

            <div className="flex items-center gap-2 self-start">
              <Button variant="secondary" onClick={openEditDialog}>
                Edit profile
              </Button>
              <span
                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(profile.sponsorshipStatus)}`}
              >
                {profile.sponsorshipStatus}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs uppercase tracking-wide text-foreground/60">
                Age
              </p>
              <p className="mt-1 text-base font-semibold text-foreground">
                {profile.age}
              </p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs uppercase tracking-wide text-foreground/60">
                Class
              </p>
              <p className="mt-1 text-base font-semibold text-foreground">
                {profile.class}
              </p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs uppercase tracking-wide text-foreground/60">
                Gender
              </p>
              <p className="mt-1 text-base font-semibold text-foreground">
                {profile.gender}
              </p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-xs uppercase tracking-wide text-foreground/60">
                Sponsor
              </p>
              <p className="mt-1 text-base font-semibold text-foreground">
                {activeSponsorships.length > 0
                  ? `${activeSponsorships.length} current ${activeSponsorships.length === 1 ? "sponsor" : "sponsors"}`
                  : "No current sponsors"}
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
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-lg font-semibold text-foreground">
                Background
              </h3>
              <p className="text-sm leading-6 text-foreground/80">
                {formatList(profile.background)}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-lg font-semibold text-foreground">
                Support needs
              </h3>
              <ul className="space-y-2 text-sm text-foreground/80">
                {needsList.length > 0 ? (
                  needsList.map((need, idx) => (
                    <li key={`${need}-${idx}`}>• {need}</li>
                  ))
                ) : (
                  <li>No needs provided yet.</li>
                )}
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-lg font-semibold text-foreground">
                Family & school
              </h3>
              <ul className="space-y-2 text-sm text-foreground/80">
                <li>
                  <span className="font-medium text-foreground">
                    Family status:
                  </span>{" "}
                  {profile.familyStatus}
                </li>
                <li>
                  <span className="font-medium text-foreground">
                    Number of parents:
                  </span>{" "}
                  {profile.numberOfParents}
                </li>
                <li>
                  <span className="font-medium text-foreground">
                    Nationality:
                  </span>{" "}
                  {profile.nationality}
                </li>
                <li>
                  <span className="font-medium text-foreground">
                    Monthly need:
                  </span>{" "}
                  {profile.monthlyNeed || "Not provided"}
                </li>
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-lg font-semibold text-foreground">
                Other details
              </h3>
              <ul className="space-y-2 text-sm text-foreground/80">
                <li>
                  <span className="font-medium text-foreground">
                    Date of birth:
                  </span>{" "}
                  {formatDisplayDate(profile.dateOfBirth)}
                </li>
                <li>
                  <span className="font-medium text-foreground">
                    Age group:
                  </span>{" "}
                  {profile.ageGroup}
                </li>
                <li>
                  <span className="font-medium text-foreground">
                    Given name:
                  </span>{" "}
                  {profile.givenName || "Not provided"}
                </li>
                <li>
                  <span className="font-medium text-foreground">
                    Preferred name:
                  </span>{" "}
                  {profile.name || "Not provided"}
                </li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === "education" && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            <h3 className="text-lg font-semibold text-foreground">
              Education details
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg bg-muted p-4">
                <p className="text-xs uppercase tracking-wide text-foreground/60">
                  Is studying
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {education.isStudying === undefined
                    ? "Not provided"
                    : education.isStudying
                      ? "Yes"
                      : "No"}
                </p>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <p className="text-xs uppercase tracking-wide text-foreground/60">
                  Education stage
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {education.educationStage || "Not provided"}
                </p>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <p className="text-xs uppercase tracking-wide text-foreground/60">
                  Name of school
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {education.schoolName || profile.school || "Not provided"}
                </p>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <p className="text-xs uppercase tracking-wide text-foreground/60">
                  Class / grade
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {education.classGrade || education.currentClass || "Not provided"}
                </p>
              </div>
              <div className="rounded-lg bg-muted p-4">
                <p className="text-xs uppercase tracking-wide text-foreground/60">
                  Expected graduation year
                </p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {education.expectedGraduationYear ||
                    education.estimatedGraduationYear ||
                    "Not provided"}
                </p>
              </div>
              {education.educationStage === "vocational" ||
              education.educationStage === "university" ? (
                <>
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-xs uppercase tracking-wide text-foreground/60">
                      Course start date
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {education.enrollmentDate
                        ? formatDisplayDate(education.enrollmentDate)
                        : "Not provided"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-xs uppercase tracking-wide text-foreground/60">
                      Course / program
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {education.courseName || "Not provided"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-xs uppercase tracking-wide text-foreground/60">
                      Course duration
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {education.courseDurationValue
                        ? `${education.courseDurationValue} ${education.courseDurationUnit || "months"}`
                        : "Not provided"}
                    </p>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}

        {activeTab === "family" && (
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-lg font-semibold text-foreground">
                Guardian information
              </h3>
              <p className="text-sm leading-6 text-foreground/80">
                {profile.guardianName || "Not provided"}
                <br />
                {profile.guardianContact || "Contact not provided"}
                <br />
                {profile.guardianRelation || "Relationship not provided"}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-3 text-lg font-semibold text-foreground">
                Family details
              </h3>
              <ul className="space-y-2 text-sm text-foreground/80">
                <li>
                  <span className="font-medium text-foreground">
                    Family status:
                  </span>{" "}
                  {profile.familyStatus}
                </li>
                <li>
                  <span className="font-medium text-foreground">
                    Number of parents:
                  </span>{" "}
                  {profile.numberOfParents}
                </li>
                <li>
                  <span className="font-medium text-foreground">
                    Nationality:
                  </span>{" "}
                  {profile.nationality}
                </li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === "sponsor" && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-lg font-semibold text-foreground">
              Sponsorship details
            </h3>
            {activeSponsorships.length > 0 ? (
              <div className="mb-4 grid gap-3 md:grid-cols-2">
                {activeSponsorships.map((record: any) => {
                  const donor = record.donor || {};
                  const name =
                    donor.profile?.fullName ||
                    donor.sponsor?.name ||
                    donor.name ||
                    "Unknown sponsor";
                  return (
                    <div
                      key={record._id}
                      className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-muted p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">
                          {name}
                        </p>
                        <p className="text-sm text-foreground/70">
                          {record.status} · ${Number(record.amount || 0)}{" "}
                          {record.frequency || "Monthly"}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setUnlinkError("");
                          setUnlinkSponsorshipId(record._id);
                          setIsUnlinkDialogOpen(true);
                        }}
                      >
                        <Unlink className="mr-2 size-4" />
                        Cancel
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mb-4 rounded-lg border border-dashed border-border bg-background p-4 text-sm text-foreground/70">
                No current sponsors are linked to this child.
              </p>
            )}
            <Button
              onClick={() => {
                setLinkSponsorError("");
                setSelectedSponsorId("");
                setSponsorshipStartDate(new Date().toISOString().slice(0, 10));
                setIsLinkDialogOpen(true);
              }}
              disabled={sponsorOptions.length === 0}
            >
              <Link2 className="size-4" />
              Link another sponsor
            </Button>
          </div>
        )}

        <Dialog
          open={isLinkDialogOpen}
          onOpenChange={(open) => {
            setIsLinkDialogOpen(open);
            if (!open) setLinkSponsorError("");
          }}
        >
          <DialogContent className="max-w-lg bg-card">
            <DialogHeader>
              <DialogTitle>
                Link sponsor to {profile.firstName} {profile.secondName}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              {linkSponsorError ? (
                <div className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {linkSponsorError}
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="detailSponsor">Choose an existing sponsor</Label>
                <Select value={selectedSponsorId} onValueChange={setSelectedSponsorId}>
                  <SelectTrigger id="detailSponsor" className="bg-background">
                    <SelectValue placeholder="Select a sponsor" />
                  </SelectTrigger>
                  <SelectContent>
                    {sponsorOptions.map((option: any) => (
                      <SelectItem key={option._id} value={option._id}>
                        {option.name} ({option.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="detailSponsorshipStartDate">Start date</Label>
                <Input
                  id="detailSponsorshipStartDate"
                  type="date"
                  className="bg-background"
                  value={sponsorshipStartDate}
                  onChange={(event) => setSponsorshipStartDate(event.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsLinkDialogOpen(false)} disabled={isLinkingSponsor}>
                  Cancel
                </Button>
                <Button onClick={handleLinkSponsor} disabled={isLinkingSponsor}>
                  {isLinkingSponsor ? "Linking..." : "Link sponsor"}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={isUnlinkDialogOpen}
          onOpenChange={(open) => {
            setIsUnlinkDialogOpen(open);
            if (!open) setUnlinkError("");
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Unlink sponsor from this child?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This sponsorship will be cancelled and its history preserved.
                Any other active sponsors for this child will remain linked.
              </AlertDialogDescription>
              {unlinkError ? (
                <p className="text-sm text-destructive">{unlinkError}</p>
              ) : null}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isUnlinking}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  event.preventDefault();
                  void handleUnlinkSponsor();
                }}
                disabled={isUnlinking}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isUnlinking ? "Unlinking..." : "Unlink sponsor"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {activeTab === "history" && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                Sponsorship history
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void exportSponsorshipHistoryPdf()}
                disabled={isExportingHistory || historyLoading}
              >
                <Download className="mr-2 size-4" />
                {isExportingHistory ? "Exporting..." : "Export PDF"}
              </Button>
            </div>
            {historyLoading ? (
              <div className="space-y-3">
                <div className="h-12 animate-pulse rounded-lg bg-muted" />
                <div className="h-12 animate-pulse rounded-lg bg-muted" />
              </div>
            ) : history.length > 0 ? (
              <div className="space-y-3">
                {history.map((record: any, index: number) => {
                  const donor = record.donor || {};
                  const sponsorName =
                    donor.profile?.fullName ||
                    donor.sponsor?.name ||
                    donor.name ||
                    "Unknown sponsor";
                  const amount = Number(
                    record.amount ?? donor.donation?.amount ?? 0,
                  );
                  const status = record.status || "Pending";
                  const startDate = record.startDate
                    ? new Date(record.startDate).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : "Not provided";

                  return (
                    <div
                      key={record._id || `${sponsorName}-${index}`}
                      className="rounded-lg border border-border bg-muted/40 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold text-foreground">
                            {sponsorName}
                          </p>
                          <p className="text-sm text-foreground/70">
                            {record.frequency ||
                              donor.donation?.period ||
                              "Monthly"}{" "}
                            sponsorship
                          </p>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(status)}`}
                        >
                          {status}
                        </span>
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
                            Started
                          </p>
                          <p className="mt-2 font-semibold text-foreground">
                            {startDate}
                          </p>
                        </div>
                        <div className="rounded-md bg-background p-3">
                          <p className="text-xs uppercase tracking-wide text-foreground/60">
                            Payments
                          </p>
                          <p className="mt-2 font-semibold text-foreground">
                            {Array.isArray(record.payments)
                              ? record.payments.length
                              : 0}
                          </p>
                        </div>
                      </div>
                      {Array.isArray(record.payments) &&
                      record.payments.length > 0 ? (
                        <div className="mt-4 border-t border-border pt-4">
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground/60">
                            Payment records
                          </p>
                          <div className="space-y-2">
                            {record.payments.map(
                              (payment: any, paymentIndex: number) => (
                                <div
                                  key={
                                    payment._id ||
                                    `${payment.transactionId || "payment"}-${paymentIndex}`
                                  }
                                  className="grid gap-3 rounded-md bg-background p-3 text-sm sm:grid-cols-2 lg:grid-cols-5"
                                >
                                  <span className="break-words">
                                    {payment.date
                                      ? formatDisplayDate(payment.date)
                                      : "Not provided"}
                                  </span>
                                  <span className="break-words">
                                    {Number(
                                      payment.amount || 0,
                                    ).toLocaleString()}{" "}
                                    {payment.currency || "UGX"}
                                  </span>
                                  <span>
                                    {payment.method || "Not provided"}
                                  </span>
                                  <span>
                                    {payment.transactionId || "No reference"}
                                  </span>
                                  <span className="font-medium">
                                    {payment.status || "Completed"}
                                  </span>
                                  {payment.paymentGroupId ? (
                                    <span className="text-xs text-foreground/60 sm:col-span-5">
                                      Donation group: {payment.paymentGroupId}
                                    </span>
                                  ) : null}
                                  {payment.notes ? (
                                    <span className="text-xs text-foreground/60 sm:col-span-5">
                                      {payment.notes}
                                    </span>
                                  ) : null}
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-background p-4 text-sm text-foreground/70">
                No sponsorship history is available yet for this child.
              </div>
            )}
          </div>
        )}

        {activeTab === "documents" && (
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Child&apos;s report cards
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upload and manage academic reports.
                </p>
              </div>
              <Button
                onClick={() => {
                  resetReportDialog();
                  setIsReportDialogOpen(true);
                }}
              >
                <Upload className="mr-2 size-4" /> Upload report card
              </Button>
            </div>

            {reportCards.length > 0 ? (
              <>
                <div className="relative mb-5 max-w-md">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="bg-background pl-9 text-muted-foreground"
                    value={reportSearch}
                    onChange={(event) => setReportSearch(event.target.value)}
                    placeholder="Search reports by name..."
                  />
                </div>
                {filteredReportCards.length > 0 ? (
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredReportCards.map((card: any, index: number) => (
                      <article
                        key={
                          card._id || card.public_id || `${card.name}-${index}`
                        }
                        className="group relative aspect-4/3 overflow-hidden rounded-xl border border-border bg-muted shadow-sm"
                      >
                        <img
                          src={card.url}
                          alt={card.name || "Report card"}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-black/80 p-3 text-white">
                          <p className="truncate font-semibold">
                            {card.name || "Report card"}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={
                                downloadingReportId ===
                                (card._id || card.public_id || card.url)
                              }
                              onClick={() => void handleDownloadReportPdf(card)}
                              className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                            >
                              <Download className="mr-1 size-3" />
                              {downloadingReportId ===
                              (card._id || card.public_id || card.url)
                                ? "Preparing..."
                                : "PDF"}
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={
                                !card._id || deletingReportId === card._id
                              }
                              onClick={() => handleDeleteReportCard(card)}
                            >
                              <Trash2 className="mr-1 size-3" />
                              {deletingReportId === card._id
                                ? "Deleting..."
                                : "Delete"}
                            </Button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border bg-background p-6 text-sm text-muted-foreground">
                    No report cards match your search.
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-background p-4 text-sm text-foreground/70">
                No report cards have been uploaded for this child yet.
              </div>
            )}
            {reportError ? (
              <p className="mt-4 text-sm text-destructive">{reportError}</p>
            ) : null}
          </div>
        )}
      </div>

      <Dialog
        open={isReportDialogOpen}
        onOpenChange={(open) => {
          if (!isUploadingReport) {
            setIsReportDialogOpen(open);
            if (!open) resetReportDialog();
          }
        }}
      >
        <DialogContent preventDismiss className="bg-card">
          <DialogHeader>
            <DialogTitle>Upload report card</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {reportError ? (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {reportError}
              </p>
            ) : null}
            <div className="flex min-h-52 items-center justify-center overflow-hidden rounded-lg border border-dashed border-border bg-muted">
              {reportPreview ? (
                <img
                  src={reportPreview}
                  alt="Selected report preview"
                  className="max-h-64 w-full object-contain"
                />
              ) : (
                <label className="cursor-pointer p-8 text-center text-sm text-muted-foreground">
                  <Upload className="mx-auto mb-2 size-8" />
                  Select a report image
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(event) =>
                      handleReportFileChange(event.target.files?.[0])
                    }
                  />
                </label>
              )}
            </div>
            <div className="flex gap-2">
              <label className="inline-flex cursor-pointer items-center rounded-md border border-border px-3 py-2 text-sm hover:bg-muted">
                <Upload className="mr-2 size-4" />
                {reportPreview ? "Change image" : "Choose image"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) =>
                    handleReportFileChange(event.target.files?.[0])
                  }
                />
              </label>
              {reportPreview ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setReportFile(null);
                    setReportPreview("");
                  }}
                >
                  <X className="mr-2 size-4" /> Clear
                </Button>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="reportTitle">Report title</Label>
              <Input
                className="bg-background text-muted-foreground"
                id="reportTitle"
                value={reportTitle}
                onChange={(event) => setReportTitle(event.target.value)}
                placeholder="3rd Term Report"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsReportDialogOpen(false)}
              disabled={isUploadingReport}
            >
              Cancel
            </Button>
            <Button
              className="bg-accent text-white"
              onClick={handleUploadReportCard}
              disabled={isUploadingReport || !reportFile}
            >
              {isUploadingReport ? "Uploading..." : "Upload report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent
          preventDismiss
          className="max-h-[90vh] bg-card overflow-y-auto max-w-3xl"
        >
          <DialogHeader>
            <DialogTitle>Edit child profile</DialogTitle>
          </DialogHeader>

          {formState && (
            <div className="space-y-5 py-2">
              {formError ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    className="bg-background text-muted-foreground"
                    id="firstName"
                    value={formState.firstName}
                    onChange={(event) =>
                      setFormState({
                        ...formState,
                        firstName: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondName">Second name</Label>
                  <Input
                    className="bg-background text-muted-foreground"
                    id="secondName"
                    value={formState.secondName}
                    onChange={(event) =>
                      setFormState({
                        ...formState,
                        secondName: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="givenName">Preferred name</Label>
                  <Input
                    className="bg-background text-muted-foreground"
                    id="givenName"
                    value={formState.givenName}
                    onChange={(event) =>
                      setFormState({
                        ...formState,
                        givenName: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Input
                    className="bg-background text-muted-foreground"
                    id="gender"
                    value={formState.gender}
                    onChange={(event) =>
                      setFormState({ ...formState, gender: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of birth</Label>
                  <Input
                    className="bg-background text-muted-foreground"
                    id="dateOfBirth"
                    type="date"
                    value={formState.dateOfBirth}
                    onChange={(event) => {
                      const dateOfBirth = event.target.value;
                      setFormState({
                        ...formState,
                        dateOfBirth,
                        age: calculateAgeFromDateOfBirth(dateOfBirth) ?? 0,
                      });
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="age">Age</Label>
                  <Input
                    className="bg-background text-muted-foreground"
                    id="age"
                    type="number"
                    value={formState.age}
                    onChange={(event) =>
                      setFormState({
                        ...formState,
                        age: Number(event.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="class">Class</Label>
                  <Input
                    className="bg-background text-muted-foreground"
                    id="class"
                    value={formState.class}
                    onChange={(event) =>
                      setFormState({ ...formState, class: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="school">School</Label>
                  <Input
                    className="bg-background text-muted-foreground"
                    id="school"
                    value={formState.school}
                    onChange={(event) =>
                      setFormState({ ...formState, school: event.target.value })
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="location">Location</Label>
                  <Input
                    className="bg-background text-muted-foreground"
                    id="location"
                    value={formState.location}
                    onChange={(event) =>
                      setFormState({
                        ...formState,
                        location: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="background">Background</Label>
                  <Textarea
                    className="bg-background text-muted-foreground"
                    id="background"
                    value={formState.background}
                    onChange={(event) =>
                      setFormState({
                        ...formState,
                        background: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="needsInput">Needs</Label>
                  <Input
                    className="bg-background text-muted-foreground"
                    id="needsInput"
                    value={formState.needsInput}
                    onChange={(event) =>
                      setFormState({
                        ...formState,
                        needsInput: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthlyNeed">Monthly need</Label>
                  <Input
                    className="bg-background text-muted-foreground"
                    id="monthlyNeed"
                    value={formState.monthlyNeed}
                    onChange={(event) =>
                      setFormState({
                        ...formState,
                        monthlyNeed: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guardianName">Guardian name</Label>
                  <Input
                    className="bg-background text-muted-foreground"
                    id="guardianName"
                    value={formState.guardianName}
                    onChange={(event) =>
                      setFormState({
                        ...formState,
                        guardianName: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guardianContact">Guardian contact</Label>
                  <Input
                    className="bg-background text-muted-foreground"
                    id="guardianContact"
                    value={formState.guardianContact}
                    onChange={(event) =>
                      setFormState({
                        ...formState,
                        guardianContact: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guardianRelation">Guardian relation</Label>
                  <Input
                    className="bg-background text-muted-foreground"
                    id="guardianRelation"
                    value={formState.guardianRelation}
                    onChange={(event) =>
                      setFormState({
                        ...formState,
                        guardianRelation: event.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sponsorshipStatus">Sponsorship status</Label>
                  <Input
                    className="bg-background text-muted-foreground"
                    id="sponsorshipStatus"
                    readOnly
                    value={formState.sponsorshipStatus}
                  />
                  <p className="text-xs text-muted-foreground">
                    Calculated from current sponsorship relationships.
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              className="bg-accent text-white"
              onClick={handleEditSave}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ServerError message={pageError} />
    </div>
  );
}
