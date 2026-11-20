import { deleteGoogleAccount, googleConnection } from "@/lib/google/auth";
import { apiContext, assertSameOrigin, jsonError, jsonOk, readJson } from "@/lib/api/http";
import { writeAudit } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await apiContext();
    await readJson(request);
    await deleteGoogleAccount(ctx.owner);
    await writeAudit({ actor: ctx.actor, action: "google_disconnected", target: ctx.email, surface: "workspace" });
    return jsonOk({ google: await googleConnection(ctx.owner) });
  } catch (error) {
    return jsonError(error);
  }
}
