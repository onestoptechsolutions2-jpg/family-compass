import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";

import { db } from "@/lib/db";
import { env, hasGoogleOAuth, isAdminEmail } from "@/lib/env";
import { canSignIn } from "@/lib/access";
import { ensurePersonalWorkspace } from "@/lib/workspace";

// Primary onboarding is the WhatsApp one-time link (see /api/auth/wa/[token]),
// which mints a database session directly. Google OAuth is an optional extra.
const providers: NextAuthConfig["providers"] = [];

if (hasGoogleOAuth) {
  providers.push(
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(db),
  session: { strategy: "database" },
  trustHost: true,
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
    error: "/login/error",
  },
  providers,
  callbacks: {
    // No open registration: only approved / invited addresses may sign in.
    // Runs before an OAuth account is linked and before a magic link is sent.
    async signIn({ user }) {
      return canSignIn(user.email);
    },
    // Behind a reverse proxy the request host Auth.js sees is the internal
    // container origin (localhost:PORT), so sign-in / sign-out redirects land
    // on the wrong URL. Pin every auth redirect to the canonical public origin.
    async redirect({ url, baseUrl }) {
      const pub = env.APP_URL.replace(/\/$/, "");
      if (url.startsWith("/")) return pub + url;
      try {
        const u = new URL(url);
        if (u.origin === pub || u.origin === baseUrl) return pub + u.pathname + u.search;
      } catch {
        /* fall through */
      }
      return pub;
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.isPlatformAdmin =
          (user as { isPlatformAdmin?: boolean }).isPlatformAdmin ?? false;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      // Grant platform-admin to configured emails, and give every new user a
      // personal workspace they own.
      if (isAdminEmail(user.email)) {
        await db.user.update({
          where: { id: user.id },
          data: { isPlatformAdmin: true },
        });
      }
      await ensurePersonalWorkspace(user.id, user.name ?? user.email ?? "My");
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
