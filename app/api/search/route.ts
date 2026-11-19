import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { QUICK_PER_GROUP } from "@/lib/search";
import { searchRecords } from "@/lib/search-data";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, selectedBuildingId: true },
  });
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q") ?? "";
  const results = await searchRecords({
    buildingId: user.selectedBuildingId,
    role: user.role,
    query,
    perGroup: QUICK_PER_GROUP,
  });

  return Response.json(results, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
