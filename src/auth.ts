import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { NextResponse } from "next/server";

/**
 * If `ALLOWED_EMAIL_DOMAINS` is set (comma-separated), only those email
 * domains may sign in after Google OAuth. If unset or empty, any Google
 * account is allowed — use that for initial rollout; add `gitwit.com` later.
 */
function parseAllowedDomains(): string[] | null {
  const raw = process.env.ALLOWED_EMAIL_DOMAINS?.trim();
  if (!raw) return null;
  const list = raw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  return list.length ? list : null;
}

function emailDomainAllowed(
  email: string | null | undefined,
  domains: string[],
): boolean {
  if (!email) return false;
  const domain = email.split("@")[1]?.toLowerCase();
  return domain ? domains.includes(domain) : false;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  pages: {
    signIn: "/login",
  },
  trustHost: true,
  callbacks: {
    async signIn({ profile }) {
      const allowed = parseAllowedDomains();
      if (!allowed) return true;
      return emailDomainAllowed(profile?.email as string | undefined, allowed);
    },
    authorized({ request, auth: session }) {
      const path = request.nextUrl.pathname;

      if (path.startsWith("/api/auth")) return true;
      if (path === "/login") return true;

      if (!session?.user) {
        if (path.startsWith("/api/")) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const login = new URL("/login", request.nextUrl.origin);
        login.searchParams.set(
          "callbackUrl",
          `${request.nextUrl.pathname}${request.nextUrl.search}`,
        );
        return NextResponse.redirect(login);
      }

      return true;
    },
  },
});
