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
  Eye,
  EyeOff,
  ImagePlus,
  X,
  MoreVertical,
  Star,
  Send,
  Loader,
  Edit,
  FileUpIcon,
} from "lucide-react";
import { on } from "events";
import { set } from "react-hook-form";
import { apiRequest } from "@/lib/query-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { url } from "inspector";
import { toast } from "@/hooks/use-toast";
import { ListPagination } from "@/components/dashboard/list-pagination";

const PAGE_SIZE = 25;

interface Comment {
  id: string;
  author: string;
  text: string;
  date: string;
  avatar?: string;
}

interface BlogPost {
  _id: string;
  title: string;
  author: string;
  category: string;
  status: "published" | "draft";
  excerpt: string;
  content: string;
  videoId?: string;
  image?: {
    url: string;
    public_id: string;
  };
  featured?: boolean;
  comments?: Comment[];
  createdAt?: null | string;
  isFeatured?: boolean;
}

export default function BlogsPage() {
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<BlogPost>>({});
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [viewingBlog, setViewingBlog] = useState<BlogPost | null>(null);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const {
    data: blogData,
    isLoading,
    error,
  } = useQuery<any[]>({
    queryKey: ["blogs", "all", page],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `/blogs/all?page=${page}&limit=${PAGE_SIZE}`,
      );
      return response.json();
    },
  });

  useEffect(() => {
    if (blogData) {
      setBlogs(blogData);
    }
  }, [blogData]);

  const categoryOptions = [
    "Impact",
    "Education",
    "Events",
    "General",
    "Updates",
  ];

  const [newBlogForm, setNewBlogForm] = useState({
    title: "",
    excerpt: "",
    author: "",
    content: "",
    imageUrl: "",
    videoId: "",
    category: "",
    image: { url: "", public_id: "" } as {
      url: string;
      public_id: string;
    } | null,
  });

  const resetNewBlogForm = () => {
    setNewBlogForm({
      title: "",
      excerpt: "",
      author: "",
      content: "",
      imageUrl: "",
      videoId: "",
      category: "",
      image: { url: "", public_id: "" } as {
        url: string;
        public_id: string;
      } | null,
    });
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(null);
    setSelectedImage(null);
    setEditData({});
  };

  const handleDialogOpenChange = (open: boolean) => {
    setShowAddDialog(open);
    if (!open) {
      resetNewBlogForm();
    }
  };

  const removeImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setNewBlogForm((prev) => ({
      ...prev,
      imageUrl: "",
      image: { url: "", public_id: "" },
    }));
    setImagePreview(null);
  };

  const categories = [
    "All",
    ...Array.from(new Set(blogs.map((b) => b.category))),
  ];
  const statuses = ["All", "published", "draft"];

  const filteredBlogs = useMemo(() => {
    return blogs.filter((blog) => {
      const matchesSearch =
        blog.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        blog.author.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === "All" || blog.category === selectedCategory;
      const matchesStatus =
        selectedStatus === "All" || blog.status === selectedStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [blogs, searchTerm, selectedCategory, selectedStatus]);

  const handleEdit = (blog: any) => {
    setNewBlogForm({
      title: blog.title,
      excerpt: blog.excerpt,
      author: blog.author,
      content: blog.content,
      imageUrl: blog.image?.public_id ? "" : blog.image?.url || "",
      image: blog.image && blog.image.url ? blog.image : null,
      videoId: blog.videoId || "",
      category: blog.category,
    });
    setEditData(blog);
    setSelectedImage(null);
  };

  const handleDelete = async (id: string) => {
    try {
      setSaving(true);

      const response = await apiRequest("DELETE", `/blogs/delete/${id}`);
      if (!response.ok) throw new Error("Failed to delete blog post");
      setBlogs(blogs.filter((blog) => blog._id !== id));
      toast({
        title: "Blog post deleted",
        description: "The blog post was deleted successfully.",
      });
    } catch (error) {
      console.error("Error deleting blog post:", error);
      toast({
        variant: "destructive",
        title: "Unable to delete blog post",
        description: "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = (id: string, newStatus: "published" | "draft") => {
    setBlogs(
      blogs.map((blog) =>
        blog._id === id ? { ...blog, status: newStatus } : blog,
      ),
    );
  };

  const handleViewBlog = (blog: BlogPost) => {
    setViewingBlog(blog);
    setShowViewDialog(true);
  };

  const handleToggleFeatured = async (id: string) => {
    try {
      const res = await apiRequest("PUT", `/blogs/${id}/toggle-featured`);
      if (res.ok) {
        setBlogs(
          blogs.map((blog) =>
            blog._id === id ? { ...blog, featured: !blog.featured } : blog,
          ),
        );
        toast({
          title: "Featured status updated",
          description: "The blog post's featured status was updated.",
        });
      } else {
        throw new Error("Failed to update featured status");
      }

      setOpenMenuId(null);
    } catch (error) {
      console.error("Error updating featured status:", error);
      toast({
        variant: "destructive",
        title: "Unable to update featured status",
        description: "Please try again.",
      });
    }
  };

  const handlePublish = async (id: string) => {
    try {
      const res = await apiRequest("PUT", `/blogs/publish/blog/${id}`);

      if (res.ok) {
        setBlogs(
          blogs.map((blog) =>
            blog._id === id ? { ...blog, status: "published" } : blog,
          ),
        );
        toast({
          title: "Blog post published",
          description: "The blog post was published successfully.",
        });
      } else {
        throw new Error("Failed to publish blog post");
      }
    } catch (error) {
      console.error("Error publishing blog post:", error);
      toast({
        variant: "destructive",
        title: "Unable to publish blog post",
        description: "Please try again.",
      });
    } finally {
      setOpenMenuId(null);
    }
  };

  const handleAddComment = (blogId: string) => {
    if (!commentText.trim()) return;

    setBlogs(
      blogs.map((blog) => {
        if (blog._id === blogId) {
          const newComment: Comment = {
            id: `c-${Date.now()}`,
            author: "Admin",
            text: commentText,
            date: new Date().toISOString().split("T")[0],
          };
          return {
            ...blog,
            comments: [...(blog.comments || []), newComment],
          };
        }
        return blog;
      }),
    );

    if (viewingBlog?._id === blogId) {
      const updatedBlog = blogs.find((b) => b._id === blogId);
      if (updatedBlog) {
        setViewingBlog(updatedBlog);
      }
    }
    setCommentText("");
  };

  const handleAddNew = async () => {
    try {
      setSaving(true);
      let imageData = null;

      if (selectedImage) {
        imageData = await uploadImageToCloudinary(selectedImage);
      }
      // if (!newBlogForm.title || !newBlogForm.author) return;

      const currentBlog = editData._id
        ? blogs.find((blog) => blog._id === editData._id)
        : undefined;
      const payLoad = {
        title: newBlogForm.title,
        author: newBlogForm.author,
        category: newBlogForm.category || "General",
        status: editData._id
          ? currentBlog?.status || editData.status || "draft"
          : "draft",
        excerpt: newBlogForm.excerpt,
        content: newBlogForm.content,
        videoId: newBlogForm.videoId,
        imageUrl: newBlogForm.imageUrl,
        image: imageData
          ? { url: imageData.secure_url, public_id: imageData.public_id }
          : newBlogForm.imageUrl.trim()
            ? { url: "", public_id: "" }
            : {
                url: newBlogForm.image?.url || "",
                public_id: newBlogForm.image?.public_id || "",
              },
      };

      if (editData && editData._id) {
        const response = await apiRequest(
          "PUT",
          `/blogs/${editData._id}/update`,
          payLoad,
        );
        if (!response.ok) throw new Error("Failed to update blog post");

        await queryClient.invalidateQueries({ queryKey: ["blogs", "all"] });
      } else {
        const response = await apiRequest("POST", "/blogs/new", payLoad);
        const data = await response.json();
        const createdBlog = data.blog as BlogPost | undefined;
        if (!createdBlog?._id)
          throw new Error("The server did not return the created blog");

        setBlogs((currentBlogs) => [
          createdBlog,
          ...currentBlogs.filter((blog) => blog._id !== createdBlog._id),
        ]);

        await queryClient.invalidateQueries({ queryKey: ["blogs", "all"] });
        queryClient.setQueryData<BlogPost[]>(
          ["blogs", "all", page],
          (currentBlogs = []) => [
            createdBlog,
            ...currentBlogs.filter((blog) => blog._id !== createdBlog._id),
          ],
        );
      }

      resetNewBlogForm();
      setShowAddDialog(false);
      toast({
        title: editData?._id ? "Blog post updated" : "Blog post created",
        description: editData?._id
          ? "The blog post was updated successfully."
          : "The blog post was created successfully.",
      });
    } catch (error) {
      setSaving(false);
      console.error("Error uploading image:", error);
      toast({
        variant: "destructive",
        title: "Unable to save blog post",
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
          Blog Management
        </h2>
        <ListPagination
          page={page}
          hasNextPage={blogs.length === PAGE_SIZE}
          onPageChange={setPage}
        />
        <p className="text-foreground/70">
          Create, edit, and manage blog posts
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <p className="text-foreground/60 text-sm mb-2">Total Posts</p>
          <p className="text-3xl font-bold text-foreground">{blogs.length}</p>
        </Card>
        <Card className="p-6">
          <p className="text-foreground/60 text-sm mb-2">Published</p>
          <p className="text-3xl font-bold text-accent">
            {blogs.filter((b) => b.status === "published").length}
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-foreground/60 text-sm mb-2">Drafts</p>
          <p className="text-3xl font-bold text-primary">
            {blogs.filter((b) => b.status === "draft").length}
          </p>
        </Card>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Search Posts
          </label>
          <Input
            type="text"
            placeholder="Search by title or author..."
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
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Status
          </label>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground"
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <Button
            onClick={() => setShowAddDialog(true)}
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-medium"
          >
            + New Blog Post
          </Button>
        </div>
      </div>

      {/* Add Blog Dialog */}
      <Dialog open={showAddDialog} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          preventDismiss
          className="w-full  max-h-160 overflow-y-auto bg-card max-w-2xl"
        >
          <DialogHeader>
            <DialogTitle>Create New Blog Post</DialogTitle>
            <DialogDescription>
              Fill in the details below. You can provide an image URL or upload
              a file.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            <Input
              placeholder="Title"
              value={newBlogForm.title}
              onChange={(e) =>
                setNewBlogForm({ ...newBlogForm, title: e.target.value })
              }
              className="bg-background border-border"
            />

            <Input
              placeholder="Author"
              value={newBlogForm.author}
              onChange={(e) =>
                setNewBlogForm({ ...newBlogForm, author: e.target.value })
              }
              className="bg-background border-border"
            />

            <Select
              value={newBlogForm.category}
              onValueChange={(value) =>
                setNewBlogForm({ ...newBlogForm, category: value })
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
              placeholder="Excerpt"
              value={newBlogForm.excerpt}
              onChange={(e) =>
                setNewBlogForm({ ...newBlogForm, excerpt: e.target.value })
              }
              className="bg-background border-border"
            />

            <Textarea
              placeholder="Content"
              value={newBlogForm.content}
              onChange={(e) =>
                setNewBlogForm({ ...newBlogForm, content: e.target.value })
              }
              className="bg-background min-h-96 max-h-96 border-border"
            />

            <Input
              placeholder="Image URL (optional)"
              value={newBlogForm.imageUrl}
              onChange={(e) => {
                setNewBlogForm({ ...newBlogForm, imageUrl: e.target.value });
                setImagePreview(e.target.value);
              }}
              className="bg-background border-border"
            />
            <Input
              placeholder="Video ID (optional)"
              value={newBlogForm.videoId}
              onChange={(e) => {
                setNewBlogForm({ ...newBlogForm, videoId: e.target.value });
              }}
              className="bg-background border-border"
            />

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
                setSelectedImage(file);
                setImagePreview(URL.createObjectURL(file));
              }}
            >
              {imagePreview ? (
                <img
                  src={
                    imagePreview ||
                    newBlogForm.imageUrl ||
                    newBlogForm.image?.url ||
                    ""
                  }
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
                  setImagePreview(URL.createObjectURL(file));
                  setSelectedImage(file);
                }}
              />
            </div>

            {(imagePreview ||
              newBlogForm.imageUrl ||
              newBlogForm.image?.url) && (
              <div className="flex items-center justify-between gap-4 rounded-md border border-border bg-background p-3">
                <div className="flex items-center gap-3">
                  <img
                    src={`${imagePreview || newBlogForm.imageUrl || newBlogForm.image?.url || ""}`}
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
                  Saving... <Loader className="animate-spin" />
                </>
              ) : editData && editData._id ? (
                "Update Post"
              ) : (
                "Add Blog Post"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Blog Details Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="w-full bg-card max-w-3xl max-h-[90vh] overflow-y-auto">
          {viewingBlog && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">
                  {viewingBlog.title}
                </DialogTitle>
                <DialogDescription>
                  By {viewingBlog.author} •{" "}
                  {viewingBlog.createdAt
                    ? new Date(viewingBlog.createdAt).toLocaleDateString()
                    : "Not provided"}{" "}
                  • {viewingBlog.category}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                {/* Featured Badge */}
                {viewingBlog.featured && (
                  <div className="flex items-center gap-2 text-sm bg-yellow-100/20 text-yellow-700 px-3 py-2 rounded">
                    <Star size={16} fill="currentColor" />
                    This is a featured post
                  </div>
                )}

                {/* Featured Image */}
                {viewingBlog.image?.url && (
                  <div className="relative w-full h-64 rounded-lg overflow-hidden">
                    <img
                      src={viewingBlog.image.url}
                      alt={viewingBlog.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Status */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground/70">
                    Status:
                  </span>
                  <span
                    className={`px-3 py-1 rounded text-xs font-medium ${
                      viewingBlog.status === "published"
                        ? "bg-accent/10 text-accent"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {viewingBlog.status}
                  </span>
                </div>

                {/* Excerpt */}
                <div>
                  <h4 className="font-semibold text-foreground mb-2">
                    Summary
                  </h4>
                  <p className="text-foreground/70">{viewingBlog.excerpt}</p>
                </div>

                {/* Full Content */}
                <div>
                  <h4 className="font-semibold text-foreground mb-2">
                    Content
                  </h4>
                  <p className="text-foreground/70 text-justify whitespace-pre-wrap">
                    {viewingBlog.content}
                  </p>
                </div>

                {/* Comments Section */}
                <div className="border-t hidden border-border pt-6">
                  <h4 className="font-semibold text-foreground mb-4">
                    Comments ({viewingBlog.comments?.length || 0})
                  </h4>

                  {/* Comment Input */}
                  <div className="mb-6 p-4 bg-background rounded-lg border border-border">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <textarea
                          value={commentText}
                          onChange={(e) => setCommentText(e.target.value)}
                          placeholder="Add a comment..."
                          className="w-full px-3 py-2 bg-background border border-border rounded text-foreground text-sm resize-none"
                          rows={3}
                        />
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button
                        onClick={() => handleAddComment(viewingBlog._id)}
                        size="sm"
                        className="bg-accent hover:bg-accent/90 text-accent-foreground"
                      >
                        <Send size={14} className="mr-1" />
                        Post Comment
                      </Button>
                    </div>
                  </div>

                  {/* Comments List */}
                  <div className="space-y-4 bg-card">
                    {viewingBlog.comments && viewingBlog.comments.length > 0 ? (
                      viewingBlog.comments.map((comment) => (
                        <div
                          key={comment.id}
                          className="p-3 bg-background border border-border rounded-lg"
                        >
                          <div className="flex items-start gap-3">
                            {comment.avatar && (
                              <img
                                src={comment.avatar}
                                alt={comment.author}
                                className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                              />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-sm text-foreground">
                                  {comment.author}
                                </p>
                                <p className="text-xs text-foreground/60">
                                  {comment.date}
                                </p>
                              </div>
                              <p className="text-sm text-foreground/70 mt-1">
                                {comment.text}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-foreground/60 text-sm py-4">
                        No comments yet
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      {blogs && filteredBlogs.length > 0 && (
        <Card className="overflow-hidden h-screen">
          <div className="overflow-x-auto flex-1">
            <table className="w-full">
              <thead className="bg-background border-b border-border">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    Author
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-foreground">
                    Creation Date
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
                {filteredBlogs.map((blog) => (
                  <tr
                    key={blog._id}
                    className="border-b border-border hover:bg-background/50"
                  >
                    <td className="px-6 py-4 truncate line-clamp-1 text-sm text-foreground">
                      {blog.title}
                    </td>
                    <td className="px-6 py-4 text-foreground/70">
                      {blog.author}
                    </td>
                    <td className="px-6 py-4 text-foreground/70">
                      {blog.category}
                    </td>
                    <td className="px-6 py-4 text-foreground/70">
                      {new Date(blog.createdAt || "").toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                          blog.status === "published"
                            ? "bg-accent/10 text-accent"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {blog.status === "published" ? (
                          <Eye size={14} />
                        ) : (
                          <EyeOff size={14} />
                        )}
                        {blog.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="relative">
                        <button
                          onClick={() =>
                            setOpenMenuId(
                              openMenuId === blog._id ? null : blog._id,
                            )
                          }
                          className="p-2 hover:bg-background rounded transition-colors text-foreground/60 hover:text-foreground"
                        >
                          <MoreVertical size={20} />
                        </button>

                        {openMenuId === blog._id && (
                          <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-lg shadow-lg z-50 py-2">
                            {/* View */}
                            <button
                              onClick={() => {
                                handleViewBlog(blog);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-background/50 flex items-center gap-2 transition-colors"
                            >
                              <Eye size={16} />
                              View Details
                            </button>

                            {/* Edit */}
                            <button
                              onClick={() => {
                                handleEdit(blog);
                                setShowAddDialog(true);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-background/50 flex items-center gap-2 transition-colors"
                            >
                              <Edit size={16} />
                              Edit
                            </button>

                            {/* Set Featured */}
                            <button
                              onClick={() => handleToggleFeatured(blog._id)}
                              className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                                blog.isFeatured
                                  ? "text-yellow-400 fill-yellow-400 hover:bg-yellow-50/10"
                                  : "text-foreground hover:bg-background/50"
                              } `}
                            >
                              <Star
                                size={16}
                                // fill={blog.isFeatured ? "yellow" : "none"}
                                className={`${blog.isFeatured ? "text-yellow-400 fill-yellow-400" : ""}`}
                              />
                              {blog.isFeatured ? "Unfeature" : "Set Featured"}
                            </button>

                            {/* Publish (only for drafts) */}
                            {blog.status === "draft" && (
                              <button
                                onClick={() => handlePublish(blog._id)}
                                className="w-full text-left px-4 py-2 text-sm text-foreground hover:bg-background/50 flex items-center gap-2 transition-colors"
                              >
                                <FileUpIcon size={16} />
                                Publish
                              </button>
                            )}

                            {/* Delete */}
                            <div className="border-t border-border my-1"></div>
                            <button
                              onClick={() => {
                                handleDelete(blog._id);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50/10 flex items-center gap-2 transition-colors"
                            >
                              {saving ? (
                                <>
                                  Deleting...{" "}
                                  <Loader className="animate-spin" />
                                </>
                              ) : (
                                <>
                                  {" "}
                                  <Trash2 size={16} />
                                  Delete
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {blogs.length === 0 && (
        <Card className="p-8 text-center">
          <span className="flex items-center justify-center w-full">
            {" "}
            <img
              src="/no-news.png"
              className="w-100 h-120 align-middle text-center justify-self-center"
              alt=""
            />
          </span>
          <p className="text-foreground/70">
            No blog posts found. Click "New Blog Post" to create your first one!
          </p>
        </Card>
      )}
      {blogs.length > 0 && filteredBlogs.length === 0 && (
        <Card className="p-8 text-center">
          <span className="flex items-center justify-center w-full">
            {" "}
            <img
              src="/no-campaign.png"
              className="w-100 h-120 align-middle text-center justify-self-center"
              alt=""
            />
          </span>
          <p className="text-foreground/70">
            No blog posts found matching your filters. Try adjusting your search
            or filter criteria.
          </p>
        </Card>
      )}
    </div>
  );
}
