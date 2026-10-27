"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Upload,
  X,
  Loader,
  MoreHorizontal,
  Eye,
  Download,
} from "lucide-react";
import type { SponsorshipProfile } from "@/lib/types";
import { uploadImageToCloudinary } from "@/lib/cloudinary-upload";
import { apiRequest } from "@/lib/query-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { ServerError } from "@/components/ui/server-error";
import { Skeleton } from "@/components/ui/skeleton";
import { jsPDF } from "jspdf";
import { ListPagination } from "@/components/dashboard/list-pagination";
import {
  calculateAgeFromDateOfBirth,
  toDateInputValue,
} from "@/lib/child-profile-form";

const PAGE_SIZE = 25;

const initialFormState: any = {
  _id: "",
  name: "",
  firstName: "",
  secondName: "",
  givenName: "",
  gender: "Female" as "Female" | "Male",
  dateOfBirth: "",
  age: 0,
  ageGroup: "6-12" as "0-5" | "6-12" | "13-18",
  class: "Primary 1",
  nationality: "Ugandan",
  familyStatus: "Single Parent" as "Single Parent" | "Total Orphans",
  numberOfParents: 1 as 0 | 1 | 2,
  guardianName: "",
  guardianContact: "",
  guardianRelation: "caretaker" as
    | "caretaker"
    | "mom"
    | "dad"
    | "sibling"
    | "uncle"
    | "aunt"
    | "grandparent",
  image: {
    url: "",
    public_id: "",
  },
  background: "",
  school: "",
  location: "",
  needsInput: "",
  monthlyNeed: "",
  education: {
    isStudying: false,
    educationStage: "",
    currentLevel: "",
    schoolName: "",
    classGrade: "",
    currentClass: "",
    academicYear: "",
    enrollmentDate: "",
    courseName: "",
    courseDurationValue: "",
    courseDurationUnit: "months",
    expectedGraduationDate: "",
    expectedGraduationYear: "",
    graduationStage: "",
    lastTermResult: "",
    graduationTarget: "",
    estimatedGraduationYear: "",
    educationNotes: "",
  },
  reportCards: [] as Array<{
    name: string;
    url: string;
    public_id: string;
    fileType: string;
    uploadedAt: string;
  }>,
  progress: 0,
  sponsorshipStatus: "Available",
};

const educationLevels = [
  "kindergarten",
  "primary",
  "secondary",
  "secondary-o",
  "secondary-a",
  "vocational",
  "university",
] as const;

const educationClassOptions: Record<string, string[]> = {
  kindergarten: ["Baby", "Middle", "Top"],
  primary: ["P-1", "P-2", "P-3", "P-4", "P-5", "P-6", "P-7"],
  secondary: ["S-1", "S-2", "S-3", "S-4", "S-5", "S-6"],
  "secondary-o": ["S-1", "S-2", "S-3", "S-4"],
  "secondary-a": ["S-5", "S-6"],
};

function normalizeEducationLevel(value?: string) {
  const normalized = String(value || "").trim().toLowerCase();
  return educationLevels.includes(normalized as (typeof educationLevels)[number])
    ? normalized
    : "";
}

function textValue(value: unknown) {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

type FormState = typeof initialFormState;

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "Available":
      return "bg-emerald-100 text-emerald-800";
    case "Sponsored":
      return "bg-sky-100 text-sky-800";
    default:
      return "bg-slate-100 text-slate-800";
  }
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

function getSponsorLabel(child: SponsorshipProfile) {
  const sponsor = (child as any).sponsor;

  if (!sponsor) return "No sponsor yet";

  if (typeof sponsor === "string") return "Sponsor assigned";

  if (typeof sponsor === "object") {
    const sponsorProfile = sponsor.sponsor || sponsor;
    if (sponsorProfile?.name) return sponsorProfile.name;
  }

  return "Sponsor assigned";
}

function getSponsorProfile(child: SponsorshipProfile) {
  const sponsor = (child as any).sponsor;

  if (!sponsor || typeof sponsor !== "object") {
    return null;
  }

  return sponsor.sponsor || sponsor;
}

const childExportHeaders = [
  "Child ID",
  "First Name",
  "Second Name",
  "Given Name",
  "Gender",
  "Date of Birth",
  "Age",
  "Age Group",
  "Nationality",
  "School",
  "Class",
  "Education Level",
  "Academic Year",
  "Family Status",
  "Number of Parents",
  "Guardian Name",
  "Guardian Contact",
  "Guardian Relationship",
  "Location",
  "Needs",
  "Monthly Need",
  "Progress",
  "Sponsorship Status",
  "Sponsor ID",
  "Sponsor Name",
  "Sponsor Email",
  "Sponsor Phone",
  "Sponsorship Start Date",
  "Sponsorship Period",
  "Sponsorship Amount",
  "Sponsorship Record ID",
] as const;

type ChildExportRow = Record<
  (typeof childExportHeaders)[number],
  string | number
>;

function getChildExportRow(child: SponsorshipProfile): ChildExportRow {
  const rawSponsor = (child as any).sponsor;
  const sponsor = getSponsorProfile(child) as any;
  const sponsorshipRecord =
    rawSponsor && typeof rawSponsor === "object" ? rawSponsor : null;
  const needs = Array.isArray(child.needs)
    ? child.needs.filter(Boolean).join(", ")
    : child.needs || "";

  return {
    "Child ID": child._id || "",
    "First Name": child.firstName || "",
    "Second Name": child.secondName || "",
    "Given Name": child.givenName || "",
    Gender: child.gender || "",
    "Date of Birth": child.dateOfBirth || "",
    Age: child.age ?? "",
    "Age Group": child.ageGroup || "",
    Nationality: child.nationality || "",
    School: child.school || child.education?.schoolName || "",
    "Class":
      child.class || child.education?.classGrade || child.education?.currentClass || "",
    "Education Level": child.education?.currentLevel || "",
    "Academic Year": child.education?.academicYear || "",
    "Family Status": child.familyStatus || "",
    "Number of Parents": child.numberOfParents ?? "",
    "Guardian Name": child.guardianName || "",
    "Guardian Contact": child.guardianContact || "",
    "Guardian Relationship": child.guardianRelation || "",
    Location: child.location || "",
    Needs: needs,
    "Monthly Need": child.monthlyNeed || "",
    Progress: child.progress ?? "",
    "Sponsorship Status": child.sponsorshipStatus || "",
    "Sponsor ID": sponsor?.sponsorId || sponsor?._id || "",
    "Sponsor Name": sponsor?.fullName || sponsor?.name || "",
    "Sponsor Email": sponsor?.email || "",
    "Sponsor Phone": sponsor?.phone || "",
    "Sponsorship Start Date": sponsorshipRecord?.startDate || "",
    "Sponsorship Period": sponsorshipRecord?.donation?.period || "",
    "Sponsorship Amount": sponsorshipRecord?.donation?.amount ?? "",
    "Sponsorship Record ID":
      sponsorshipRecord?.sponsor && sponsorshipRecord?._id
        ? sponsorshipRecord._id
        : "",
  };
}

function downloadChildrenFile(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function loadProfilePdfImage(url: string) {
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
  return { dataUrl, format: blob.type.includes("png") ? "PNG" : "JPEG", ...dimensions };
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

function estimateGraduationYear(
  currentLevel: string,
  currentClass: string = "",
) {
  const raw = `${currentLevel} ${currentClass}`.toLowerCase();

  if (raw.includes("primary")) return String(new Date().getFullYear() + 5);
  if (raw.includes("secondary") || raw.includes("senior"))
    return String(new Date().getFullYear() + 4);
  if (
    raw.includes("college") ||
    raw.includes("university") ||
    raw.includes("tertiary")
  )
    return String(new Date().getFullYear() + 4);
  if (raw.includes("vocational")) return String(new Date().getFullYear() + 2);

  return String(new Date().getFullYear() + 3);
}

export default function ChildrenDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const {
    data: Profiles,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["children", "profiles", page],
    queryFn: async () => {
      const response = await apiRequest("GET", `/children/profiles?page=${page}&limit=${PAGE_SIZE}`);
      return response.json();
    },
  });

  const { data: sponsorRecords, isLoading: isLoadingSponsors } = useQuery({
    queryKey: ["sponsors", "profiles", "all", page],
    queryFn: async () => {
      const response = await apiRequest("GET", `/sponsors/profiles/all?page=${page}&limit=${PAGE_SIZE}`);
      return response.json();
    },
  });

  const [children, setChildren] = useState<SponsorshipProfile[]>([]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [editingChild, setEditingChild] = useState<SponsorshipProfile | null>(
    null,
  );
  const [viewingChild, setViewingChild] = useState<SponsorshipProfile | null>(
    null,
  );
  const [formState, setFormState] = useState<FormState>(
    editingChild ? { ...initialFormState, ...editingChild } : initialFormState,
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "Available" | "Sponsored"
  >("all");
  const [formError, setFormError] = useState("");
  const [pageError, setPageError] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloadingProfileId, setDownloadingProfileId] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [publishState, setPublishState] = useState<Record<string, boolean>>({});
  const [assigningChild, setAssigningChild] =
    useState<SponsorshipProfile | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [assigningSponsor, setAssigningSponsor] = useState(false);
  const [sponsorshipHistory, setSponsorshipHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<
    "overview" | "education" | "family" | "sponsor" | "history" | "documents"
  >("overview");
  const [assignmentForm, setAssignmentForm] = useState({
    startDate: new Date().toISOString().slice(0, 10),
    selectedSponsorId: "",
  });

  useEffect(() => {
    setChildren(Array.isArray(Profiles) ? Profiles : []);
  }, [Profiles]);

  const filteredChildren = useMemo(() => {
    return children.filter((child) => {
      const fullName =
        `${child.firstName || ""} ${child.secondName || ""}`.trim();

      const matchesSearch = [fullName, child.name, child.school, child.location]
        .join(" ")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || child.sponsorshipStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [children, searchTerm, statusFilter]);

  const sponsorOptions = useMemo(() => {
    if (!Array.isArray(sponsorRecords)) return [];

    const seen = new Set<string>();

    return sponsorRecords
      .map((record: any) => {
        // /sponsors/profiles/all returns sponsor documents; older responses
        // may still be nested under donor.sponsor.
        const sponsor =
          record?.profile || record?.sponsor || record?.donor?.sponsor || {};
        const option = {
          _id: String(record?._id || record?.donor?._id || ""),
          name: sponsor.fullName || sponsor.name || "",
          email: sponsor.email || "",
          phone: sponsor.phone || "",
        };
        const key = `${option.email}-${option.phone}-${option.name}`;

        if (!option._id || !option.name || !option.email || seen.has(key)) {
          return null;
        }

        seen.add(key);
        return option;
      })
      .filter(Boolean);
  }, [sponsorRecords]);

  const resetForm = () => {
    setFormState(initialFormState);
    setFormError("");
    setWizardStep(1);
    setEditingChild(null);
    setImagePreview("");
  };

  const handleImageUpload = async (file: File) => {
    try {
      setIsUploadingImage(true);
      setFormError("");
      const result = await uploadImageToCloudinary(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Set the image URL from Cloudinary response
      setFormState((prevState: any) => ({
        ...prevState,
        image: {
          url: result.secure_url,
          public_id: result.public_id,
        },
      }));
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Failed to upload image",
      );
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleImageInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleReportCardUpload = async (file: File) => {
    try {
      setFormError("");
      const result = await uploadImageToCloudinary(file);
      const nextCard = {
        name: file.name,
        url: result.secure_url,
        public_id: result.public_id,
        fileType: file.type || "image",
        uploadedAt: new Date().toISOString(),
      };

      setFormState((prevState: any) => ({
        ...prevState,
        reportCards: [...(prevState.reportCards || []), nextCard],
      }));
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Failed to upload report card",
      );
    }
  };

  const removeImage = () => {
    setFormState((prevState: any) => ({
      ...prevState,
      image: {
        url: "",
        public_id: "",
      },
    }));
    setImagePreview("");
  };

  const removeReportCard = (publicId: string) => {
    setFormState((prevState: any) => ({
      ...prevState,
      reportCards: (prevState.reportCards || []).filter(
        (card: any) => card.public_id !== publicId,
      ),
    }));
  };

  const openNewProfile = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const exportChildrenCsv = () => {
    if (children.length === 0) return;

    const rows = children.map(getChildExportRow);
    const escapeCsvValue = (value: string | number) =>
      `"${String(value).replace(/"/g, '""')}"`;
    const csv = [
      childExportHeaders,
      ...rows.map((row) =>
        childExportHeaders.map((header) => row[header]),
      ),
    ]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\r\n");

    downloadChildrenFile(
      `\ufeff${csv}`,
      "children-profiles.csv",
      "text/csv;charset=utf-8",
    );
  };

  const exportChildrenJson = () => {
    if (children.length === 0) return;

    const rows = children.map(getChildExportRow);
    downloadChildrenFile(
      JSON.stringify(rows, null, 2),
      "children-profiles.json",
      "application/json;charset=utf-8",
    );
  };

  const downloadChildProfilePdf = async (child: SponsorshipProfile) => {
    setDownloadingProfileId(child._id);

    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 16;
      const contentWidth = pageWidth - margin * 2;
      const fullName = [child.firstName, child.secondName, child.givenName]
        .filter(Boolean)
        .join(" ") || "Child profile";
      let cursor = margin;

      const displayValue = (value: unknown) => {
        const text = String(value ?? "").trim();
        return text || "Not provided";
      };
      const addPageIfNeeded = (height: number) => {
        if (cursor + height <= pageHeight - margin) return;
        pdf.addPage();
        cursor = margin;
      };
      const addSection = (title: string) => {
        addPageIfNeeded(16);
        cursor += 4;
        pdf.setTextColor(47, 112, 94);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(12);
        pdf.text(title.toUpperCase(), margin, cursor);
        pdf.setDrawColor(47, 112, 94);
        pdf.setLineWidth(0.6);
        pdf.line(margin, cursor + 3, pageWidth - margin, cursor + 3);
        cursor += 11;
      };
      const addRows = (rows: Array<[string, unknown]>) => {
        rows.forEach(([label, value]) => {
          const lines = pdf.splitTextToSize(displayValue(value), contentWidth - 42);
          addPageIfNeeded(Math.max(9, lines.length * 4 + 5));
          pdf.setTextColor(102, 112, 107);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8);
          pdf.text(label.toUpperCase(), margin, cursor);
          pdf.setTextColor(28, 36, 33);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9.5);
          pdf.text(lines, margin + 42, cursor);
          cursor += Math.max(9, lines.length * 4 + 5);
        });
      };

      const logo = await loadProfilePdfImage("/dark-logo.jpeg");
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
      pdf.setTextColor(47, 112, 94);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.text("ENSIGO OF LOVE FOUNDATION", margin + logoSize + 3, cursor);
      pdf.setTextColor(102, 112, 107);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text(new Date().toLocaleDateString(), pageWidth - margin, cursor, {
        align: "right",
      });
      cursor += 14;
      cursor += 12;
      pdf.setTextColor(28, 36, 33);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(24);
      pdf.text("PROFILE & BIO", margin, cursor);
      cursor += 8;
      pdf.setTextColor(102, 112, 107);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.text(
        "A detailed child profile for care, education, and sponsorship planning.",
        margin,
        cursor,
      );
      cursor += 10;

      const profileImage = child.image?.url
        ? await loadProfilePdfImage(child.image.url)
        : null;
      const imageWidth = 62;
      const imageHeight = 68;
      pdf.setFillColor(241, 245, 242);
      pdf.roundedRect(margin, cursor, imageWidth, imageHeight, 2, 2, "F");
      if (profileImage) {
        const scale = Math.min(imageWidth / profileImage.width, imageHeight / profileImage.height);
        pdf.addImage(
          profileImage.dataUrl,
          profileImage.format,
          margin + (imageWidth - profileImage.width * scale) / 2,
          cursor + (imageHeight - profileImage.height * scale) / 2,
          profileImage.width * scale,
          profileImage.height * scale,
        );
      } else {
        pdf.setTextColor(102, 112, 107);
        pdf.setFontSize(9);
        pdf.text("Image not available", margin + imageWidth / 2, cursor + imageHeight / 2, {
          align: "center",
        });
      }
      const detailsX = margin + imageWidth + 12;
      const detailsWidth = contentWidth - imageWidth - 12;
      const summaryRows: Array<[string, unknown]> = [
        ["Name", fullName],
        ["Gender", child.gender],
        ["Age", child.age],
        ["Date of birth", child.dateOfBirth ? formatDisplayDate(child.dateOfBirth) : "Not provided"],
        ["Nationality", child.nationality],
        ["Location", child.location],
      ];
      summaryRows.forEach(([label, value]) => {
        pdf.setTextColor(102, 112, 107);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7.5);
        pdf.text(label.toUpperCase(), detailsX, cursor);
        pdf.setTextColor(28, 36, 33);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.text(pdf.splitTextToSize(displayValue(value), detailsWidth), detailsX, cursor + 5);
        cursor += 10;
      });
      cursor = cursor < margin + imageHeight + 10 ? margin + imageHeight + 10 : cursor + 10;
      addSection("Family");
      addRows([
        ["Family status", child.familyStatus],
        ["Number of parents", child.numberOfParents],
        ["Guardian", child.guardianName],
        ["Relationship", child.guardianRelation],
        ["Contact", child.guardianContact],
      ]);
      addSection("Education");
      addRows([
        [
          "Is studying",
          child.education?.isStudying === undefined
            ? "Not provided"
            : child.education.isStudying
              ? "Yes"
              : "No",
        ],
        [
          "Education stage",
          child.education?.educationStage || child.education?.currentLevel,
        ],
        ["School", child.education?.schoolName || child.school],
        ["Class / grade", child.education?.classGrade || child.education?.currentClass || child.class],
        [
          "Expected graduation year",
          child.education?.expectedGraduationYear ||
            child.education?.estimatedGraduationYear,
        ],
        ...(child.education?.educationStage === "vocational" ||
        child.education?.educationStage === "university"
          ? ([
              [
                "Course start date",
                child.education?.enrollmentDate
                  ? formatDisplayDate(child.education.enrollmentDate)
                  : "Not provided",
              ],
              ["Course / program", child.education?.courseName],
              [
                "Course duration",
                child.education?.courseDurationValue
                  ? `${child.education.courseDurationValue} ${child.education.courseDurationUnit || "months"}`
                  : "Not provided",
              ],
            ] as Array<[string, unknown]>)
          : []),
      ]);
      addSection("Sponsor details");
      addRows([
        ["Sponsorship status", child.sponsorshipStatus],
        ["Sponsor", getSponsorLabel(child)],
        ["Monthly need", child.monthlyNeed],
      ]);
      addSection("Background and needs");
      addRows([
        ["Background", child.background],
        ["Needs", Array.isArray(child.needs) ? child.needs.join(", ") : child.needs],
      ]);

      pdf.save(`child-profile-${child._id}.pdf`);
    } finally {
      setDownloadingProfileId("");
    }
  };

  const openEditProfile = (child: SponsorshipProfile) => {
    setEditingChild(child);
    setFormState({
      _id: child._id,
      name: textValue(child.name),
      firstName: textValue(child.firstName),
      secondName: textValue(child.secondName),
      givenName: textValue(child.givenName),
      gender: child.gender,
      dateOfBirth: toDateInputValue(child.dateOfBirth),
      age:
        calculateAgeFromDateOfBirth(toDateInputValue(child.dateOfBirth)) ??
        child.age ??
        0,
      ageGroup: child.ageGroup,
      class: child.class,
      nationality: child.nationality,
      familyStatus: child.familyStatus,
      numberOfParents: child.numberOfParents,
      guardianName: child.guardianName || "",
      guardianContact: child.guardianContact || "",
      guardianRelation: child.guardianRelation || "caretaker",
      image: {
        url: child.image?.url || "",
        public_id: child.image?.public_id || "",
      },
      background: textValue(child.background),
      school: textValue(child.school),
      location: textValue(child.location),
      needsInput: Array.isArray(child.needs)
        ? child.needs.filter(Boolean).join(", ")
        : textValue(child.needs),
      monthlyNeed: textValue(child.monthlyNeed),
      education: {
        isStudying:
          child.education?.isStudying ?? Boolean(child.education?.currentLevel),
        educationStage:
          child.education?.educationStage || normalizeEducationLevel(child.education?.currentLevel),
        currentLevel: normalizeEducationLevel(child.education?.currentLevel),
        schoolName: child.education?.schoolName || child.school || "",
        classGrade:
          child.education?.classGrade || child.education?.currentClass || "",
        currentClass: child.education?.currentClass || "",
        academicYear: child.education?.academicYear || "",
        enrollmentDate: child.education?.enrollmentDate || "",
        courseName: child.education?.courseName || "",
        courseDurationValue: child.education?.courseDurationValue || "",
        courseDurationUnit: child.education?.courseDurationUnit || "months",
        expectedGraduationDate: child.education?.expectedGraduationDate || "",
        expectedGraduationYear:
          child.education?.expectedGraduationYear ||
          child.education?.estimatedGraduationYear ||
          "",
        lastTermResult: child.education?.lastTermResult || "",
        graduationTarget: child.education?.graduationTarget || "",
        estimatedGraduationYear: child.education?.estimatedGraduationYear || "",
        graduationStage: child.education?.graduationStage || "",
        educationNotes: child.education?.educationNotes || "",
      },
      reportCards: child.reportCards || [],
      progress: child.progress,
      sponsorshipStatus: child.sponsorshipStatus,
    } as FormState);
    setImagePreview(child.image?.url || "");
    setIsDialogOpen(true);
  };

  const openViewProfile = (child: SponsorshipProfile) => {
    router.push(`/dashboard/children/${child._id}`);
  };

  useEffect(() => {
    if (!viewingChild?._id) {
      setSponsorshipHistory([]);
      return;
    }

    let isMounted = true;

    const fetchHistory = async () => {
      setLoadingHistory(true);

      try {
        const response = await apiRequest(
          "GET",
          `/sponsors/child/${viewingChild._id}`,
        );
        if (!response.ok) {
          throw new Error("Failed to load child sponsorship history");
        }

        const data = await response.json();

        if (isMounted) {
          setSponsorshipHistory(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Error loading child sponsorship history:", error);
        if (isMounted) {
          setSponsorshipHistory([]);
        }
      } finally {
        if (isMounted) {
          setLoadingHistory(false);
        }
      }
    };

    fetchHistory();

    return () => {
      isMounted = false;
    };
  }, [viewingChild?._id]);

  const openAssignSponsor = (child: SponsorshipProfile) => {
    setAssigningChild(child);
    setAssignmentForm({
      startDate: new Date().toISOString().slice(0, 10),
      selectedSponsorId: "",
    });
    setIsAssignDialogOpen(true);
  };

  const handleAssignSponsor = async () => {
    if (!assigningChild) return;
    setPageError("");

    const selectedSponsor = sponsorOptions.find(
      (option: any) => option._id === assignmentForm.selectedSponsorId,
    );

    if (!selectedSponsor) {
      setFormError("Please select a sponsor.");
      return;
    }

    try {
      setAssigningSponsor(true);
      setFormError("");

      const payload = {
        childId: assigningChild._id,
        child: assigningChild._id,
        sponsorId: selectedSponsor._id,
        sponsor: {
          name: selectedSponsor.name,
          email: selectedSponsor.email,
          phone: selectedSponsor.phone,
        },
        location: {
          address: assigningChild.location || "",
        },
        donation: {
          amount:
            Number(
              String(assigningChild.monthlyNeed || "").replace(/[^0-9.]/g, ""),
            ) || 0,
          period: "Monthly",
          remindByEmail: true,
        },
        startDate: assignmentForm.startDate,
        status: "Active",
      };

      const res = await apiRequest("PATCH", "/sponsors/reassign", payload);
      if (!res.ok) throw new Error("Failed to assign sponsor");
      const data = await res.json();

      const updatedChild = {
        ...assigningChild,
        sponsorshipStatus: "Sponsored",
        sponsor: data.sponsor || assigningChild.sponsor,
      };

      setChildren((current) =>
        current.map((child) =>
          child._id === assigningChild._id ? updatedChild : child,
        ),
      );

      setViewingChild((current) =>
        current && current._id === assigningChild._id ? updatedChild : current,
      );
      await queryClient.invalidateQueries({
        queryKey: ["children", "profiles"],
      });
      await queryClient.invalidateQueries({
        queryKey: ["sponsors", "profiles", "all"],
      });

      setAssigningChild(null);
      setIsAssignDialogOpen(false);
      toast({
        title: "Sponsor assigned",
        description: "The sponsor was assigned to this child successfully.",
      });
    } catch (error) {
      console.error("Error assigning sponsor:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Failed to assign sponsor to this child.";
      setFormError(message);
      setPageError(message);
      toast({
        variant: "destructive",
        title: "Unable to assign sponsor",
        description: message,
      });
    } finally {
      setAssigningSponsor(false);
    }
  };

  const togglePublish = (childId: string) => {
    setPublishState((current) => ({
      ...current,
      [childId]: !current[childId],
    }));
  };

  const handleDeleteProfile = async (id: string) => {
    setPageError("");
    try {
      setDeleting(true);
      const res = await apiRequest("DELETE", `/children/profile/${id}/delete`);
      if (!res.ok) {
        throw new Error("Failed to delete child profile");
      }
      setChildren(children.filter((child) => child._id !== id));
      toast({
        title: "Child profile deleted",
        description: "The child profile was removed successfully.",
      });
    } catch (error) {
      console.error("Error deleting child profile:", error);
      setPageError(
        error instanceof Error ? error.message : "Failed to delete child profile",
      );
      toast({
        variant: "destructive",
        title: "Unable to delete child profile",
        description: "Please try again.",
      });
    } finally {
      setDeleting(false);
    }
  };

  const validateStep = () => {
    if (wizardStep === 1) {
      if (!textValue(formState.firstName).trim() || !textValue(formState.secondName).trim()) {
        setFormError("Please enter the child’s full name.");
        return false;
      }
      if (!formState.dateOfBirth) {
        setFormError("Please select a date of birth.");
        return false;
      }
    }

    if (wizardStep === 3) {
      if (!textValue(formState.location).trim()) {
        setFormError("Please provide the child's location.");
        return false;
      }
    }

    if (wizardStep === 4 && formState.education.isStudying) {
      const { education } = formState;
      if (!education.educationStage || !education.enrollmentDate) {
        setFormError("Please provide the education stage and enrollment date.");
        return false;
      }
      if (!textValue(education.schoolName).trim()) {
        setFormError("Please provide the school or institution.");
        return false;
      }
      if (
        education.educationStage !== "vocational" &&
        education.educationStage !== "university" &&
        !education.classGrade
      ) {
        setFormError("Please provide the current class or level.");
        return false;
      }
      if (
        ["vocational", "university"].includes(education.educationStage) &&
        (!textValue(education.courseName).trim() ||
          !Number(education.courseDurationValue) ||
          Number(education.courseDurationValue) <= 0)
      ) {
        setFormError("Please provide the course and its duration.");
        return false;
      }
    }

    setFormError("");
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) {
      return;
    }
    setWizardStep((current) => Math.min(current + 1, 6));
  };

  const handleBack = () => {
    setFormError("");
    setWizardStep((current) => Math.max(current - 1, 1));
  };

  const handleSaveProfile = async () => {
    if (!validateStep()) {
      return;
    }
    setPageError("");
    setLoading(true);
    try {
      let data: any = null;
      let newProfile: SponsorshipProfile = {} as SponsorshipProfile;
      let res = null;

      const nextEducation = {
        ...formState.education,
        schoolName:
          textValue(formState.education.schoolName) || textValue(formState.school).trim(),
        classGrade:
          formState.education.classGrade || formState.education.currentClass,
        currentClass:
          formState.education.classGrade || formState.education.currentClass,
        currentLevel: formState.education.educationStage,
        expectedGraduationYear: "",
        expectedGraduationDate: "",
        graduationStage: "",
      };

      const payload: any = {
        firstName: textValue(formState.firstName).trim(),
        secondName: textValue(formState.secondName).trim(),
        givenName:
          textValue(formState.givenName).trim() || textValue(formState.firstName).trim(),
        gender: formState.gender,
        dateOfBirth: formState.dateOfBirth,
        age: Number(formState.age) || 0,
        ageGroup: formState.ageGroup,
        class: formState.class,
        nationality: formState.nationality,
        familyStatus: formState.familyStatus,
        numberOfParents: formState.numberOfParents,
        guardianName: textValue(formState.guardianName).trim(),
        guardianContact: textValue(formState.guardianContact).trim(),
        guardianRelation: formState.guardianRelation,
        image: {
          url: formState.image.url || "",
          public_id: formState.image.public_id || "",
        },
        background: textValue(formState.background).trim(),
        school: textValue(formState.school).trim(),
        location: textValue(formState.location).trim(),
        needs: textValue(formState.needsInput)
          .split(",")
          .map((item: any) => item.trim())
          .filter(Boolean),
        monthlyNeed: formState.monthlyNeed,
        education: nextEducation,
        sponsorshipStatus: formState.sponsorshipStatus,
      };
      if (editingChild) {
        payload._id = editingChild._id;
        res = await apiRequest(
          "PUT",
          `/children/profile/${editingChild._id}/update`,
          payload,
        );
      } else {
        res = await apiRequest("POST", `/children/profile/new`, payload);
      }
      if (!res.ok) throw new Error("Failed to save child profile");
      data = await res.json();

      if (
        !editingChild &&
        data.profile?._id &&
        assignmentForm.selectedSponsorId
      ) {
        const selectedSponsor = sponsorOptions.find(
          (option: any) => option._id === assignmentForm.selectedSponsorId,
        );
        if (selectedSponsor) {
          try {
            await apiRequest("PATCH", "/sponsors/reassign", {
              childId: data.profile._id,
              child: data.profile._id,
              sponsorId: selectedSponsor._id,
              sponsor: {
                name: selectedSponsor.name,
                email: selectedSponsor.email,
                phone: selectedSponsor.phone,
              },
              donation: { amount: 0, period: "Monthly", remindByEmail: true },
              startDate: assignmentForm.startDate,
              status: "Active",
            });
          } catch (assignmentError) {
            console.error(
              "Child profile created but sponsor assignment failed:",
              assignmentError,
            );
            setFormError(
              "Profile created, but sponsor assignment failed. You can assign the sponsor from the child list.",
            );
          }
        }
      }

      newProfile = {
        ...data.profile,
        _id: editingChild ? editingChild._id : data.profile._id,
        name:
          textValue(formState.name).trim() ||
          `${textValue(formState.firstName).trim()} ${textValue(formState.secondName).trim()}`,
        needs: textValue(formState.needsInput)
          .split(",")
          .map((item: any) => item.trim())
          .filter(Boolean),
        sponsor: data.profile.sponsor || null,
      };

      setChildren((current) => {
        if (editingChild) {
          return current.map((child) =>
            child._id === editingChild._id ? payload : child,
          );
        }
        return [newProfile, ...current];
      });

      setIsDialogOpen(false);
      resetForm();
      toast({
        title: editingChild ? "Child profile updated" : "Child profile created",
        description: editingChild
          ? "The child profile was updated successfully."
          : "The child profile was created successfully.",
      });
    } catch (error) {
      console.error("Error saving child profile:", error);
      const message =
        error instanceof Error ? error.message : "Failed to save child profile";
      setPageError(message);
      toast({
        variant: "destructive",
        title: "Unable to save child profile",
        description: "Please check the form and try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const legacyStepContent = () => {
    switch (wizardStep) {
      case 1:
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                className="bg-background"
                id="firstName"
                value={formState.firstName}
                onChange={(event) =>
                  setFormState({ ...formState, firstName: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondName">Second name</Label>
              <Input
                className="bg-background"
                id="secondName"
                value={formState.secondName}
                onChange={(event) =>
                  setFormState({ ...formState, secondName: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="givenName">Preferred name</Label>
              <Input
                className="bg-background"
                id="givenName"
                value={formState.givenName}
                onChange={(event) =>
                  setFormState({ ...formState, givenName: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={formState.gender}
                onValueChange={(value) =>
                  setFormState({
                    ...formState,
                    gender: value as "Female" | "Male",
                  })
                }
              >
                <SelectTrigger className="bg-background" id="gender">
                  <SelectValue>{formState.gender}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Male">Male</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of birth</Label>
              <Input
                className="bg-background"
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
                className="bg-background"
                id="age"
                type="number"
                min={0}
                value={formState.age}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    age: Number(event.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ageGroup">Age group</Label>
              <Select
                value={formState.ageGroup}
                onValueChange={(value) =>
                  setFormState({
                    ...formState,
                    ageGroup: value as "0-5" | "6-12" | "13-18",
                  })
                }
              >
                <SelectTrigger className="bg-background" id="ageGroup">
                  <SelectValue>{formState.ageGroup}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0-5">0-5</SelectItem>
                  <SelectItem value="6-12">6-12</SelectItem>
                  <SelectItem value="13-18">13-18</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="class">Class</Label>
              <Input
                className="bg-background"
                id="class"
                value={formState.class}
                onChange={(event) =>
                  setFormState({ ...formState, class: event.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="nationality">Nationality</Label>
              <Input
                className="bg-background"
                id="nationality"
                value={formState.nationality}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    nationality: event.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="familyStatus">Family status</Label>
              <Select
                value={formState.familyStatus}
                onValueChange={(value) =>
                  setFormState({
                    ...formState,
                    familyStatus: value as "Single Parent" | "Total Orphans",
                  })
                }
              >
                <SelectTrigger className="bg-background" id="familyStatus">
                  <SelectValue>{formState.familyStatus}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Single Parent">Single Parent</SelectItem>
                  <SelectItem value="Total Orphans">Total Orphans</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="numberOfParents">Number of parents</Label>
              <Select
                value={String(formState.numberOfParents)}
                onValueChange={(value) =>
                  setFormState({
                    ...formState,
                    numberOfParents: Number(value) as 0 | 1 | 2,
                  })
                }
              >
                <SelectTrigger className="bg-background" id="numberOfParents">
                  <SelectValue>{String(formState.numberOfParents)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="guardianName">Guardian name</Label>
              <Input
                className="bg-background"
                id="guardianName"
                placeholder="Example: Jane Doe"
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
                className="bg-background"
                id="guardianContact"
                placeholder="Phone number"
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
              <Label htmlFor="guardianRelation">Guardian relationship</Label>
              <Select
                value={formState.guardianRelation}
                onValueChange={(value) =>
                  setFormState({
                    ...formState,
                    guardianRelation:
                      value as typeof formState.guardianRelation,
                  })
                }
              >
                <SelectTrigger className="bg-background" id="guardianRelation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="caretaker">Caretaker</SelectItem>
                  <SelectItem value="mom">Mom</SelectItem>
                  <SelectItem value="dad">Dad</SelectItem>
                  <SelectItem value="sibling">Sibling</SelectItem>
                  <SelectItem value="uncle">Uncle</SelectItem>
                  <SelectItem value="aunt">Aunt</SelectItem>
                  <SelectItem value="grandparent">Grandparent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="school">School</Label>
              <Input
                className="bg-background"
                id="school"
                value={formState.school}
                onChange={(event) =>
                  setFormState({ ...formState, school: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                className="bg-background"
                id="location"
                value={formState.location}
                onChange={(event) =>
                  setFormState({ ...formState, location: event.target.value })
                }
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="needsInput">Needs</Label>
              <Input
                className="bg-background"
                id="needsInput"
                placeholder="Example: Education, Nutrition, Health"
                value={formState.needsInput}
                onChange={(event) =>
                  setFormState({ ...formState, needsInput: event.target.value })
                }
              />
            </div>
          </div>
        );
      default:
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="background">Background</Label>
              <Textarea
                className="bg-background"
                id="background"
                value={formState.background}
                onChange={(event) =>
                  setFormState({ ...formState, background: event.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentLevel">Current level</Label>
              <Select
                value={formState.education.currentLevel}
                onValueChange={(value) =>
                  setFormState({
                    ...formState,
                    education: {
                      ...formState.education,
                      currentLevel: value,
                    },
                  })
                }
              >
                <SelectTrigger className="bg-background" id="currentLevel">
                  <SelectValue placeholder="Select current level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kindergarten">Kindergarten</SelectItem>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                  <SelectItem value="vocational">Vocational</SelectItem>
                  <SelectItem value="university">University</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentClass">Current class</Label>
              <Input
                className="bg-background"
                id="currentClass"
                placeholder="Primary 4, Senior 3"
                value={formState.education.currentClass}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    education: {
                      ...formState.education,
                      currentClass: event.target.value,
                    },
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="academicYear">Academic year</Label>
              <Input
                className="bg-background"
                id="academicYear"
                value={formState.education.academicYear}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    education: {
                      ...formState.education,
                      academicYear: event.target.value,
                    },
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedGraduationYear">
                Estimated graduation year
              </Label>
              <Input
                className="bg-background"
                id="estimatedGraduationYear"
                value={formState.education.estimatedGraduationYear}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    education: {
                      ...formState.education,
                      estimatedGraduationYear: event.target.value,
                    },
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastTermResult">Last term result</Label>
              <Input
                className="bg-background"
                id="lastTermResult"
                value={formState.education.lastTermResult}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    education: {
                      ...formState.education,
                      lastTermResult: event.target.value,
                    },
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="graduationTarget">Graduation target</Label>
              <Input
                className="bg-background"
                id="graduationTarget"
                value={formState.education.graduationTarget}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    education: {
                      ...formState.education,
                      graduationTarget: event.target.value,
                    },
                  })
                }
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="educationNotes">Education notes</Label>
              <Textarea
                id="educationNotes"
                value={formState.education.educationNotes}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    education: {
                      ...formState.education,
                      educationNotes: event.target.value,
                    },
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthlyNeed">Monthly support</Label>
              <Input
                className="bg-background"
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
              <Label htmlFor="sponsorshipStatus">Sponsorship status</Label>
              <Select
                value={formState.sponsorshipStatus}
                onValueChange={(value) =>
                  setFormState({ ...formState, sponsorshipStatus: value })
                }
              >
                <SelectTrigger className="bg-background" id="sponsorshipStatus">
                  <SelectValue>{formState.sponsorshipStatus}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Available">Available</SelectItem>
                  <SelectItem value="Sponsored">Sponsored</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4 md:col-span-2">
              <div className="space-y-2">
                <Label>Report cards</Label>
                <div className="flex flex-col gap-3">
                  {(formState.reportCards || []).length > 0 ? (
                    <div className="grid gap-2 md:grid-cols-2">
                      {(formState.reportCards || []).map((card: any) => (
                        <div
                          key={card.public_id || card.url || card.name}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-slate-50 p-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {card.name || "Report card"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(card.uploadedAt).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                },
                              )}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeReportCard(card.public_id)}
                            className="text-xs text-destructive hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No report cards uploaded yet.
                    </p>
                  )}

                  <div className="flex gap-2">
                    <input
                      className="bg-background hidden"
                      id="reportCardInput"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          await handleReportCardUpload(file);
                          event.target.value = "";
                        }
                      }}
                    />
                    <label htmlFor="reportCardInput" className="flex-1">
                      <Button
                        asChild
                        variant="secondary"
                        className="w-full cursor-pointer"
                      >
                        <span>
                          <Upload size={16} className="mr-2" />
                          Upload report card
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 md:col-span-2">
              <div className="space-y-2">
                <Label>Profile Image</Label>
                <div className="flex flex-col gap-4">
                  {(imagePreview || formState.image.url) && (
                    <div className="relative inline-block">
                      <div className="h-48 w-48 rounded-lg overflow-hidden bg-slate-100 border border-border shadow-sm">
                        <img
                          src={imagePreview || formState.image.url}
                          alt="Preview"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={removeImage}
                        className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      className="bg-background hidden"
                      id="imageInput"
                      type="file"
                      accept="image/*"
                      onChange={handleImageInputChange}
                      disabled={isUploadingImage}
                    />
                    <label htmlFor="imageInput" className="flex-1">
                      <Button
                        asChild
                        variant={
                          imagePreview || formState.image.url
                            ? "secondary"
                            : "default"
                        }
                        disabled={isUploadingImage}
                        className="w-full cursor-pointer"
                      >
                        <span>
                          <Upload size={16} className="mr-2" />
                          {isUploadingImage
                            ? "Uploading..."
                            : imagePreview || formState.image.url
                              ? "Change image"
                              : "Upload image"}
                        </span>
                      </Button>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  const stepContent = () => {
    switch (wizardStep) {
      case 1:
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                className="bg-background"
                id="firstName"
                value={formState.firstName}
                onChange={(event) =>
                  setFormState({ ...formState, firstName: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="secondName">Second name</Label>
              <Input
                className="bg-background"
                id="secondName"
                value={formState.secondName}
                onChange={(event) =>
                  setFormState({ ...formState, secondName: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="givenName">Preferred name</Label>
              <Input
                className="bg-background"
                id="givenName"
                value={formState.givenName}
                onChange={(event) =>
                  setFormState({ ...formState, givenName: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={formState.gender}
                onValueChange={(value) =>
                  setFormState({
                    ...formState,
                    gender: value as "Female" | "Male",
                  })
                }
              >
                <SelectTrigger className="bg-background" id="gender">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Male">Male</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of birth</Label>
              <Input
                className="bg-background"
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
                className="bg-background"
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
              <Label htmlFor="ageGroup">Age group</Label>
              <Select
                value={formState.ageGroup}
                onValueChange={(value) =>
                  setFormState({
                    ...formState,
                    ageGroup: value as typeof formState.ageGroup,
                  })
                }
              >
                <SelectTrigger className="bg-background" id="ageGroup">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0-5">0-5</SelectItem>
                  <SelectItem value="6-12">6-12</SelectItem>
                  <SelectItem value="13-18">13-18</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nationality">Nationality</Label>
              <Input
                id="nationality"
                value={formState.nationality}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    nationality: event.target.value,
                  })
                }
              />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="familyStatus">Family status</Label>
              <Select
                value={formState.familyStatus}
                onValueChange={(value) =>
                  setFormState({
                    ...formState,
                    familyStatus: value as typeof formState.familyStatus,
                  })
                }
              >
                <SelectTrigger className="bg-background" id="familyStatus">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Single Parent">Single Parent</SelectItem>
                  <SelectItem value="Total Orphans">Total Orphans</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="numberOfParents">Number of parents</Label>
              <Select
                value={String(formState.numberOfParents)}
                onValueChange={(value) =>
                  setFormState({
                    ...formState,
                    numberOfParents: Number(value) as 0 | 1 | 2,
                  })
                }
              >
                <SelectTrigger className="bg-background" id="numberOfParents">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0</SelectItem>
                  <SelectItem value="1">1</SelectItem>
                  <SelectItem value="2">2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="guardianName">Guardian name</Label>
              <Input
                className="bg-background"
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
                className="bg-background"
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
              <Label htmlFor="guardianRelation">Guardian relationship</Label>
              <Select
                value={formState.guardianRelation}
                onValueChange={(value) =>
                  setFormState({
                    ...formState,
                    guardianRelation:
                      value as typeof formState.guardianRelation,
                  })
                }
              >
                <SelectTrigger className="bg-background" id="guardianRelation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "caretaker",
                    "mom",
                    "dad",
                    "sibling",
                    "uncle",
                    "aunt",
                    "grandparent",
                  ].map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="background">Bio</Label>
              <Textarea
                className="bg-background"
                id="background"
                value={formState.background}
                onChange={(event) =>
                  setFormState({ ...formState, background: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="needsInput">Support needs</Label>
              <Input
                className="bg-background"
                id="needsInput"
                placeholder="Education, nutrition, health"
                value={formState.needsInput}
                onChange={(event) =>
                  setFormState({ ...formState, needsInput: event.target.value })
                }
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  className="bg-background"
                  id="location"
                  value={formState.location}
                  onChange={(event) =>
                    setFormState({ ...formState, location: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthlyNeed">Monthly support</Label>
                <Input
                  className="bg-background"
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
            </div>
          </div>
        );
      case 4:
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex bg-background items-center justify-between rounded-md border p-3 md:col-span-2">
              <Label htmlFor="isStudying">Is studying</Label>
              <Switch
                className=" data-[state=checked]:bg-green-400 data-[state=unchecked]:bg-red-400"
                id="isStudying"
                checked={formState.education.isStudying}
                onCheckedChange={(checked) =>
                  setFormState({
                    ...formState,
                    education: { ...formState.education, isStudying: checked },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="educationStage">Education stage</Label>
              <Select
                disabled={!formState.education.isStudying}
                value={formState.education.educationStage}
                onValueChange={(value) =>
                  setFormState({
                    ...formState,
                    education: {
                      ...formState.education,
                      educationStage: value,
                      currentLevel: value,
                      classGrade: "",
                      currentClass: "",
                    },
                  })
                }
              >
                <SelectTrigger className="bg-background" id="educationStage">
                  <SelectValue placeholder="Select education stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kindergarten">Kindergarten / pre-primary</SelectItem>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary-o">Secondary O-Level</SelectItem>
                  <SelectItem value="secondary-a">Secondary A-Level</SelectItem>
                  <SelectItem value="vocational">Vocational institute</SelectItem>
                  <SelectItem value="university">University / college</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="schoolName">Name of school</Label>
              <Input
                disabled={formState.education.isStudying === false}
                className="bg-background"
                id="schoolName"
                value={formState.education.schoolName}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    school: event.target.value,
                    education: {
                      ...formState.education,
                      schoolName: event.target.value,
                    },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="classGrade">Class / grade</Label>
              <Select
                disabled={
                  formState.education.isStudying === false ||
                  !educationClassOptions[formState.education.educationStage]
                }
                value={formState.education.classGrade}
                onValueChange={(value) =>
                  setFormState({
                    ...formState,
                    class: value,
                    education: {
                      ...formState.education,
                      classGrade: value,
                      currentClass: value,
                    },
                  })
                }
              >
                <SelectTrigger className="bg-background" id="classGrade">
                  <SelectValue placeholder="Select class or grade" />
                </SelectTrigger>
                <SelectContent>
                  {(educationClassOptions[formState.education.educationStage] || []).map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="enrollmentDate">Enrollment / course start date</Label>
              <Input
                disabled={formState.education.isStudying === false}
                className="bg-background"
                id="enrollmentDate"
                type="date"
                value={formState.education.enrollmentDate}
                onChange={(event) =>
                  setFormState({
                    ...formState,
                    education: {
                      ...formState.education,
                      enrollmentDate: event.target.value,
                    },
                  })
                }
              />
            </div>
            {["vocational", "university"].includes(formState.education.educationStage) && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="courseName">Course / program</Label>
                  <Input
                    className="bg-background"
                    id="courseName"
                    value={formState.education.courseName}
                    onChange={(event) =>
                      setFormState({
                        ...formState,
                        education: { ...formState.education, courseName: event.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="courseDurationValue">Course duration</Label>
                  <Input
                    className="bg-background"
                    id="courseDurationValue"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={formState.education.courseDurationValue}
                    onChange={(event) =>
                      setFormState({
                        ...formState,
                        education: { ...formState.education, courseDurationValue: event.target.value },
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="courseDurationUnit">Duration unit</Label>
                  <Select
                    value={formState.education.courseDurationUnit}
                    onValueChange={(value) =>
                      setFormState({
                        ...formState,
                        education: { ...formState.education, courseDurationUnit: value },
                      })
                    }
                  >
                    <SelectTrigger className="bg-background" id="courseDurationUnit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="months">Months</SelectItem>
                      <SelectItem value="years">Years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="rounded-md border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground md:col-span-2">
              Expected graduation is calculated by the server from the stage, current class, enrollment date, and course duration.
            </div>
          </div>
        );
      case 5:
        return (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="existingSponsor">Assign existing sponsor</Label>
              <Select
                value={assignmentForm.selectedSponsorId}
                onValueChange={(value) =>
                  setAssignmentForm({
                    ...assignmentForm,
                    selectedSponsorId: value,
                  })
                }
              >
                <SelectTrigger className="bg-background" id="existingSponsor">
                  <SelectValue placeholder="Optional" />
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
              <Label htmlFor="wizardStartDate">Start date</Label>
              <Input
                className="bg-background"
                id="wizardStartDate"
                type="date"
                value={assignmentForm.startDate}
                onChange={(event) =>
                  setAssignmentForm({
                    ...assignmentForm,
                    startDate: event.target.value,
                  })
                }
              />
            </div>
          </div>
        );
      default:
        return (
          <div className="space-y-4">
            <Label>Profile image</Label>
            {(imagePreview || formState.image.url) && (
              <div className="relative h-48 w-48 overflow-hidden rounded-lg border">
                <img
                  src={imagePreview || formState.image.url}
                  alt="Preview"
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <input
              className="hidden"
              id="wizardImageInput"
              type="file"
              accept="image/*"
              onChange={handleImageInputChange}
              disabled={isUploadingImage}
            />
            <label htmlFor="wizardImageInput">
              <Button asChild type="button" disabled={isUploadingImage}>
                <span>
                  <Upload size={16} className="mr-2" />
                  {isUploadingImage ? "Uploading..." : "Upload image"}
                </span>
              </Button>
            </label>
          </div>
        );
    }
  };

  return (
    <div className="min-w-0 p-4 sm:p-6 lg:p-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
            Dashboard / Children
          </p>
          <h1 className="text-3xl font-bold text-foreground">
            Child Sponsorship Management
          </h1>
          <p className="max-w-2xl text-foreground/70 mt-2">
            Manage child profiles, edit sponsorship details, and keep a clean
            roster of supported children.
          </p>
          <ListPagination
            page={page}
            hasNextPage={children.length === PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
        <div className="flex w-full flex-col gap-3 md:w-auto md:flex-row">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full md:w-auto">
                <Download className="mr-2" size={16} /> Export profiles
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={exportChildrenCsv}>
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportChildrenJson}>
                Export JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={openNewProfile} className="w-full md:w-auto">
            <Plus className="mr-2" size={16} /> Add new child
          </Button>
        </div>
      </div>

      <Card className="p-6 mb-8 bg-card border-border">
        <div className="grid gap-4 md:grid-cols-[1fr_auto] items-end">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="search">Search children</Label>
              <Input
                className="bg-background"
                id="search"
                placeholder="Search by name, school or location"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="statusFilter">Status</Label>
              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as "all" | "Available" | "Sponsored")
                }
              >
                <SelectTrigger id="statusFilter">
                  <SelectValue>{statusFilter}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="Available">Available</SelectItem>
                  <SelectItem value="Sponsored">Sponsored</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Roster</Label>
              <p className="text-sm text-foreground/70">
                {filteredChildren.length} children matching current filters.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <div className="grid min-w-0 grid-cols-1 gap-4 rounded-lg bg-background sm:grid-cols-2 sm:gap-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card
              key={index}
              className="w-full min-w-0 overflow-hidden border-border bg-card p-0"
            >
              <Skeleton className="h-64 w-full rounded-none sm:h-80" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-4 rounded-lg bg-background sm:grid-cols-2 sm:gap-6">
          {filteredChildren.map((child, index) => (
            <Card
              key={child._id || index}
              className="w-full min-w-0 overflow-hidden border-border bg-card p-0 transition-shadow hover:shadow-md"
            >
              <div className="relative h-64 overflow-hidden sm:h-80">
                <img
                  src={child.image?.url || "/no-staff.avif"}
                  alt={child.firstName || "Child profile"}
                  className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                />

                <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/20 to-transparent" />

                <div className="absolute left-4 top-4">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(child.sponsorshipStatus || "Available")}`}
                  >
                    {child.sponsorshipStatus}
                  </span>
                </div>

                <div className="absolute right-4 top-4">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-9 w-9 rounded-full bg-background/90 text-foreground hover:bg-background"
                      >
                        <MoreHorizontal size={16} />
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem
                        onClick={() => openViewProfile(child)}
                        className="cursor-pointer"
                      >
                        <Eye size={14} className="mr-2" />
                        View profile
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => void downloadChildProfilePdf(child)}
                        disabled={downloadingProfileId === child._id}
                        className="cursor-pointer"
                      >
                        <Download size={14} className="mr-2" />
                        {downloadingProfileId === child._id
                          ? "Preparing PDF..."
                          : "Download profile"}
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() =>
                          !child.sponsor &&
                          child.sponsorshipStatus !== "Sponsored" &&
                          openAssignSponsor(child)
                        }
                        disabled={
                          Boolean(child.sponsor) ||
                          child.sponsorshipStatus === "Sponsored"
                        }
                        className="cursor-pointer"
                      >
                        <Plus size={14} className="mr-2" />
                        {child.sponsor || child.sponsorshipStatus === "Sponsored"
                          ? "Already sponsored"
                          : "Assign sponsor"}
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => openEditProfile(child)}
                        className="cursor-pointer"
                      >
                        <Edit size={14} className="mr-2" />
                        Edit
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => handleDeleteProfile(child._id)}
                        className="cursor-pointer text-destructive focus:text-destructive"
                      >
                        <Trash2 size={14} className="mr-2" />
                        Delete
                      </DropdownMenuItem>

                      <div className="flex items-center justify-between px-2 py-2">
                        <span className="text-sm font-medium text-foreground">
                          Publish
                        </span>
                        <Switch
                          checked={!!publishState[child._id]}
                          onCheckedChange={() => togglePublish(child._id)}
                        />
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div className="flex min-w-0 items-end justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate text-xl font-semibold text-white">
                        {child.firstName} {child.secondName}
                      </h2>
                      <p className="text-sm text-white/80">
                        {child.age} years old
                      </p>
                    </div>

                    <div className="max-w-[55%] truncate rounded-full bg-background/15 px-2 py-1 text-xs text-white/90 backdrop-blur-sm">
                      {getSponsorLabel(child)}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={isAssignDialogOpen}
        onOpenChange={(open) => {
          setIsAssignDialogOpen(open);
          if (!open) {
            setAssigningChild(null);
            setFormError("");
          }
        }}
      >
        <DialogContent
          preventDismiss
          className="max-w-2xl bg-card  overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle>
              {assigningChild
                ? `Assign sponsor to ${assigningChild.firstName} ${assigningChild.secondName}`
                : "Assign sponsor"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {formError ? (
              <div className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {formError}
              </div>
            ) : null}

            {sponsorOptions.length > 0 ? (
              <div className="space-y-2">
                <Label htmlFor="existingSponsor">
                  Choose an existing sponsor
                </Label>
                <Select
                  value={assignmentForm.selectedSponsorId}
                  onValueChange={(value) =>
                    setAssignmentForm((current) => ({
                      ...current,
                      selectedSponsorId: value,
                    }))
                  }
                >
                  <SelectTrigger id="existingSponsor" className="bg-background">
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
            ) : null}

            <div className="space-y-2">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start date</Label>
                <Input
                  id="startDate"
                  type="date"
                  className="bg-background"
                  value={assignmentForm.startDate}
                  onChange={(event) =>
                    setAssignmentForm({
                      ...assignmentForm,
                      startDate: event.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setIsAssignDialogOpen(false)}
                disabled={assigningSponsor}
              >
                Cancel
              </Button>
              <Button onClick={handleAssignSponsor} disabled={assigningSponsor}>
                {assigningSponsor ? "Assigning..." : "Assign sponsor"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent
          preventDismiss
          className="max-w-4xl bg-card overflow-auto h-140"
        >
          <DialogHeader>
            <DialogTitle>
              {editingChild ? "Edit child profile" : "New child profile"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-foreground/70">
              <div>
                <p className="font-semibold text-foreground">
                  Step {wizardStep} of 6
                </p>
                <p>
                  {
                    [
                      "Profile",
                      "Family",
                      "Bio",
                      "Education",
                      "Sponsor assignment",
                      "Image upload",
                    ][wizardStep - 1]
                  }
                </p>
              </div>
              <div className="flex items-center gap-2 text-foreground/70">
                {Array.from({ length: 6 }).map((_, index) => (
                  <span
                    key={index}
                    className={
                      wizardStep >= index + 1
                        ? "h-2 w-2 rounded-full bg-primary"
                        : "h-2 w-2 rounded-full bg-slate-300"
                    }
                  />
                ))}
              </div>
            </div>
            {formError ? (
              <div className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {formError}
              </div>
            ) : null}
            {stepContent()}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={wizardStep === 1}
                  onClick={handleBack}
                  className="bg-accent/10"
                >
                  <ChevronLeft size={16} /> Back
                </Button>
                {wizardStep < 6 ? (
                  <Button size="sm" onClick={handleNext}>
                    Next <ChevronRight size={16} className="ml-2" />
                  </Button>
                ) : null}
              </div>
              {wizardStep === 6 ? (
                <Button disabled={loading} onClick={handleSaveProfile}>
                  {editingChild ? (
                    loading ? (
                      <>
                        Saving... <Loader className="animate-spin" />
                      </>
                    ) : (
                      "Save changes"
                    )
                  ) : loading ? (
                    <>
                      Creating... <Loader className="animate-spin" />
                    </>
                  ) : (
                    "Create profile"
                  )}
                </Button>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(viewingChild)}
        onOpenChange={(open) => {
          if (!open) setViewingChild(null);
        }}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] bg-card overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Child profile details</DialogTitle>
          </DialogHeader>

          {viewingChild && (
            <div className="space-y-6">
              <div className="overflow-hidden rounded-xl border border-border bg-muted">
                <img
                  src={viewingChild.image?.url || "/no-staff.avif"}
                  alt={viewingChild.firstName || "Child profile"}
                  className="h-72 w-full object-cover"
                />
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">
                      {viewingChild.firstName} {viewingChild.secondName}
                    </h2>
                    <p className="text-sm text-foreground/70">
                      {viewingChild.school} • {viewingChild.location}
                    </p>
                  </div>

                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadgeClass(viewingChild.sponsorshipStatus || "Available")}`}
                  >
                    {viewingChild.sponsorshipStatus}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs uppercase tracking-wide text-foreground/60">
                      Age
                    </p>
                    <p className="mt-1 text-base font-semibold text-foreground">
                      {viewingChild.age}
                    </p>
                  </div>

                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs uppercase tracking-wide text-foreground/60">
                      Gender
                    </p>
                    <p className="mt-1 text-base font-semibold text-foreground">
                      {viewingChild.gender}
                    </p>
                  </div>

                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs uppercase tracking-wide text-foreground/60">
                      Class
                    </p>
                    <p className="mt-1 text-base font-semibold text-foreground">
                      {viewingChild.class}
                    </p>
                  </div>

                  <div className="rounded-lg bg-muted p-3">
                    <p className="text-xs uppercase tracking-wide text-foreground/60">
                      Sponsor
                    </p>
                    <p className="mt-1 text-base font-semibold text-foreground">
                      {getSponsorLabel(viewingChild)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setViewingChild(null);
                      openEditProfile(viewingChild);
                    }}
                  >
                    <Edit size={14} className="mr-2" />
                    Edit profile
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card p-2">
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "overview", label: "Overview" },
                    { key: "education", label: "Education" },
                    { key: "family", label: "Family" },
                    { key: "sponsor", label: "Sponsor details" },
                    { key: "history", label: "Sponsorship history" },
                    { key: "documents", label: "Documents" },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() =>
                        setActiveProfileTab(tab.key as typeof activeProfileTab)
                      }
                      className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                        activeProfileTab === tab.key
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground/70 hover:bg-muted/80"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {activeProfileTab === "overview" && (
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-xl border border-border bg-card p-4">
                    <h3 className="mb-3 text-lg font-semibold text-foreground">
                      Background
                    </h3>
                    <p className="text-sm leading-6 text-foreground/80">
                      {formatList(viewingChild.background)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4">
                    <h3 className="mb-3 text-lg font-semibold text-foreground">
                      Support needs
                    </h3>
                    <p className="text-sm leading-6 text-foreground/80">
                      {formatList(viewingChild.needs)}
                    </p>
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
                        {viewingChild.familyStatus}
                      </li>
                      <li>
                        <span className="font-medium text-foreground">
                          Number of parents:
                        </span>{" "}
                        {viewingChild.numberOfParents}
                      </li>
                      <li>
                        <span className="font-medium text-foreground">
                          Nationality:
                        </span>{" "}
                        {viewingChild.nationality}
                      </li>
                      <li>
                        <span className="font-medium text-foreground">
                          Monthly need:
                        </span>{" "}
                        {viewingChild.monthlyNeed || "Not provided"}
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
                        {formatDisplayDate(viewingChild.dateOfBirth)}
                      </li>
                      <li>
                        <span className="font-medium text-foreground">
                          Age group:
                        </span>{" "}
                        {viewingChild.ageGroup || "Not provided"}
                      </li>
                      <li>
                        <span className="font-medium text-foreground">
                          Given name:
                        </span>{" "}
                        {viewingChild.givenName || "Not provided"}
                      </li>
                      <li>
                        <span className="font-medium text-foreground">
                          Preferred name:
                        </span>{" "}
                        {viewingChild.name || "Not provided"}
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {activeProfileTab === "education" && (
                <div className="space-y-4 rounded-xl border border-border bg-card p-4">
                  <h3 className="text-lg font-semibold text-foreground">
                    Education tracking
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-lg bg-muted p-4">
                      <p className="text-xs uppercase tracking-wide text-foreground/60">
                        Current level
                      </p>
                      <p className="mt-2 text-base font-semibold text-foreground">
                        {viewingChild.education?.currentLevel || "Not provided"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted p-4">
                      <p className="text-xs uppercase tracking-wide text-foreground/60">
                        Current class
                      </p>
                      <p className="mt-2 text-base font-semibold text-foreground">
                        {viewingChild.education?.currentClass || "Not provided"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted p-4">
                      <p className="text-xs uppercase tracking-wide text-foreground/60">
                        School
                      </p>
                      <p className="mt-2 text-base font-semibold text-foreground">
                        {viewingChild.education?.schoolName ||
                          viewingChild.school ||
                          "Not provided"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted p-4">
                      <p className="text-xs uppercase tracking-wide text-foreground/60">
                        Academic year
                      </p>
                      <p className="mt-2 text-base font-semibold text-foreground">
                        {viewingChild.education?.academicYear || "Not provided"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted p-4">
                      <p className="text-xs uppercase tracking-wide text-foreground/60">
                        Last term result
                      </p>
                      <p className="mt-2 text-base font-semibold text-foreground">
                        {viewingChild.education?.lastTermResult ||
                          "Not provided"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted p-4">
                      <p className="text-xs uppercase tracking-wide text-foreground/60">
                        Expected graduation year
                      </p>
                      <p className="mt-2 text-base font-semibold text-foreground">
                        {viewingChild.education?.expectedGraduationYear ||
                          viewingChild.education?.estimatedGraduationYear ||
                          "Not provided"}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-xs uppercase tracking-wide text-foreground/60">
                      Graduation target
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {viewingChild.education?.graduationTarget ||
                        "Not provided"}
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted p-4">
                    <p className="text-xs uppercase tracking-wide text-foreground/60">
                      Education notes
                    </p>
                    <p className="mt-2 text-sm leading-6 text-foreground/80">
                      {viewingChild.education?.educationNotes ||
                        "No additional notes"}
                    </p>
                  </div>
                </div>
              )}

              {activeProfileTab === "family" && (
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-xl border border-border bg-card p-4">
                    <h3 className="mb-3 text-lg font-semibold text-foreground">
                      Guardian information
                    </h3>
                    <p className="text-sm leading-6 text-foreground/80">
                      {viewingChild.guardianName || "Not provided"}
                      <br />
                      {viewingChild.guardianContact || "Contact not provided"}
                      <br />
                      {viewingChild.guardianRelation ||
                        "Relationship not provided"}
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
                        {viewingChild.familyStatus}
                      </li>
                      <li>
                        <span className="font-medium text-foreground">
                          Number of parents:
                        </span>{" "}
                        {viewingChild.numberOfParents}
                      </li>
                      <li>
                        <span className="font-medium text-foreground">
                          Nationality:
                        </span>{" "}
                        {viewingChild.nationality}
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {activeProfileTab === "sponsor" && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-3 text-lg font-semibold text-foreground">
                    Sponsorship details
                  </h3>

                  {getSponsorProfile(viewingChild) ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-lg bg-muted p-4">
                        <p className="text-xs uppercase tracking-wide text-foreground/60">
                          Sponsor
                        </p>
                        <div className="mt-3 flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {getSponsorProfile(viewingChild)
                              ?.name?.charAt(0)
                              ?.toUpperCase() || "S"}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">
                              {getSponsorProfile(viewingChild)?.name}
                            </p>
                            <p className="text-sm text-foreground/70">
                              {getSponsorProfile(viewingChild)?.email}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg bg-muted p-4">
                        <p className="text-xs uppercase tracking-wide text-foreground/60">
                          Contact
                        </p>
                        <ul className="mt-3 space-y-2 text-sm text-foreground/80">
                          <li>
                            <span className="font-medium text-foreground">
                              Phone:
                            </span>{" "}
                            {getSponsorProfile(viewingChild)?.phone ||
                              "Not provided"}
                          </li>
                          <li>
                            <span className="font-medium text-foreground">
                              Address:
                            </span>{" "}
                            {(viewingChild as any).sponsor?.location &&
                            typeof (viewingChild as any).sponsor.location ===
                              "object"
                              ? [
                                  (viewingChild as any).sponsor.location
                                    .address,
                                  (viewingChild as any).sponsor.location.city,
                                  (viewingChild as any).sponsor.location.state,
                                  (viewingChild as any).sponsor.location
                                    .zipCode,
                                ]
                                  .filter(Boolean)
                                  .join(", ") || "Not provided"
                              : "Not provided"}
                          </li>
                        </ul>
                      </div>

                      <div className="rounded-lg bg-muted p-4">
                        <p className="text-xs uppercase tracking-wide text-foreground/60">
                          Assigned on
                        </p>
                        <p className="mt-3 text-base font-semibold text-foreground">
                          {formatDisplayDate(
                            (viewingChild as any).sponsor?.startDate,
                          )}
                        </p>
                      </div>

                      <div className="rounded-lg bg-muted p-4">
                        <p className="text-xs uppercase tracking-wide text-foreground/60">
                          Sponsorship plan
                        </p>
                        <p className="mt-3 text-base font-semibold text-foreground">
                          {(viewingChild as any).sponsor?.donation?.period ||
                            "Monthly"}
                        </p>
                        <p className="text-sm text-foreground/70">
                          $
                          {(
                            (viewingChild as any).sponsor?.donation?.amount || 0
                          ).toString()}{" "}
                          per period
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border bg-background p-4 text-sm text-foreground/70">
                      No sponsor has been assigned to this child yet.
                    </div>
                  )}
                </div>
              )}

              {activeProfileTab === "history" && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-3 text-lg font-semibold text-foreground">
                    Sponsorship history
                  </h3>

                  {loadingHistory ? (
                    <div className="space-y-3">
                      <div className="h-12 animate-pulse rounded-lg bg-muted" />
                      <div className="h-12 animate-pulse rounded-lg bg-muted" />
                    </div>
                  ) : sponsorshipHistory.length > 0 ? (
                    <div className="space-y-3">
                      {sponsorshipHistory.map((record: any, index: number) => {
                        const donor = record.donor || {};
                        const sponsorName =
                          donor.profile?.fullName ||
                          donor.sponsor?.name ||
                          donor.name ||
                          "Unknown sponsor";
                        const amount = Number(
                          record.amount ??
                            record.donation?.amount ??
                            donor.donation?.amount ??
                            0,
                        );
                        const status = record.status || "Pending";
                        const startDate = record.startDate
                          ? new Date(record.startDate).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              },
                            )
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

              {activeProfileTab === "documents" && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-3 text-lg font-semibold text-foreground">
                    Documents
                  </h3>
                  {(viewingChild.reportCards || []).length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {(viewingChild.reportCards || []).map((card, index) => (
                        <a
                          key={
                            card.public_id ||
                            card.url ||
                            `${card.name || "document"}-${index}`
                          }
                          href={card.url || "#"}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-border bg-muted p-3 text-sm text-foreground/80 hover:bg-muted/80"
                        >
                          <p className="font-medium text-foreground">
                            {card.name || "Report card"}
                          </p>
                          <p className="mt-1 text-xs text-foreground/60">
                            {card.fileType || "Document"}
                          </p>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border bg-background p-4 text-sm text-foreground/70">
                      No report cards have been uploaded for this child yet.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ServerError message={pageError} />
    </div>
  );
}
