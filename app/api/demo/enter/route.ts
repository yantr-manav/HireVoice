import { NextResponse } from "next/server";
import { DEMO_COOKIE } from "@/lib/viewer";

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL("/app", request.url));
  response.cookies.set(DEMO_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return response;
}
