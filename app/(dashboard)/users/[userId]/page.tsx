"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useUserRole } from "@/lib/useUserRole";
import { UserProfile } from "@/lib/userSchema";
import { ROLE_LABELS } from "@/lib/roles";

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.userId as string;
  const { isAdmin, loading: roleLoading } = useUserRole();

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);

  useEffect(() => {
    if (roleLoading) return;

    if (!isAdmin) {
      setError("You do not have permission to view this user");
      return;
    }

    const loadUser = async () => {
      try {
        const docSnap = await getDoc(doc(db, "users", userId));
        if (docSnap.exists()) {
          setUser(docSnap.data() as UserProfile);
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

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete user ${user?.email}? This action cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    setError("");

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/users/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ uid: userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete user");
      }

      alert("User deleted successfully");
      router.push("/users");
    } catch (err: any) {
      console.error("Error deleting user:", err);
      setError(err.message || "Failed to delete user");
      alert(err.message || "Failed to delete user");
    }

    setDeleting(false);
  };

  const handleResetPassword = async () => {
    setResettingPassword(true);
    setError("");
    setResetLink(null);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/users/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ uid: userId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to generate password reset link");
      }

      setResetLink(data.resetLink);
      alert("Password reset link generated! Copy the link below and share it with the user.");
    } catch (err: any) {
      console.error("Error generating password reset link:", err);
      setError(err.message || "Failed to generate password reset link");
      alert(err.message || "Failed to generate password reset link");
    }

    setResettingPassword(false);
  };

  if (roleLoading || loading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">User Details</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">User Details</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
          {error || "User not found"}
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">User Details</h1>
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/users/${userId}/edit`)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Edit User
          </button>
          <button
            onClick={handleResetPassword}
            disabled={resettingPassword}
            className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 disabled:bg-gray-400"
          >
            {resettingPassword ? "Generating..." : "Reset Password"}
          </button>
          {user && user.uid !== auth.currentUser?.uid && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:bg-gray-400"
            >
              {deleting ? "Deleting..." : "Delete User"}
            </button>
          )}
        </div>
      </div>

      {resetLink && (
        <div className="mb-4 p-4 border rounded bg-green-50 border-green-200">
          <p className="text-sm font-semibold text-green-800 mb-2">Password Reset Link Generated:</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={resetLink}
              readOnly
              className="flex-1 p-2 border rounded bg-white text-sm"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(resetLink);
                alert("Link copied to clipboard!");
              }}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Copy
            </button>
          </div>
          <p className="text-xs text-green-700 mt-2">Share this link with the user to reset their password.</p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <div>
          <label className="text-sm font-semibold text-gray-600">Email</label>
          <p className="text-lg">{user.email}</p>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-600">Display Name</label>
          <p className="text-lg">{user.displayName}</p>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-600">Role</label>
          <p className="text-lg">
            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm font-semibold">
              {ROLE_LABELS[user.role] || user.role}
            </span>
          </p>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-600">Status</label>
          <p className="text-lg capitalize">{user.status}</p>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-600">Created At</label>
          <p className="text-lg">
            {user.createdAt
              ? new Date(
                  user.createdAt instanceof Date
                    ? user.createdAt
                    : user.createdAt.toDate?.() || new Date()
                ).toLocaleString()
              : ""}
          </p>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-600">Last Login</label>
          <p className="text-lg">
            {user.lastLogin
              ? new Date(
                  user.lastLogin instanceof Date
                    ? user.lastLogin
                    : user.lastLogin.toDate?.() || new Date()
                ).toLocaleString()
              : "Never"}
          </p>
        </div>

        {user.createdBy && (
          <div>
            <label className="text-sm font-semibold text-gray-600">Created By</label>
            <p className="text-lg text-gray-600">{user.createdBy}</p>
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-2">
        <button
          onClick={() => router.push("/users")}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
        >
          Back to Users
        </button>
      </div>
    </div>
  );
}
