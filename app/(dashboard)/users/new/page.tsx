"use client";

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { UserRole, ROLE_LABELS, DEFAULT_ROLE } from "@/lib/roles";
import { useUserRole } from "@/lib/useUserRole";

export default function CreateUserPage() {
  const router = useRouter();
  const { role, loading: roleLoading, isAdmin } = useUserRole();

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [userRole, setUserRole] = useState<UserRole>(UserRole.SALES_USER);
  const [password, setPassword] = useState(""); // optional
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resetLink, setResetLink] = useState<string | null>(null);

  // Redirect if not admin
  if (!roleLoading && !isAdmin) {
    return (
      <div className="max-w-md mx-auto bg-white p-6 rounded shadow mt-10">
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
          <p>You do not have permission to create users. Only administrators can create users.</p>
        </div>
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setResetLink(null);
    setLoading(true);

    try {
      // Get the ID token from current auth user
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error("Not authenticated");
      }

      const requestBody = {
        email,
        displayName,
        role: userRole,
        password: password || undefined,
      };

      console.log("Creating user with data:", { email, displayName, role: userRole });

      // Call the API to create user (preserves admin session)
      const response = await fetch("/api/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("User creation failed:", data);
        throw new Error(data.message || data.error || "Failed to create user");
      }

      const roleLabel = ROLE_LABELS[userRole] || userRole;
      setSuccess(`User created successfully!\n\nEmail: ${email}\nRole: ${roleLabel}\nStatus: Active\n\nThe user can now log in with their credentials.`);
      if (!password && data?.resetLink) {
        setResetLink(data.resetLink);
      }
      setEmail("");
      setDisplayName("");
      setUserRole(UserRole.SALES_USER);
      setPassword("");

      // Redirect to user list after success
      setTimeout(() => {
        router.push("/users");
      }, 4000);
    } catch (err: any) {
      console.error("Error creating user:", err);
      setError(err.message || "Failed to create user");
    }

    setLoading(false);
  };

  if (roleLoading) {
    return (
      <div className="max-w-md mx-auto bg-white p-6 rounded shadow mt-10">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow mt-10">
      <h1 className="text-2xl font-bold mb-6">Create New User</h1>

      {error && (
        <div className="mb-4 p-4 border rounded bg-red-50 border-red-200 text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 border rounded bg-green-50 border-green-200 text-green-700 whitespace-pre-wrap">
          {success}
          {resetLink && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(resetLink);
                  alert("Password reset link copied to clipboard.");
                }}
                className="inline-block px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Copy Password Reset Link
              </button>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Display Name *</label>
          <input
            type="text"
            className="w-full border p-2 rounded"
            placeholder="John Doe"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Email *</label>
          <input
            type="email"
            className="w-full border p-2 rounded"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Password (optional)</label>
          <input
            type="password"
            className="w-full border p-2 rounded"
            placeholder="Set a temporary password or leave blank"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">
            <strong>Leave blank</strong> to generate a password reset link, or set a temporary password.
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Password requirements: 8+ characters, uppercase, lowercase, and number.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Role *</label>
          <select
            className="w-full border p-2 rounded"
            value={userRole}
            onChange={(e) => setUserRole(e.target.value as UserRole)}
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
            Select the role for this employee. Admin users cannot be created from this page.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || !email || !displayName}
          className="w-full bg-blue-600 text-white p-3 rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? "Creating..." : "Create User"}
        </button>
      </form>

      <p className="text-sm text-gray-600 mt-4 text-center">
        <a href="/users" className="text-blue-600 hover:underline">Back to Users</a>
      </p>
    </div>
  );
}
