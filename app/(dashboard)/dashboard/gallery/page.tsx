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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trash2,
  Edit2,
  Upload,
  Image as ImageIcon,
  ImagePlus,
  X,
  MoreVertical,
  Loader,
} from "lucide-react";
import { set } from "react-hook-form";
import { url } from "inspector";
import { apiRequest } from "@/lib/query-client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { ListPagination } from "@/components/dashboard/list-pagination";

const PAGE_SIZE = 25;

function normalizeGalleryImages(payload: unknown): GalleryImage[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const data = payload as Record<string, unknown>;
  const candidates = [
    data.gallery,
    data.galleryItems,
    data.images,
    data.items,
    data.data,
  ];
  const list = candidates.find(Array.isArray);
  return Array.isArray(list) ? (list as GalleryImage[]) : [];
}

function normalizeCreatedGalleryImage(payload: unknown): GalleryImage | null {
  if (!payload || typeof payload !== "object") return null;
  if (Array.isArray(payload)) return null;

  const data = payload as Record<string, unknown>;
  const candidate = (data.newGalleryItem ||
    data.galleryItem ||
    data.image ||
    data.gallery ||
    payload) as unknown;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate))
    return null;

  const image = candidate as Partial<GalleryImage>;
  return typeof image._id === "string" ? (image as GalleryImage) : null;
}

interface GalleryImage {
  _id: string;
  title: string;
  category: string;
  url: string;
  uploadDate: string;
  size: string;
  featured: boolean;
  image?: {
    url: string;
    public_id: string;
    size: string | number;
  };
  createdAt: string;
}

export default function GalleryPage() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<GalleryImage>>({});
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [page, setPage] = useState(1);

  const categoryOptions = ["Events", "Education", "Volunteers", "General"];

  const { data: galleryData, refetch } = useQuery<GalleryImage[]>({
    queryKey: ["gallery", "all", page],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/gallery/all?page=${page}&limit=${PAGE_SIZE}`,
      );
      return normalizeGalleryImages(await response.json());
    },
  });

  const [newImageForm, setNewImageForm] = useState({
    title: "",
    category: "",
    imageUrl: "",
    image: { url: "", public_id: "", size: "0MB" } as {
      url: string;
      public_id: string;
      size: string;
    } | null,
  });

  useEffect(() => {
    if (galleryData) {
      setImages(galleryData);
    }
  }, [galleryData]);

  const resetNewImageForm = () => {
    setNewImageForm({
      title: "",
      category: "",
      imageUrl: "",
      image: { url: "", public_id: "", size: "0MB" } as {
        url: string;
        public_id: string;
        size: string;
      } | null,
    });
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(null);
    setSelectedImage(null);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setShowAddDialog(open);
    if (!open) {
      resetNewImageForm();
      setFormError("");
    }
  };

  const selectImage = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFormError("Select a valid image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError("Images must be 5 MB or smaller.");
      return;
    }
    setFormError("");
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const validateNewImage = () => {
    if (newImageForm.title.trim().length < 2) {
      setFormError("Title must be at least 2 characters.");
      return false;
    }
    if (!newImageForm.category.trim()) {
      setFormError("Category is required.");
      return false;
    }
    if (!selectedImage && !newImageForm.imageUrl.trim()) {
      setFormError("Select an image or provide an image URL.");
      return false;
    }
    if (
      newImageForm.imageUrl.trim() &&
      !/^https?:\/\/[^\s]+$/i.test(newImageForm.imageUrl.trim())
    ) {
      setFormError("Image URL must be a valid http or https URL.");
      return false;
    }
    setFormError("");
    return true;
  };

  const removeImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setNewImageForm((prev) => ({ ...prev, imageFile: null }));
    setImagePreview(null);
    setSelectedImage(null);
  };

  const categories = [
    "All",
    ...Array.from(
      new Set(
        images
          .filter((image): image is GalleryImage => Boolean(image?.category))
          .map((image) => image.category),
      ),
    ),
  ];

  const filteredImages = useMemo(() => {
    return images.filter((image): image is GalleryImage => {
      if (!image || typeof image !== "object") return false;
      if (!image.category) return false;

      const matchesSearch = (image.title || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === "All" || image.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [images, searchTerm, selectedCategory]);

  const handleEdit = (image: GalleryImage) => {
    setEditingId(image._id);
    setEditData(image);
    setShowEditDialog(true);
  };

  const handleSave = async (id: string) => {
    if (!editData.title?.trim() || editData.title.trim().length < 2) {
      setFormError("Title must be at least 2 characters.");
      return;
    }
    if (!editData.category?.trim()) {
      setFormError("Category is required.");
      return;
    }
    try {
      const res = await apiRequest("PUT", `/gallery/${id}/update`, editData);
      if (res.ok) {
        setImages(
          images.map((image) =>
            image._id === id ? { ...image, ...editData } : image,
          ),
        );
        toast({
          title: "Image updated",
          description: "The gallery image was updated successfully.",
        });
      } else {
        throw new Error("Failed to update gallery image");
      }
    } catch (error) {
      console.error("Error updating image:", error);
      toast({
        variant: "destructive",
        title: "Unable to update image",
        description: "Please try again.",
      });
    }
    setEditingId(null);
    setEditData({});
    setFormError("");
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditData({});
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const response = await apiRequest("DELETE", `/gallery/${id}/delete`);
      if (!response.ok) throw new Error("Failed to delete gallery image");
      setImages(images.filter((image) => image._id !== id));
      toast({
        title: "Image deleted",
        description: "The gallery image was deleted successfully.",
      });
    } catch (error) {
      console.error("Error deleting image:", error);
      toast({
        variant: "destructive",
        title: "Unable to delete image",
        description: "Please try again.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleToggleFeatured = (id: string) => {
    setImages(
      images.map((image) =>
        image._id === id ? { ...image, featured: !image.featured } : image,
      ),
    );
  };

  const handleAddNew = async () => {
    if (!validateNewImage()) return;

    try {
      setSaving(true);
      let imageData = null;
      if (selectedImage) {
        imageData = await uploadImageToCloudinary(selectedImage);
      }
      // if (!newImageForm.title) return;

      const newImage = {
        title: newImageForm.title.trim(),
        category: newImageForm.category.trim(),
        featured: false,
        imageUrl: newImageForm.imageUrl.trim(),
        image: {
          url: imageData?.secure_url || "",
          public_id: imageData?.public_id || "",
          size: imageData
            ? (imageData.bytes / (1024 * 1024)).toFixed(1) + "MB"
            : "0MB",
        } as {
          url: string;
          public_id: string;
          size: string;
        },
      };

      const res = await apiRequest("POST", "/gallery/new", newImage);

      if (res.ok) {
        const createdImage = normalizeCreatedGalleryImage(await res.json());
        if (!createdImage) {
          await refetch();
        } else {
          setImages((currentImages) => [
            createdImage,
            ...currentImages.filter((image) => image._id !== createdImage._id),
          ]);
        }
      } else {
        throw new Error("Failed to create gallery image");
      }
      resetNewImageForm();
      setShowAddDialog(false);
      toast({
        title: "Image uploaded",
        description: "The gallery image was added successfully.",
      });
    } catch (error) {
      console.error("Error uploading image:", error);
      toast({
        variant: "destructive",
        title: "Unable to upload image",
        description: "Please try again.",
      });
    } finally {
      setSaving(false);
    }
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
          Gallery Management
        </h2>
        <ListPagination
          page={page}
          hasNextPage={images.length === PAGE_SIZE}
          onPageChange={setPage}
        />
        <p className="text-foreground/70">
          Manage gallery images and organize by category
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <p className="text-foreground/60 text-sm mb-2">Total Images</p>
          <p className="text-3xl font-bold text-foreground">{images.length}</p>
        </Card>
        <Card className="p-6">
          <p className="text-foreground/60 text-sm mb-2">Featured</p>
          <p className="text-3xl font-bold text-accent">
            {images.filter((i) => i.featured).length}
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-foreground/60 text-sm mb-2">Total Size</p>
          <p className="text-3xl font-bold text-primary">
            {images
              .reduce(
                (sum, img) =>
                  sum +
                  parseFloat(
                    img.image?.size.toString().replace("MB", "") || "0",
                  ),
                0,
              )
              .toFixed(1)}
            MB
          </p>
        </Card>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Search Images
          </label>
          <Input
            type="text"
            placeholder="Search by title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-background text-foreground border-border"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Category
          </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button
            onClick={() => setShowAddDialog(true)}
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-medium flex items-center justify-center gap-2"
          >
            <Upload size={16} /> Upload Image
          </Button>
        </div>
      </div>

      {/* Add Image Dialog */}
      <Dialog open={showAddDialog} onOpenChange={handleDialogOpenChange}>
        <DialogContent preventDismiss className="w-full bg-card max-w-xl">
          <DialogHeader>
            <DialogTitle>Upload Gallery Image</DialogTitle>
            <DialogDescription>
              Provide a title, category, and optionally upload an image or
              provide a URL.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            <Input
              placeholder="Title"
              value={newImageForm.title}
              onChange={(e) =>
                setNewImageForm({ ...newImageForm, title: e.target.value })
              }
              className="bg-background border-border"
            />

            <Select
              value={newImageForm.category}
              onValueChange={(value) =>
                setNewImageForm({ ...newImageForm, category: value })
              }
            >
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Image URL (optional)"
              value={newImageForm.imageUrl}
              onChange={(e) => {
                setNewImageForm({ ...newImageForm, imageUrl: e.target.value });
                setImagePreview(e.target.value);
              }}
              className="bg-background border-border"
            />

            <div
              className={`flex flex-col items-center justify-center gap-2 rounded-md border p-4 text-center transition ${
                isDragging
                  ? "border-accent bg-accent/10"
                  : "border-border bg-background"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                selectImage(e.dataTransfer.files?.[0]);
              }}
            >
              {imagePreview ? (
                <img
                  src={imagePreview}
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
                  selectImage(e.target.files?.[0]);
                }}
              />
            </div>

            {formError ? (
              <p className="text-sm text-destructive" role="alert">
                {formError}
              </p>
            ) : null}

            {newImageForm.image?.url && imagePreview && (
              <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-background p-3">
                <div className="flex items-center gap-3">
                  <img
                    src={imagePreview}
                    alt="Selected preview"
                    className="h-16 w-16 rounded-full object-cover"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={removeImage}>
                  <X className="size-4" />
                  Remove
                </Button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={saving}
              onClick={handleAddNew}
              className={`bg-accent hover:bg-accent/90 text-accent-foreground font-medium ${saving ? "cursor-not-allowed opacity-70" : ""}`}
            >
              {saving ? (
                <>
                  Saving... <Loader className="animate-spin" />{" "}
                </>
              ) : (
                "Add Image"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Image Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent preventDismiss className="w-full max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Image</DialogTitle>
            <DialogDescription>
              Update the image title and category.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            <Input
              placeholder="Image title"
              value={editData.title || ""}
              onChange={(e) =>
                setEditData({ ...editData, title: e.target.value })
              }
              className="bg-background border-border"
            />

            <Select
              value={editData.category || ""}
              onValueChange={(value) =>
                setEditData({ ...editData, category: value })
              }
            >
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {editData.url && (
              <div className="relative w-full h-48 rounded-lg overflow-hidden border border-border">
                <img
                  src={editData.url}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                handleSave(editingId || "");
                setShowEditDialog(false);
              }}
              className="bg-accent hover:bg-accent/90 text-accent-foreground font-medium"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Images Grid */}
      {images && images.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredImages.map((image) => (
            <div
              key={image?._id}
              className="relative group overflow-hidden rounded-lg shadow-md hover:shadow-lg transition-shadow h-96 bg-background"
            >
              {/* Background Image */}
              <img
                src={image.image?.url}
                alt={image.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />

              {/* Overlay */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4">
                {/* Top section with title and menu */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-semibold text-white text-sm mb-2 line-clamp-2">
                      {image.title}
                    </h3>
                    <span className="inline-block px-2 py-1 bg-white/20 text-white rounded text-xs font-medium">
                      {image.category}
                    </span>
                  </div>
                  <div className="relative ml-2">
                    <button
                      onClick={() =>
                        setOpenMenuId(
                          openMenuId === image._id ? null : image._id,
                        )
                      }
                      className="p-2 hover:bg-white/20 rounded transition-colors text-white"
                    >
                      <MoreVertical size={18} />
                    </button>

                    {openMenuId === image._id && (
                      <div className="absolute right-0 mt-2 w-40 bg-card border border-border rounded-lg shadow-lg z-50 py-1">
                        {/* Edit */}
                        <button
                          onClick={() => {
                            handleEdit(image);
                            setOpenMenuId(null);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-background/50 flex items-center gap-2 transition-colors"
                        >
                          <Edit2 size={14} />
                          Edit
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => {
                            handleDelete(image._id);
                            setOpenMenuId(null);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50/10 flex items-center gap-2 transition-colors"
                        >
                          {deletingId === image._id ? (
                            <>
                              Deleting...{" "}
                              <Loader className="animate-spin" size={12} />
                            </>
                          ) : (
                            <>
                              <Trash2 size={14} />
                              Delete
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom section with stats */}
                <div className="space-y-1 text-xs text-white/80">
                  <div className="flex items-center justify-between">
                    <span>Size: {image.image?.size || "unknown"}</span>
                    {image.featured && (
                      <span className="bg-accent text-accent-foreground px-2 py-0.5 rounded text-xs font-medium">
                        ⭐ Featured
                      </span>
                    )}
                  </div>
                  <div className="text-white/70">
                    Uploaded: {new Date(image.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length > 0 && filteredImages.length === 0 && (
        <Card className="p-8 text-center">
          <span className="flex items-center justify-center w-full">
            {" "}
            <img
              src="/no-images.png"
              className="w-100 h-120 align-middle text-center justify-self-center"
              alt=""
            />
          </span>
          <p className="text-foreground/70">
            No images found matching your filters
          </p>
        </Card>
      )}
      {images.length === 0 && (
        <Card className="p-8 text-center">
          <span className="flex items-center justify-center w-full">
            {" "}
            <img
              src="/no-images3.png"
              className="w-120 h-120 align-middle text-center justify-self-center"
              alt=""
            />
          </span>
          <p className="text-foreground/70">
            No images found yet. Click "Upload Image" to add your first gallery
            image!
          </p>
        </Card>
      )}
    </div>
  );
}
