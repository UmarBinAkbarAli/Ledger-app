Plan: Firestore → Postgres (Zero-Downtime)
A phased migration using dual-write, shadow reads, and feature flags. We keep Firebase Auth, add a data access layer, backfill data, then cut reads over per feature. Rollback stays one env var away at every step.

Steps
Add repository facade + feature flags in lib to route reads/writes (USE_POSTGRES, DUAL_WRITE).
Stand up Postgres (Supabase recommended), create tables and RLS; map firebase_uid to users.id.
Implement dual-write for high-impact flows (sales, challan, income, expenses) in pages like page.tsx and page.tsx.
Backfill static and transactional collections from Firestore into Postgres with scripts; validate counts and totals.
Shadow-read critical lists (sales, challans, ledgers) comparing Postgres vs Firestore; log mismatches without user impact.
Cut over reads page-by-page (sales, challans, ledgers), keep dual-write on; then disable Firestore writes when stable.
Further Considerations
Auth: Keep Firebase Auth; use firebase_uid for RLS and scoping in Postgres.
Identifiers: Preserve bill/challan sequences or switch to a safe sequence/PROC to avoid collisions.
Precision: Use DECIMAL(15,2) for money; avoid JS float math in critical paths.


📋 Comprehensive migration documentation including:

Complete Firestore schema inventory (14 collections documented)
PostgreSQL schema with 20+ tables
Row Level Security (RLS) policies
Dual-write migration strategy
6-7 week phased timeline
Risk assessment matrix with mitigations
Rollback procedures for every phase
Code examples for repository pattern
Migration scripts structure
Bill number collision solutions
Date/transaction handling strategies