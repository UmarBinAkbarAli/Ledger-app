"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { collection, query, getDocs, where, doc, getDoc } from "firebase/firestore";
import { useUserRole } from "@/lib/useUserRole";
import { UserProfile, UserStatus } from "@/lib/userSchema";
import { ROLE_LABELS } from "@/lib/roles";

interface AuthUserInfo {
  uid: string;
  email: string;
  displayName?: string;
  role?: string;
  createdBy?: string;
  businessId?: string;
  createdAt: string;
}

export default function UsersPage() {
  const router = useRouter();
  const { isAdmin, loading: roleLoading } = useUserRole();

  const [firestoreUsers, setFirestoreUsers] = useState<UserProfile[]>([]);
  const [authUsers, setAuthUsers] = useState<AuthUserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingUid, setDeletingUid] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Refactored loadUsers function to be reusable for refresh
  const loadUsers = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("Not authenticated");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    // Get current user's businessId for tenant isolation
    const userDocSnap = await getDoc(doc(db, "users", currentUser.uid));
    let currentBusinessId = currentUser.uid; // fallback for legacy users

    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      currentBusinessId = userData.businessId || currentUser.uid;
    }

    console.log("Current businessId:", currentBusinessId);

    try {
      // Load Firestore users - filter by businessId for tenant isolation
      const userMap = new Map<string, UserProfile>();
      const q = query(collection(db, "users"), where("businessId", "==", currentBusinessId));

      const snapshot = await getDocs(q);
      snapshot.forEach((docSnap) => {
        const userData = docSnap.data() as UserProfile;
        userMap.set(docSnap.id, userData);
      });

      if (currentBusinessId === currentUser.uid) {
        const legacyQuery = query(
          collection(db, "users"),
          where("createdBy", "==", currentUser.uid)
        );
        const legacySnapshot = await getDocs(legacyQuery);
        legacySnapshot.forEach((docSnap) => {
          if (!userMap.has(docSnap.id)) {
            userMap.set(docSnap.id, docSnap.data() as UserProfile);
          }
        });
      }

      let userList: UserProfile[] = [];
      userMap.forEach((userData) => {
        // EXCLUDE ADMIN USERS - Only show employees created by this admin
        if (userData.role === "admin") {
          return;
        }
        userList.push(userData);
      });

      userList.sort((a, b) => {
        const aTime = (a.createdAt as any)?.toDate?.()?.getTime?.() ?? 0;
        const bTime = (b.createdAt as any)?.toDate?.()?.getTime?.() ?? 0;
        return bTime - aTime;
      });

      setFirestoreUsers(userList);

      // Load Auth users (including pending ones without Firestore docs)
      const idToken = await auth.currentUser?.getIdToken();
      if (idToken) {
        try {
          const response = await fetch("/api/users/list-auth", {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            const allAuthUsers = data.users || [];
            const filteredAuthUsers = allAuthUsers.filter((u: AuthUserInfo) => {
              // EXCLUDE ADMIN USERS - Only show employees
              if (u.role === "admin") {
                return false; // Skip admin users
              }

              return true;
            });
            setAuthUsers(filteredAuthUsers);
            console.log(`Loaded ${filteredAuthUsers.length} Auth users (filtered from ${allAuthUsers.length})`);
          } else {
            console.warn("Could not load Auth users:", response.status);
          }
        } catch (err) {
          console.warn("Error loading Auth users:", err);
        }
      }
    } catch (err: any) {
      console.error("Error loading users:", err);
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (roleLoading) return;

    if (!isAdmin) {
      setError("You do not have permission to view users");
      return;
    }

    loadUsers();
  }, [roleLoading, isAdmin]);

  // Auto-refresh every 30 seconds to catch status updates when users log in
  useEffect(() => {
    if (!isAdmin || roleLoading) return;

    const interval = setInterval(() => {
      console.log("Auto-refreshing user list...");
      loadUsers(true);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [isAdmin, roleLoading]);

  const handleDelete = async (uid: string, email: string) => {
    if (!confirm(`Are you sure you want to delete user ${email}? This action cannot be undone.`)) {
      return;
    }

    setDeletingUid(uid);

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
        body: JSON.stringify({ uid }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to delete user");
      }

      // Remove user from local state
      setFirestoreUsers(prev => prev.filter(u => u.uid !== uid));
      setAuthUsers(prev => prev.filter(u => u.uid !== uid));

      alert("User deleted successfully");
    } catch (err: any) {
      console.error("Error deleting user:", err);
      alert(err.message || "Failed to delete user");
    }

    setDeletingUid(null);
  };

  if (roleLoading || loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Users</h1>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Users</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">
          {error}
        </div>
      </div>
    );
  }

  // Merge Firestore and Auth users: prioritize Firestore, then show pending Auth users
  const firestoreUids = new Set(firestoreUsers.map((u) => u.uid));
  const pendingUsers = authUsers.filter((u) => !firestoreUids.has(u.uid));
  let displayUsers = [...firestoreUsers, ...pendingUsers];

  // Apply search filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    displayUsers = displayUsers.filter((user) => {
      const email = user.email?.toLowerCase() || "";
      const name = user.displayName?.toLowerCase() || "";
      return email.includes(query) || name.includes(query);
    });
  }

  // Apply role filter
  if (roleFilter !== "all") {
    displayUsers = displayUsers.filter((user) => user.role === roleFilter);
  }

  // Apply status filter
  if (statusFilter !== "all") {
    displayUsers = displayUsers.filter((user) => {
      const isFirestoreUser = firestoreUids.has(user.uid);
      if (statusFilter === "pending") {
        return !isFirestoreUser;
      }
      return isFirestoreUser && (user as UserProfile).status === statusFilter;
    });
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-gray-600 text-sm mt-1">
            Showing: {displayUsers.length} of {firestoreUsers.length + pendingUsers.length} users
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => loadUsers(true)}
            disabled={refreshing}
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 disabled:bg-gray-400 flex items-center gap-2"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <button
            onClick={() => router.push("/users/new")}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Create User
          </button>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Role Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Role</label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Roles</option>
              {Object.entries(ROLE_LABELS).map(([roleKey, roleLabel]) => (
                <option key={roleKey} value={roleKey}>
                  {roleLabel}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
              <option value="deactivated">Deactivated</option>
            </select>
          </div>
        </div>

        {/* Clear Filters */}
        {(searchQuery || roleFilter !== "all" || statusFilter !== "all") && (
          <button
            onClick={() => {
              setSearchQuery("");
              setRoleFilter("all");
              setStatusFilter("all");
            }}
            className="text-sm text-blue-600 hover:underline"
          >
            Clear all filters
          </button>
        )}
      </div>

      {displayUsers.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 p-6 rounded text-center text-gray-600">
          <p>No users found</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-white rounded-lg shadow">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="px-6 py-3 text-left text-sm font-semibold">Email</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Name</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Role</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Last Login</th>
                <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayUsers.map((item) => {
                const isFirestoreUser = firestoreUids.has(item.uid);
                const user = isFirestoreUser ? (item as UserProfile) : (item as AuthUserInfo);

                return (
                  <tr key={item.uid} className={`border-b hover:bg-gray-50 ${!isFirestoreUser ? "bg-yellow-50" : ""}`}>
                    <td className="px-6 py-4 text-sm">{user.email}</td>
                    <td className="px-6 py-4 text-sm">{user.displayName || ""}</td>
                    <td className="px-6 py-4 text-sm">
                      {user.role ? (
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold">
                          {ROLE_LABELS[user.role as keyof typeof ROLE_LABELS] || user.role}
                        </span>
                      ) : (
                        <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-semibold">
                          No Role
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {isFirestoreUser ? (
                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">
                          {(user as UserProfile).status}
                        </span>
                      ) : (
                        <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-semibold">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {isFirestoreUser && (user as UserProfile).lastLogin
                        ? new Date(
                            (user as UserProfile).lastLogin instanceof Date
                              ? (user as UserProfile).lastLogin
                              : ((user as UserProfile).lastLogin as any).toDate?.() || new Date()
                          ).toLocaleString()
                        : ""}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {isFirestoreUser && (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => router.push(`/users/${item.uid}`)}
                            className="text-blue-600 hover:underline"
                          >
                            View
                          </button>
                          <button
                            onClick={() => router.push(`/users/${item.uid}/edit`)}
                            className="text-blue-600 hover:underline"
                          >
                            Edit
                          </button>
                          {item.uid !== auth.currentUser?.uid && (
                            <button
                              onClick={() => handleDelete(item.uid, user.email)}
                              disabled={deletingUid === item.uid}
                              className="text-red-600 hover:underline disabled:text-gray-400"
                            >
                              {deletingUid === item.uid ? "Deleting..." : "Delete"}
                            </button>
                          )}
                        </div>
                      )}
                      {!isFirestoreUser && (
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400 text-xs">Awaiting first login</span>
                          <button
                            onClick={() => handleDelete(item.uid, user.email)}
                            disabled={deletingUid === item.uid}
                            className="text-red-600 hover:underline disabled:text-gray-400 text-xs"
                          >
                            {deletingUid === item.uid ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
