"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabaseClient";
import { ProtectedRoute } from "../../components/AuthProvider";

export default function ListBookPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    author: "",
    description: "",
    category: "",
    condition: "new",
    price: "",
    original_price: "",
    college_name: "",
    images: [],
  isbn_primary: "",
  isbn_secondary: "",
  });
  const [userId, setUserId] = useState("");

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      const u = data?.user;
      if (u?.id) setUserId(u.id);
  // no need to capture seller name/email here; we use user_id for linkage
    };
    getUser();
  }, []);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (!allowedTypes.includes(file.type)) {
        setError("Only JPG, PNG, and WEBP images are allowed.");
        setImageFile(null);
        return;
      }
      if (file.size > maxSize) {
        setError("Image size must be less than 5MB.");
        setImageFile(null);
        return;
      }
      setError("");
      setImageFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent, asDraft = false) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      let imageUrl = "";
      if (imageFile) {
        // Upload to Cloudinary
        const data = new FormData();
        data.append("file", imageFile);
        data.append("upload_preset", process.env.NEXT_PUBLIC_CLOUDINARY_PRESET!);
        const res = await fetch(`https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`, {
          method: "POST",
          body: data,
        });
        const result = await res.json();
        if (!result.secure_url) {
          let cloudError = "Image upload failed.";
          if (result.error && result.error.message) {
            cloudError += ` Reason: ${result.error.message}`;
          }
          throw new Error(cloudError);
        }
        imageUrl = result.secure_url;
      }
  // Google Books API verification
  let status = asDraft ? "draft" : "pending";
      const primary = (form.isbn_primary || '').replace(/[^0-9Xx]/g, '').toUpperCase();
      const secondary = (form.isbn_secondary || '').replace(/[^0-9Xx]/g, '').toUpperCase();
      const isbnToTry = [primary, secondary].filter(Boolean);
      if (isbnToTry.length > 0) {
        const useIsbn = isbnToTry[0];
        const gbRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${useIsbn}&key=${process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY}`);
        const gbData = await gbRes.json();
        if (gbData.totalItems > 0) {
          const book = gbData.items[0].volumeInfo;
          const inputAuthors = form.author.split(',').map((a: string) => a.trim().toLowerCase());
          const apiAuthors = (book.authors || []).map((a: string) => a.trim().toLowerCase());
          const allAuthorsPresent = inputAuthors.every(a => apiAuthors.includes(a));
          if (
            book.title?.toLowerCase() === form.title.toLowerCase() &&
            allAuthorsPresent
          ) {
            status = "verified";
          }
        }
      }
      // Store in Supabase
      const bookPayload = {
        ...form,
        price: Number(form.price),
        original_price: form.original_price ? Number(form.original_price) : null,
        images: imageUrl ? [imageUrl] : [],
        status,
        user_id: userId,
        // keep legacy isbn for compatibility and search
        isbn: primary || secondary || '',
      };
  const resDb = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookPayload),
      });
      const dbResult = await resDb.json();
      if (!resDb.ok || !dbResult.success) throw new Error(dbResult.error || "Failed to list book");
      setSuccess(true);
      setForm({
        title: "",
        author: "",
        description: "",
        category: "",
        condition: "new",
        price: "",
        original_price: "",
        college_name: "",
        images: [],
        isbn_primary: "",
        isbn_secondary: "",
      });
      setImageFile(null);
      setTimeout(() => router.push('/my-listings'), 1200);
    } catch (err: any) {
      setError(err.message || "Error listing book");
    }
    setLoading(false);
  };

  return (
    <ProtectedRoute>
      <>
        <Navbar />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <form className="bg-white p-8 rounded shadow-md w-full max-w-lg animate-fadeInUp" onSubmit={(e)=>handleSubmit(e, false)}>
          <h2 className="text-2xl font-bold text-indigo-700 mb-6 text-center">List a Book</h2>
            <div className="mb-4">
              <label className="block text-black mb-2">Title</label>
              <input type="text" name="title" value={form.title} onChange={handleChange} required className="w-full px-3 py-2 border rounded text-black" />
            </div>
            <div className="mb-4">
              <label className="block text-black mb-2">Author(s) <span className="text-xs text-black/60">(comma separated)</span></label>
              <input type="text" name="author" value={form.author} onChange={handleChange} required placeholder="e.g. John Doe, Jane Smith" className="w-full px-3 py-2 border rounded text-black" />
            </div>
            <div className="mb-4 grid grid-cols-1 gap-3">
              <div>
                <label className="block text-black mb-1">Primary ISBN (ISBN-13 preferred)</label>
                <input type="text" name="isbn_primary" value={form.isbn_primary} onChange={handleChange} placeholder="e.g. 9780134853987" className="w-full px-3 py-2 border rounded text-black" />
              </div>
              <div>
                <label className="block text-black mb-1">Secondary ISBN (optional, ISBN-10 or other)</label>
                <input type="text" name="isbn_secondary" value={form.isbn_secondary} onChange={handleChange} placeholder="e.g. 0134853989" className="w-full px-3 py-2 border rounded text-black" />
              </div>
              <p className="text-xs text-black/70">Providing both improves matching and avoids duplicate editions.</p>
            </div>
            <div className="mb-4">
              <label className="block text-black mb-2">Description</label>
              <textarea name="description" value={form.description} onChange={handleChange} className="w-full px-3 py-2 border rounded text-black" />
            </div>
            <div className="mb-4">
              <label className="block text-black mb-2">Category</label>
              <input type="text" name="category" value={form.category} onChange={handleChange} className="w-full px-3 py-2 border rounded text-black" />
            </div>
            <div className="mb-4">
              <label className="block text-black mb-2">Condition</label>
              <select name="condition" value={form.condition} onChange={handleChange} className="w-full px-3 py-2 border rounded text-black">
                <option value="new">New</option>
                <option value="like-new">Like New</option>
                <option value="used">Used</option>
                <option value="damaged">Damaged</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-black mb-2">Price</label>
              <input type="number" name="price" value={form.price} onChange={handleChange} required className="w-full px-3 py-2 border rounded text-black" />
            </div>
            <div className="mb-4">
              <label className="block text-black mb-2">Original Price (optional)</label>
              <input type="number" name="original_price" value={form.original_price} onChange={handleChange} className="w-full px-3 py-2 border rounded text-black" />
            </div>
            <div className="mb-4">
              <label className="block text-black mb-2">College Name / Location</label>
              <input type="text" name="college_name" value={form.college_name} onChange={handleChange} required className="w-full px-3 py-2 border rounded text-black" />
            </div>
            <div className="mb-4">
              <label className="block text-black mb-2">Book Image</label>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} className="w-full px-3 py-2 border rounded text-black" />
            </div>
            {error && <p className="text-red-600 mb-4">{error}</p>}
            {success && <p className="text-green-600 mb-4">Book listed successfully!</p>}
            <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded font-semibold hover:bg-indigo-700 transition" disabled={loading}>
              {loading ? "Listing..." : "List Book"}
            </button>
            <button type="button" className="w-full mt-2 border text-indigo-700 py-2 rounded font-semibold hover:bg-indigo-50 transition" disabled={loading} onClick={(e)=>handleSubmit(e as any, true)}>
              Save as Draft
            </button>
          </form>
        </div>
    </>
    </ProtectedRoute>
  );
}
