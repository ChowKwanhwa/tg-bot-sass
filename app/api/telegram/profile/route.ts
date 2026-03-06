import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireActiveUser } from "@/lib/guard";
import { getProfile, updateProfile } from "@/lib/telegram/profile-modifier";

export async function GET(req: NextRequest) {
  try {
    const guard = await requireActiveUser();
    if (!guard.ok) return guard.response;

    const sessionId = req.nextUrl.searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const tgSession = await prisma.tgSession.findFirst({
      where: { id: sessionId, userId: guard.user.id },
    });
    if (!tgSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    console.log("[profile GET] loading profile for session:", sessionId);
    const profile = await getProfile(tgSession.sessionString);
    return NextResponse.json(profile);
  } catch (err) {
    console.error("[profile GET] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load profile" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const guard = await requireActiveUser();
    if (!guard.ok) return guard.response;

    const formData = await req.formData();
    const sessionId = formData.get("sessionId") as string;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const tgSession = await prisma.tgSession.findFirst({
      where: { id: sessionId, userId: guard.user.id },
    });
    if (!tgSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const firstName = formData.get("firstName") as string | null;
    const lastName = formData.get("lastName") as string | null;
    const username = formData.get("username") as string | null;
    const avatarFile = formData.get("avatar") as File | null;

    let avatarBuffer: Buffer | undefined;
    let avatarFileName: string | undefined;

    if (avatarFile && avatarFile.size > 0) {
      const arrayBuffer = await avatarFile.arrayBuffer();
      avatarBuffer = Buffer.from(arrayBuffer);
      avatarFileName = avatarFile.name;
    }

    console.log("[profile POST] updating profile for session:", sessionId, {
      firstName, lastName, username, hasAvatar: !!avatarBuffer,
    });

    await updateProfile(tgSession.sessionString, {
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      username: username || undefined,
      avatarBuffer,
      avatarFileName,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[profile POST] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 }
    );
  }
}
