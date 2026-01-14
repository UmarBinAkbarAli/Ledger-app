"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useUserRole } from "@/lib/useUserRole";
import { UserProfile, UserStatus } from "@/lib/userSchema";
import { UserRole, ROLE_LABELS } from "@/lib/roles";

export default function UserEditPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;
  const { isAdmin, loading: roleLoading } = useUserRole();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.ADMIN);
  const [status, setStatus] = useState<UserStatus>(UserStatus.ACTIVE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (roleLoading) return;

    if (!isAdmin) {
      setError("You do not have permission to edit users");
      return;
    }

    const loadUser = async () => {
      try {
        const docSnap = await getDoc(doc(db, "users", userId));
        if (docSnap.exists()) {
          const userData = docSnap.data() as UserProfile;
          setUser(userData);
          setDisplayName(userData.displayName);
          setRole(userData.role || UserRole.ADMIN);
          setStatus(userData.status);
        } else {
          setError("User not found");
        }
      } catch (err: any) {
        console.error("Error loading user:", err);
        setError(err.message || "Failed to load user");
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, [userId, roleLoading, isAdmin]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const roleChanged = user?.role !== role;

      // Update Firestore document
      await updateDoc(doc(db, "users", userId), {
        displayName,
        role,
        status,
        updatedAt: new Date(),
      });

      // If role changed, sync custom claims via API
      if (roleChanged) {
        const authUser = auth.currentUser;
        if (authUser) {
          const idToken = await authUser.getIdToken();

          const response = await fetch("/api/users/update-role", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`,
            },
            body: JSON.stringify({ uid: userId, role }),
          });

          const data = await response.json();

          if (!data.success) {
            throw new Error(data.message || "Failed to sync role to custom claims");
          }
        }
      }

      setSuccess("User updated successfully");
      setTimeout(() => {
        router.push(`/users/${userId}`);
      }, 1500);
    } catch (err: any) {
      console.error("Error updating user:", err);
      setError(err.message || "Failed to update user");
    }

    setSaving(false);
  };

  if (roleLoading || loading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Edit User</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (error && !user) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Edit User</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
          {error}
        </div>
        <button
          onClick={() => router.back()}
          className="mt-4 px-4 py-2 text-blue-600 hover:underline"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Edit User</h1>

      {error && (
        <div className="mb-4 p-4 border rounded bg-red-50 border-red-200 text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 border rounded bg-green-50 border-green-200 text-green-700">
          {success}
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email (Read-only)</label>
          <input
            type="email"
            className="w-full border p-2 rounded bg-gray-50"
            value={user?.email || ""}
            disabled
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Display Name *</label>
          <input
            type="text"
            className="w-full border p-2 rounded"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Role *</label>
          <select
            className="w-full border p-2 rounded"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            {Object.entries(ROLE_LABELS)
              .filter(([roleKey]) => roleKey !== UserRole.ADMIN) // Exclude admin role
              .map(([roleKey, roleLabel]) => (
                <option key={roleKey} value={roleKey}>
                  {roleLabel}
                </option>
              ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Admin role cannot be assigned through this interface for security reasons.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Status *</label>
          <select
            className="w-full border p-2 rounded"
            value={status}
            onChange={(e) => setStatus(e.target.value as UserStatus)}
          >
            {Object.entries(UserStatus).map(([key, value]) => (
              <option key={value} value={value}>
                {key.charAt(0) + key.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="submit"
            disabled={saving || !displayName}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
