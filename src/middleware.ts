// Middleware proteksi route berdasarkan role
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export const { auth: middleware } = NextAuth(authConfig);

export default middleware;

export const config = {
  // Proteksi area privat + redirect halaman auth bila sudah login
  matcher: [
    "/admin/:path*",
    "/instruktur/:path*",
    "/siswa/:path*",
    "/login",
    "/register",
  ],
};
