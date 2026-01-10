"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { useRouter } from "next/navigation";

export default function ProfileSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Logo upload state
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);
  const [existingLogoPath, setExistingLogoPath] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      const user = auth.currentUser;
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setCompanyName(data.companyName || "");
          setOwnerName(data.ownerName || "");
          setExistingLogoUrl(data.logoUrl || null);
          setExistingLogoPath(data.logoPath || null);
        }
      } catch (err: any) {
        console.error("Error loading profile:", err);
        setError(err.message);
      }

      setLoading(false);
    };

    loadProfile();
  }, [router]);

  // Cleanup preview object URL on unmount or when changed
  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  // Compress/resize image to meet max size (1MB) and max dimensions
  const compressAndResizeImage = async (file: File): Promise<File> => {
    const MAX_SIZE = 1024 * 1024; // 1MB
    const MAX_DIM = 1024;

    return new Promise<File>((resolve, reject) => {
      const img = new Image();
      img.onload = async () => {
        let width = img.width;
        let height = img.height;
        if (width > MAX_DIM || height > MAX_DIM) {
          const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        const toBlob = (mime: string, quality?: number) =>
          new Promise<Blob | null>((res) => canvas.toBlob(res, mime, quality));

        const origType = file.type;
        // Try to preserve original type when possible
        if (origType === "image/png") {
          let blob = await toBlob("image/png");
          if (blob && blob.size <= MAX_SIZE) {
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".png"), { type: "image/png" }));
            return;
          }
          // Convert to JPEG for better compression
          let quality = 0.92;
          let jpegBlob = await toBlob("image/jpeg", quality);
          while (jpegBlob && jpegBlob.size > MAX_SIZE && quality > 0.4) {
            quality -= 0.12;
            jpegBlob = await toBlob("image/jpeg", quality);
          }
          if (jpegBlob && jpegBlob.size <= MAX_SIZE) {
            resolve(new File([jpegBlob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
            return;
          }
          reject(new Error("Image is too large even after compression"));
        } else {
          // JPEG or other - convert to JPEG
          let quality = 0.92;
          let jpegBlob = await toBlob("image/jpeg", quality);
          while (jpegBlob && jpegBlob.size > MAX_SIZE && quality > 0.4) {
            quality -= 0.12;
            jpegBlob = await toBlob("image/jpeg", quality);
          }
          if (jpegBlob && jpegBlob.size <= MAX_SIZE) {
            resolve(new File([jpegBlob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
            return;
          }
          reject(new Error("Image is too large even after compression"));
        }
      };
      img.onerror = () => reject(new Error("Failed to read image file"));
      img.src = URL.createObjectURL(file);
    });
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setLogoError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/png", "image/jpeg", "image/jpg"];
    if (!allowed.includes(file.type)) {
      setLogoError("Only PNG and JPG images are allowed.");
      return;
    }

    try {
      const compressed = await compressAndResizeImage(file);
      // final size check
      if (compressed.size > 1024 * 1024) {
        setLogoError("Image is larger than 1MB even after compression.");
        return;
      }
      setLogoFile(compressed);
      setLogoPreview(URL.createObjectURL(compressed));
      setRemoveLogo(false);
    } catch (err: any) {
      setLogoError(err.message || "Failed to process image.");
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const user = auth.currentUser;
      if (!user) {
        setError("You must be logged in.");
        router.push("/login");
        return;
      }

      // Handle logo upload (if user selected a new file)
      let logoUrlToSave: string | null = existingLogoUrl;
      let logoPathToSave: string | null = existingLogoPath;

      if (logoFile) {
        setUploadingLogo(true);
        const storage = getStorage();
        const ext = logoFile.type === "image/png" ? "png" : "jpg";
        const sRef = storageRef(storage, `users/${user.uid}/logo-${Date.now()}.${ext}`);
        const uploadTask = uploadBytesResumable(sRef, logoFile);

        await new Promise<void>((resolve, reject) => {
          uploadTask.on(
            "state_changed",
            () => {},
            (err) => reject(err),
            async () => {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              logoUrlToSave = url;
              // fullPath should be available on ref
              // @ts-ignore - snapshot.ref may not expose fullPath on types but it exists at runtime
              logoPathToSave = (uploadTask.snapshot.ref as any).fullPath || `users/${user.uid}/logo-${Date.now()}.${ext}`;
              resolve();
            }
          );
        });

        // Delete previous logo file if it exists and path changed
        if (existingLogoPath && existingLogoPath !== logoPathToSave) {
          const storage = getStorage();
          try {
            await deleteObject(storageRef(storage, existingLogoPath));
          } catch (err) {
            console.warn("Failed to delete old logo:", err);
          }
        }
      }

      if (removeLogo) {
        const storage = getStorage();
        if (existingLogoPath) {
          try {
            await deleteObject(storageRef(storage, existingLogoPath));
          } catch (err) {
            console.warn("Failed to delete logo:", err);
          }
        }
        logoUrlToSave = null;
        logoPathToSave = null;
      }

      await setDoc(
        doc(db, "users", user.uid),
        {
          companyName,
          ownerName,
          logoUrl: logoUrlToSave,
          logoPath: logoPathToSave,
          updatedAt: new Date(),
        },
        { merge: true }
      );

      // Update local UI state to reflect saved logo
      setExistingLogoUrl(logoUrlToSave);
      setExistingLogoPath(logoPathToSave);
      setLogoFile(null);
      setLogoPreview(null);
      setRemoveLogo(false);
      setLogoError(null);

      setSuccess("Profile updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      console.error("Error saving profile:", err);
      setError(err.message);
    } finally {
      // Ensure uploading flag and saving flag are cleared in all cases
      setUploadingLogo(false);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-text-secondary">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-border-light p-6">
          <h1 className="text-2xl font-bold text-text-primary mb-6">Profile Settings</h1>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm">
              {success}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Company Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g., Boxilla Packages"
                className="w-full px-4 py-2 border border-border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Owner Name
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g., Babar Akbar"
                className="w-full px-4 py-2 border border-border-light rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Company Logo
              </label>
              <div className="flex items-center gap-4">
                {(logoPreview || existingLogoUrl) ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={logoPreview || existingLogoUrl || ""}
                      alt="Company logo"
                      className="w-20 h-20 object-contain border rounded-md bg-white"
                    />
                    <div className="flex flex-col gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="text-sm"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="text-red-600 text-sm"
                      >
                        Remove logo
                      </button>
                    </div>
                  </div>
                ) : (
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="text-sm"
                  />
                )}
                {uploadingLogo && <p className="text-sm text-text-secondary">Uploading...</p>}
              </div>
              {logoError && <p className="text-sm text-red-600 mt-2">{logoError}</p>}
              <p className="text-xs text-text-secondary mt-1">This logo will be used in invoices, delivery challans and other documents. Max 1MB (PNG, JPG).</p>
            </div> 

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving || uploadingLogo || !!logoError}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="px-6 py-2 bg-gray-100 text-text-primary rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

