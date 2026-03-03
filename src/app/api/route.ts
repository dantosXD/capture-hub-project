import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError, classifyError } from "@/lib/api-route-handler";

export async function GET() {
  try {
    // Check database connection
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      message: "Capture Hub API",
      database: "connected"
    });
  } catch (error) {
    const classified = classifyError(error);
    return apiError('Database connection failed', classified.status, {
      details: classified.details,
      logPrefix: '[GET /api]',
      error,
    });
  }
}