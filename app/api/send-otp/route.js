import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { error: 'Use /api/auth/mobile-send-otp from the app. This legacy route is disabled.' },
    { status: 410 }
  );
}
