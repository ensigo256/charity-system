export interface PaymentRecord {
  id?: string;
  _id?: string;
  receiptId?: string;
  date: string;
  amount: number;
  currency?: string;
  method: string;
  status: "Completed" | "Pending" | "Failed";
  transactionId?: string;
  note?: string;
  notes?: string;
  paymentGroupId?: string;
}

export interface SponsorProfileData {
  fullName?: string;
  name?: string;
  email?: string;
  phone?: string;
}

export interface SponsorRecord {
  _id?: string;
  donor?: SponsorRecord;
  profile?: SponsorProfileData;
  sponsor?: SponsorProfileData;
  donation?: {
    amount?: number;
    period?: string;
  };
  name?: string;
  email?: string;
  phone?: string;
}

export interface SponsorshipRecord {
  _id: string;
  child?: SponsorshipProfile | string | null;
  donor: SponsorRecord;
  plan?: string;
  monthlyAmount?: number;
  amount?: number;
  donation?: {
    amount?: number;
    period?: string;
  };
  currency?: string;
  frequency?: string;
  status: "Active" | "Pending" | "Paused" | "Completed" | "Cancelled";
  startDate: string;
  endDate?: string | null;
  lastPayment?: string;
  totalPaid: number;
  payments: PaymentRecord[];
  publicPledgeReference?: string;
  expectedFundsDate?: string;
  createdAt?: string;
  achInstructionEmail?: {
    status: "pending" | "sending" | "sent" | "failed";
    attempts: number;
    sentAt?: string | null;
    lastError?: string;
  };
  notes: string;
}

export interface SponsorshipProfile {
  _id: string;
  name?: string;
  firstName: string;
  secondName?: string;
  givenName?: string;
  gender: "Male" | "Female" | string;
  dateOfBirth?: string;
  age?: number;
  ageGroup?: "0-5" | "6-12" | "13-18" | string;
  class?: string;
  nationality?: string;
  familyStatus?: "Total Orphans" | "Single Parent" | string;
  numberOfParents?: 0 | 1 | 2;
  guardianName?: string;
  guardianContact?: string;
  guardianRelation?: string;
  image?: {
    url?: string;
    public_id?: string;
  };
  background?: string;
  school?: string;
  location?: string;
  needs?: any;
  monthlyNeed?: number | string;
  education?: {
    isStudying?: boolean;
    educationStage?: string;
    currentLevel?: string;
    schoolName?: string;
    classGrade?: string;
    currentClass?: string;
    academicYear?: string;
    enrollmentDate?: string;
    courseName?: string;
    courseDurationValue?: number | string;
    courseDurationUnit?: "months" | "years" | string;
    expectedGraduationDate?: string;
    expectedGraduationYear?: string;
    graduationStage?: string;
    lastTermResult?: string;
    graduationTarget?: string;
    estimatedGraduationYear?: string;
    educationNotes?: string;
  };
  reportCards?: Array<{
    _id?: string;
    name?: string;
    description?: string;
    url?: string;
    public_id?: string;
    fileType?: string;
    uploadedAt?: string;
  }>;
  progress?: number;
  sponsorshipStatus?: string;
  sponsorCount?: number;
  sponsorships?: SponsorshipRecord[];
  sponsor?: any;
}
