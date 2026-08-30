import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Nodemailer from "next-auth/providers/nodemailer";

import { db } from "@/lib/db";
import { env, hasGoogleOAuth, hasEmailProvider, isAdminEmail } from "@/lib/env";
import { canSignIn } from "@/lib/access";
import { ensurePersonalWorkspace } from "@/lib/workspace";

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

if (hasEmailProvider) {
  providers.push(
    Nodemailer({
      server: env.EMAIL_SERVER,
      from: env.EMAIL_FROM,
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
