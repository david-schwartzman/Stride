import { NextResponse, type NextRequest } from "next/server";

import { apiRewrite } from "@/lib/api-proxy";

// Owned by protected-routes, which adds the page guard next to the /api branch.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return apiRewrite(request);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
