"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
} from "firebase/firestore";

export interface PaginationState<T> {
  items: T[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string;
}

export interface PaginationActions<T> {
  loadMore: () => Promise<void>;
  reset: () => Promise<void>;
  setError: (error: string) => void;
}

interface UsePaginatedQueryOptions<T> {
  collectionName: string;
  pageSize?: number;
  orderByField?: string;
  orderDirection?: "asc" | "desc";
  dataTransform?: (docData: any, docId: string) => T;
}

export function usePaginatedQuery<T extends { id: string }>({
  collectionName,
  pageSize = 20,
  orderByField = "createdAt",
  orderDirection = "desc",
  dataTransform,
}: UsePaginatedQueryOptions<T>): [
  PaginationState<T>,
  PaginationActions<T>
] {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  
  // Use ref to avoid infinite loop from lastDoc in dependency array
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  const fetchItems = useCallback(
    async (isNextPage = false) => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setError("Not logged in");
          if (!isNextPage) setLoading(false);
          return;
        }

        if (isNextPage) setLoadingMore(true);
        else setLoading(true);

        const itemsRef = collection(db, collectionName);
        let q;

        if (isNextPage && lastDocRef.current) {
          q = query(
            itemsRef,
            where("userId", "==", user.uid),
            orderBy(orderByField, orderDirection),
            startAfter(lastDocRef.current),
            limit(pageSize)
          );
        } else {
          q = query(
            itemsRef,
            where("userId", "==", user.uid),
            orderBy(orderByField, orderDirection),
            limit(pageSize)
          );
        }

        const snap = await getDocs(q);

        if (snap.empty) {
          setHasMore(false);
          if (isNextPage) setLoadingMore(false);
          else setLoading(false);
          return;
        }

        // Update ref (not state) to avoid triggering effect
        lastDocRef.current = snap.docs[snap.docs.length - 1];

        if (snap.docs.length < pageSize) {
          setHasMore(false);
        }

        const list = snap.docs.map((d) =>
          dataTransform
            ? dataTransform(d.data(), d.id)
            : ({ id: d.id, ...d.data() } as T)
        );

        if (isNextPage) {
          setItems((prev) => [...prev, ...list]);
        } else {
          setItems(list);
        }

        setError("");
      } catch (err: any) {
        console.error(err);
        setError("Failed to load items");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [collectionName, pageSize, orderByField, orderDirection, dataTransform]
  );

  useEffect(() => {
    fetchItems(false);
  }, [collectionName, fetchItems]);

  return [
    { items, loading, loadingMore, hasMore, error },
    {
      loadMore: () => fetchItems(true),
      reset: () => fetchItems(false),
      setError,
    },
  ];
}
