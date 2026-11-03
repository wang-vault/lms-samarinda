---
name: nextjs-expert
description: Deep expertise in Next.js 15+ App Router, React Server Components (RSC), Server Actions, Route Handlers, Caching, and Async Request APIs. Use when building, refactoring, or optimizing Next.js applications.
---

# Next.js Expert Skill

Expert guidance for developing scalable, production-grade applications using modern **Next.js (App Router)** with React 19+.

## 1. Architectural Principles

### Server vs. Client Components (RSC Boundaries)
- **Default to Server Components**: Keep data fetching, database access, and heavy computations on the server.
- **Push `'use client'` to the Leaves**: Only mark components with `'use client'` when requiring:
  - React state (`useState`, `useReducer`) or lifecycle effects (`useEffect`).
  - Browser-only APIs (`window`, `localStorage`, `navigator`).
  - Interactive event listeners (`onClick`, `onChange`) not handled by native form actions.
- **Never Import Server-Only Code into Client Components**: Use `import "server-only"` in sensitive modules (db, auth secrets, credentials).

### Async Request APIs (Next.js 15+ Breaking Changes)
In Next.js 15+, dynamic request APIs are asynchronous:
```tsx
// Correct (Next.js 15+)
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const search = await searchParams;
  // ...
}
```

## 2. Server Actions & Mutations
- Define Server Actions in dedicated action files (`src/actions/...`) with `'use server'` at the top.
- Validate input schemas using Zod or equivalent before executing DB transactions.
- Handle authentication & authorization checks inside the action before mutations:
  ```ts
  "use server";
  import { auth } from "@/auth";

  export async function updateAction(formData: FormData) {
    const session = await auth();
    if (!session?.user) throw new Error("Unauthorized");
    // mutate...
  }
  ```
- Use `revalidatePath` or `revalidateTag` to purge cached data after updates.

## 3. Data Fetching & Caching Strategy
- Use direct ORM queries (e.g. Drizzle, Prisma) or `fetch` directly in Server Components without boilerplate API routes when rendering UI.
- Use Route Handlers (`route.ts`) primarily for:
  - External webhooks (e.g. Stripe, Midtrans).
  - Public REST endpoints or SSE streams (`text/event-stream`).
  - Binary downloads (PDF generation, media streaming with Range headers).

## 4. Error Handling & Loading States
- Implement `loading.tsx` with skeleton screens for instant fallback UI.
- Implement `error.tsx` (must be a Client Component) to catch and gracefully display segment errors.
- Implement `not-found.tsx` combined with `notFound()` from `next/navigation`.
