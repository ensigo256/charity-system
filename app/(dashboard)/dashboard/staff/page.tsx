"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trash2,
  Mail,
  Phone,
  Users,
  ImagePlus,
  X,
  Loader,
  MoreVertical,
  Eye,
  Edit,
  UserRoundPlus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { set } from "react-hook-form";
import { url } from "inspector";
import { apiRequest } from "@/lib/query-client";
import { useQuery } from "@tanstack/react-query";
import { ListPagination } from "@/components/dashboard/list-pagination";

const PAGE_SIZE = 25;

interface StaffMember {
  _id: string;
  name: string;
  role: string;

  type: "staff" | "volunteer";
  email: string;
  phone: string;
  socialLinks: string[];
  joinDate: string;
  status: "active" | "inactive";
  photo: {
    url: string;
    public_id: string;
  } | null;
  createdAt?: string;
}

interface NewsletterSubscriber {
  id: string;
  email: string;
  name: string;
  subscribedDate: string;
  status: "pending" | "active" | "unsubscribed";
}

interface BackendNewsletterSubscriber {
  _id: string;
  email: string;
  name?: string;
  subscribedOn?: string;
  status: "pending" | "active" | "unsubscribed";
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [activeTab, setActiveTab] = useState<
    "staff" | "volunteers" | "subscribers"
  >("staff");
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<StaffMember>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [viewDetailsId, setViewDetailsId] = useState<string | null>(null);
  const [showAddSocialLink, setShowAddSocialLink] = useState<string | null>(
    null,
  );
  const [socialLinkForm, setSocialLinkForm] = useState({
    platform: "",
    url: "",
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [page, setPage] = useState(1);

  const { data: staffData, refetch: refetchStaff } = useQuery<StaffMember[]>({
    queryKey: ["staff", "all", page],
    queryFn: async () => {
      const response = await apiRequest("GET", `/staff/all?page=${page}&limit=${PAGE_SIZE}`);
      return response.json();
    },
  });

  useEffect(() => {
    if (staffData) {
      setStaff(staffData);
    }
  }, [staffData]);

  const { data: subscriberData } = useQuery<BackendNewsletterSubscriber[]>({
    queryKey: ["newsletter", "subscribers"],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        "/newsletter/subscribers?page=1&limit=100",
      );
      return response.json();
    },
  });

  useEffect(() => {
    if (!subscriberData) return;

    setSubscribers(
      subscriberData.map((subscriber) => ({
        id: subscriber._id,
        email: subscriber.email,
        name: subscriber.name?.trim() || subscriber.email,
        subscribedDate: subscriber.subscribedOn
          ? new Date(subscriber.subscribedOn).toLocaleDateString()
          : "",
        status: subscriber.status,
      })),
    );
  }, [subscriberData]);

  const roleOptions = [
    "Executive Director",
    "Program Manager",
    "Volunteer Coordinator",
    "Fundraising Manager",
    "Communications Manager",
    "Operations Manager",
    "Community Outreach",
    "Grant Writer",
  ];

  const [newMemberForm, setNewMemberForm] = useState({
    name: "",
    contact: "",
    role: "",

    email: "",
    photo: { url: "", public_id: "" },
  });

  const resetNewMemberForm = () => {
    setNewMemberForm({
      name: "",
      contact: "",
      role: "",
      email: "",
      photo: { url: "", public_id: "" },
    });
    setImagePreview(null);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setShowAddForm(open);
    if (!open) {
      resetNewMemberForm();
    }
  };

  const removeImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setNewMemberForm((prev) => ({
      ...prev,
      photo: { url: "", public_id: "" },
    }));
    setImagePreview(null);
    setSelectedImage(null);
  };

  const staffList = staff.filter((s) => s.type === "staff");
  const volunteerList = staff.filter((s) => s.type === "volunteer");
  const activeSubscribers = subscribers.filter((s) => s.status === "active");

  const filteredStaff = useMemo(() => {
    const list =
      activeTab === "staff"
        ? staffList
        : activeTab === "volunteers"
          ? volunteerList
          : [];
    return list.filter(
      (member) =>
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.role.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [staff, activeTab, searchTerm]);

  const filteredSubscribers = useMemo(() => {
    return subscribers.filter(
      (sub) =>
        sub.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [subscribers, searchTerm]);

  const handleEdit = (member: StaffMember) => {
    setNewMemberForm({
      name: member.name,
      contact: member.phone,
      role: member.role,
      photo: member.photo ? member.photo : { url: "", public_id: "" },
      email: member.email,
    });
  };

  const handleDelete = async (id: string) => {
    setSaving;
    try {
      await apiRequest("DELETE", `/staff/delete/${id}`);
      setStaff(staff.filter((member) => member._id !== id));
    } catch (error) {
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async () => {
    setSaving(true);
    try {
      let imageData = null;
      if (selectedImage) {
        imageData = await uploadImageToCloudinary(selectedImage);
      }

      const newMember = {
        name: newMemberForm.name,
        role: newMemberForm.role,

        type: activeTab === "staff" ? "staff" : "volunteer",
        email: newMemberForm.email,
        phone: newMemberForm.contact,
        socialLinks: [],
        status: "active",
        photo: {
          url: imageData?.secure_url || newMemberForm.photo?.url || "",
          public_id:
            imageData?.public_id || newMemberForm.photo?.public_id || "",
        },
      };

      if (editData && editData._id) {
        const response = await apiRequest("PUT", `/staff/update/${editData._id}`, newMember);
        if (!response.ok) throw new Error("Failed to update staff member");
      } else {
        const response = await apiRequest("POST", "/staff/new", newMember);
        if (!response.ok) throw new Error("Failed to create staff member");
      }

      setStaff((prev: any) => {
        if (editData._id) {
          return prev.map((member: any) =>
            member._id === editData._id ? { ...member, ...newMember } : member,
          );
        }
        return [...prev, newMember];
      });

      removeImage();
      resetNewMemberForm();
      setShowAddForm(false);
      toast({
        title: editData?._id ? "Staff member updated" : "Staff member created",
        description: editData?._id
          ? "The staff member was updated successfully."
          : "The staff member was created successfully.",
      });
    } catch (error) {
      console.error("Error saving staff member:", error);
      toast({ variant: "destructive", title: "Unable to save staff member", description: "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = (id: string, newStatus: "active" | "inactive") => {
    setStaff(
      staff.map((member) =>
        member._id === id ? { ...member, status: newStatus } : member,
      ),
    );
  };

  async function uploadImageToCloudinary(file: File) {
    if (!file) {
      throw new Error("No file provided");
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset =
      process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "charity_uploads";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      },
    );

    if (!response.ok) {
      throw new Error("Failed to upload image");
    }

    const data = await response.json();

    return data;
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">
          Staff & Volunteers Management
        </h2>
        <ListPagination
          page={page}
          hasNextPage={staff.length === PAGE_SIZE}
          onPageChange={setPage}
        />
        <p className="text-foreground/70">
          Manage your team members and newsletter subscribers
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => {
            setActiveTab("staff");
            setSearchTerm("");
            setShowAddForm(false);
          }}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "staff"
              ? "border-primary text-primary"
              : "border-transparent text-foreground/60 hover:text-foreground"
          }`}
        >
          Staff
        </button>
        <button
          onClick={() => {
            setActiveTab("volunteers");
            setSearchTerm("");
            setShowAddForm(false);
          }}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "volunteers"
              ? "border-primary text-primary"
              : "border-transparent text-foreground/60 hover:text-foreground"
          }`}
        >
          Volunteers
        </button>
        <button
          onClick={() => {
            setActiveTab("subscribers");
            setSearchTerm("");
            setShowAddForm(false);
          }}
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === "subscribers"
              ? "border-primary text-primary"
              : "border-transparent text-foreground/60 hover:text-foreground"
          }`}
        >
          Newsletter Subscribers
        </button>
      </div>

      {/* Statistics */}
      {activeTab !== "subscribers" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <p className="text-foreground/60 text-sm mb-2">
              Total {activeTab === "staff" ? "Staff" : "Volunteers"}
            </p>
            <p className="text-3xl font-bold text-foreground">
              {activeTab === "staff" ? staffList.length : volunteerList.length}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-foreground/60 text-sm mb-2">Active</p>
            <p className="text-3xl font-bold text-accent">
              {
                (activeTab === "staff" ? staffList : volunteerList).filter(
                  (m) => m.status === "active",
                ).length
              }
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-foreground/60 text-sm mb-2">Inactive</p>
            <p className="text-3xl font-bold text-primary">
              {
                (activeTab === "staff" ? staffList : volunteerList).filter(
                  (m) => m.status === "inactive",
                ).length
              }
            </p>
          </Card>
        </div>
      )}

      {/* Newsletter Statistics */}
      {activeTab === "subscribers" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <p className="text-foreground/60 text-sm mb-2">Total Subscribers</p>
            <p className="text-3xl font-bold text-foreground">
              {subscribers.length}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-foreground/60 text-sm mb-2">Active</p>
            <p className="text-3xl font-bold text-accent">
              {activeSubscribers.length}
            </p>
          </Card>
          <Card className="p-6">
            <p className="text-foreground/60 text-sm mb-2">Unsubscribed</p>
            <p className="text-3xl font-bold text-primary">
              {subscribers.filter((s) => s.status === "unsubscribed").length}
            </p>
          </Card>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-foreground mb-2">
            Search
          </label>
          <Input
            type="text"
            placeholder={
              activeTab === "subscribers"
                ? "Search by email or name..."
                : "Search by name, email, or role..."
            }
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-card text-foreground border-border"
          />
        </div>
        {activeTab !== "subscribers" && (
          <Button
            onClick={() => setShowAddForm(true)}
            className="bg-accent hover:bg-accent/90 text-accent-foreground font-medium"
          >
            + Add {activeTab === "staff" ? "Staff" : "Volunteer"}
          </Button>
        )}
      </div>

      {/* staff and volunteer form */}
      {activeTab !== "subscribers" && (
        <Dialog open={showAddForm} onOpenChange={handleDialogOpenChange}>
          <DialogContent preventDismiss className="w-full bg-card max-w-xl">
            <DialogHeader>
              {editData && editData._id ? (
                <DialogTitle>
                  Updating{" "}
                  {activeTab === "staff" ? "Staff Member" : "Volunteer"} Profile
                </DialogTitle>
              ) : (
                <DialogTitle>
                  Add New {activeTab === "staff" ? "Staff Member" : "Volunteer"}
                </DialogTitle>
              )}
            </DialogHeader>

            <div className="grid grid-cols-1 gap-4">
              <Input
                placeholder="Full Name"
                value={newMemberForm.name}
                onChange={(e) =>
                  setNewMemberForm({ ...newMemberForm, name: e.target.value })
                }
                className="bg-background border-border"
              />

              <Input
                placeholder="Contact"
                value={newMemberForm.contact}
                onChange={(e) =>
                  setNewMemberForm({
                    ...newMemberForm,
                    contact: e.target.value,
                  })
                }
                className="bg-background border-border"
              />

              <Input
                placeholder="Email"
                type="email"
                value={newMemberForm.email}
                onChange={(e) =>
                  setNewMemberForm({ ...newMemberForm, email: e.target.value })
                }
                className="bg-background border-border"
              />

              <Select
                value={newMemberForm.role}
                onValueChange={(value) =>
                  setNewMemberForm({ ...newMemberForm, role: value })
                }
              >
                <SelectTrigger className="bg-background border-border">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div
                className={`flex flex-col items-center justify-center gap-2 rounded-md border p-4 text-center transition ${
                  isDragging
                    ? "border-accent bg-accent/10"
                    : "border-border bg-background"
                }`}
                onClick={(e) => {
                  fileInputRef.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  const file = e.dataTransfer.files?.[0];
                  if (!file) return;
                  if (!file.type.startsWith("image/")) return;
                  if (imagePreview) {
                    URL.revokeObjectURL(imagePreview);
                  }
                  setNewMemberForm((prev) => ({ ...prev, imageFile: file }));
                  setImagePreview(URL.createObjectURL(file));
                  setSelectedImage(file);
                }}
              >
                {imagePreview || newMemberForm.photo.url ? (
                  <img
                    src={imagePreview || newMemberForm.photo.url}
                    alt="Preview"
                    className="h-28 w-28 rounded-full object-cover"
                  />
                ) : (
                  <>
                    <ImagePlus className="text-foreground/60" />
                    <p className="text-sm text-foreground/70">
                      Drag & drop an image, or click to browse
                    </p>
                    <p className="text-xs text-foreground/50">
                      JPG, PNG, SVG up to 5MB
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (imagePreview) {
                      URL.revokeObjectURL(imagePreview);
                    }
                    setNewMemberForm((prev) => ({ ...prev, imageFile: file }));
                    setImagePreview(URL.createObjectURL(file));
                    setSelectedImage(file);
                  }}
                />
              </div>

              {imagePreview ||
                (newMemberForm.photo.url && (
                  <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-background p-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={imagePreview || newMemberForm.photo.url}
                        alt="Selected preview"
                        className="h-16 w-16 rounded-full object-cover"
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={removeImage}>
                      <X className="size-4" />
                      Remove
                    </Button>
                  </div>
                ))}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => handleDialogOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={!newMemberForm.name || !newMemberForm.email || saving}
                onClick={() => {
                  if (!newMemberForm.name || !newMemberForm.email || saving)
                    return;
                  handleAddMember();
                }}
                className={`bg-accent ${saving ? "opacity-50 cursor-not-allowed" : "hover:bg-accent/90"} text-accent-foreground font-medium`}
              >
                {saving ? (
                  <>
                    Saving... <Loader className="animate-spin" />
                  </>
                ) : editData._id ? (
                  "Update Member"
                ) : (
                  `Add ${activeTab === "staff" ? "Staff Member" : "Volunteer"}`
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Staff/Volunteers Table */}
      {(activeTab === "staff" || activeTab === "volunteers") &&
        staff.length > 0 && (
          <Card className="overflow-hidden h-screen">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Photo
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Role
                    </th>

                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Join Date
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map((member) => (
                    <tr
                      key={member._id}
                      className="border-b border-border hover:bg-background/50"
                    >
                      <td className="px-6 py-4 text-foreground">
                        <img
                          src={member.photo?.url || "/user.avif"}
                          alt={member.name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      </td>
                      <td className="px-6 py-4 text-foreground">
                        {member.name}
                      </td>
                      <td className="px-6 py-4 text-foreground/70">
                        {member.role}
                      </td>

                      <td className="px-6 py-4 text-foreground/70">
                        <div className="flex items-center gap-2">
                          <Mail size={14} />
                          {member.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-foreground/70">
                        <div className="flex items-center gap-2">
                          <Phone size={14} />
                          {member.phone}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-foreground/70">
                        {member.createdAt
                          ? new Date(member.createdAt).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={member.status}
                          onChange={(e) =>
                            handleStatusChange(
                              member._id,
                              e.target.value as "active" | "inactive",
                            )
                          }
                          className={`px-2 py-1 rounded text-xs font-medium border-0 cursor-pointer ${
                            member.status === "active"
                              ? "bg-accent/10 text-accent"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        {/* 3 dot menu options */}
                        <div className="flex gap-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                              >
                                <MoreVertical size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                className="hover:text-white"
                                onClick={() => setViewDetailsId(member._id)}
                              >
                                <Eye /> View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="hover:text-white"
                                onClick={() => {
                                  setShowAddForm(true);
                                  setEditData(member);
                                  handleEdit(member);
                                }}
                              >
                                <Edit />
                                Edit Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="hover:text-white"
                                onClick={() => setShowAddSocialLink(member._id)}
                              >
                                <UserRoundPlus /> Add Social Link
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className={`hover:text-white ${saving ? "items-center justify-center text-red-500" : ""}`}
                                onClick={() => handleDelete(member._id)}
                              >
                                {saving ? (
                                  <>
                                    Deleting...{" "}
                                    <Loader className="animate-spin" />
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="text-red-600" /> Delete
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

      {/* Newsletter Subscribers Table */}
      {activeTab === "subscribers" && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    Subscribed Date
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSubscribers.map((subscriber) => (
                  <tr
                    key={subscriber.id}
                    className="border-b border-border hover:bg-background/50"
                  >
                    <td className="px-6 py-4 text-foreground">
                      {subscriber.name}
                    </td>
                    <td className="px-6 py-4 text-foreground/70">
                      <div className="flex items-center gap-2">
                        <Mail size={14} />
                        {subscriber.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-foreground/70">
                      {subscriber.subscribedDate}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          subscriber.status === "active"
                            ? "bg-accent/10 text-accent"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {subscriber.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {((activeTab !== "subscribers" &&
        staff.length === 0 &&
        filteredStaff.length === 0) ||
        (activeTab === "subscribers" && subscribers.length === 0)) && (
        <Card className="p-8 text-center">
          <span className="flex items-center justify-center">
            <img src="/no-staff.avif" className="w-60 h-60" alt="" />
          </span>
          <p className="text-foreground/70">
            {activeTab === "subscribers"
              ? "No subscribers found  "
              : `No ${activeTab} members found, start by adding a new ${activeTab === "staff" ? "staff member" : "volunteer"}!`}
          </p>
        </Card>
      )}

      {/* View Details Dialog */}
      <Dialog
        open={viewDetailsId !== null}
        onOpenChange={(open) => {
          if (!open) setViewDetailsId(null);
        }}
      >
        <DialogContent className="w-full max-h-200 overflow-y-auto bg-card max-w-md">
          <DialogHeader>
            <DialogTitle>Staff Member Details</DialogTitle>
          </DialogHeader>
          {viewDetailsId && staff.find((s) => s._id === viewDetailsId) && (
            <div className="space-y-4  ">
              {(() => {
                const member = staff.find((s) => s._id === viewDetailsId);
                return member ? (
                  <>
                    <div className="w-full shadow-md object-contain h-100 flex items-center justify-center flex-1">
                      <img
                        className="w-full h-full"
                        src={member.photo?.url || "/user.avif"}
                      />
                    </div>
                    <div className="border-b border-border pb-2">
                      <p className="text-sm font-medium text-foreground/70">
                        Name
                      </p>
                      <p className="text-foreground">{member.name}</p>
                    </div>
                    <div className="border-b border-border pb-2">
                      <p className="text-sm font-medium text-foreground/70">
                        Role
                      </p>
                      <p className="text-foreground">{member.role}</p>
                    </div>

                    <div className="border-b border-border pb-2">
                      <p className="text-sm font-medium text-foreground/70">
                        Email
                      </p>
                      <p className="text-foreground">{member.email}</p>
                    </div>
                    <div className="border-b border-border pb-2">
                      <p className="text-sm font-medium text-foreground/70">
                        Phone
                      </p>
                      <p className="text-foreground">{member.phone}</p>
                    </div>
                    <div className="border-b border-border pb-2">
                      <p className="text-sm font-medium text-foreground/70">
                        Join Date
                      </p>
                      <p className="text-foreground">
                        {member?.createdAt
                          ? new Date(member.createdAt).toLocaleDateString()
                          : "Not provided"}
                      </p>
                    </div>
                    <div className="border-b border-border pb-2">
                      <p className="text-sm font-medium text-foreground/70">
                        Status
                      </p>
                      <p className="text-foreground capitalize">
                        {member.status}
                      </p>
                    </div>
                    <div className="border-b border-border pb-2">
                      <p className="text-sm font-medium text-foreground/70 mb-2">
                        Social Links
                      </p>
                      {member.socialLinks && member.socialLinks.length > 0 ? (
                        <ul className="space-y-1">
                          {member.socialLinks.map((link, idx) => (
                            <li key={idx} className="text-foreground text-sm">
                              <a
                                href={link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accent hover:underline"
                              >
                                {link}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-foreground/60 text-sm">
                          No social links added
                        </p>
                      )}
                    </div>
                  </>
                ) : null;
              })()}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDetailsId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Social Link Dialog */}
      <Dialog
        open={showAddSocialLink !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddSocialLink(null);
            setSocialLinkForm({ platform: "", url: "" });
          }
        }}
      >
        <DialogContent preventDismiss className="w-full bg-card max-w-md">
          <DialogHeader>
            <DialogTitle>Add Social Link</DialogTitle>
            <DialogDescription>
              Add a social media link for this staff member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Platform (e.g., Twitter, LinkedIn, Facebook)"
              value={socialLinkForm.platform}
              onChange={(e) =>
                setSocialLinkForm({
                  ...socialLinkForm,
                  platform: e.target.value,
                })
              }
              className="bg-background border-border"
            />
            <Input
              placeholder="URL"
              value={socialLinkForm.url}
              onChange={(e) =>
                setSocialLinkForm({
                  ...socialLinkForm,
                  url: e.target.value,
                })
              }
              className="bg-background border-border"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddSocialLink(null);
                setSocialLinkForm({ platform: "", url: "" });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (showAddSocialLink && socialLinkForm.url) {
                  setStaff(
                    staff.map((member) =>
                      member._id === showAddSocialLink
                        ? {
                            ...member,
                            socialLinks: [
                              ...member.socialLinks,
                              socialLinkForm.url,
                            ],
                          }
                        : member,
                    ),
                  );
                  setShowAddSocialLink(null);
                  setSocialLinkForm({ platform: "", url: "" });
                }
              }}
              disabled={!socialLinkForm.url}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              Add Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
