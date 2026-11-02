// Konfigurasi auth yang aman dijalankan di middleware (tanpa akses database)
// Konfigurasi lengkap ada di src/auth.ts

import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";

function dashboardFor(role: string) {
  if (role === "admin") return "/admin";
  if (role === "instruktur") return "/instruktur";
  return "/siswa";
}

export const authConfig = {
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  providers: [], // Provider diisi di src/auth.ts
  callbacks: {
    // Menentukan akses route berdasarkan role
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const user = auth?.user;

      const isAdminRoute = pathname.startsWith("/admin");
      const isInstrukturRoute = pathname.startsWith("/instruktur");
      const isSiswaRoute = pathname.startsWith("/siswa");
      const isDashboardRoute = isAdminRoute || isInstrukturRoute || isSiswaRoute;

      // Belum login di area privat -> redirect ke /login
      if (!user && isDashboardRoute) {
        return false;
      }

      if (user) {
        // Sudah login tapi membuka halaman login/register -> ke dashboard
        if (pathname === "/login" || pathname === "/register") {
          return NextResponse.redirect(new URL(dashboardFor(user.role), request.url));
        }

        // Role tidak sesuai -> redirect ke dashboard miliknya
        const wrongRole =
          (isAdminRoute && user.role !== "admin") ||
          (isInstrukturRoute && user.role !== "instruktur") ||
          (isSiswaRoute && user.role !== "siswa");

        if (wrongRole) {
          return NextResponse.redirect(new URL(dashboardFor(user.role), request.url));
        }
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "admin" | "instruktur" | "siswa";
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
