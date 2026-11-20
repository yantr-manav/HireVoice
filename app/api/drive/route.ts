import { listDriveFiles } from "@/lib/google/services";
import { googleConnection } from "@/lib/google/auth";
import { apiContext, jsonError, jsonOk } from "@/lib/api/http";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ctx = await apiContext();
    const connection = await googleConnection(ctx.owner);
    if (!connection.connected) {
      return jsonOk({ connection, files: [], warning: "Connect Google Drive to list resumes and documents." });
    }
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? undefined;
    try {
      const files = await listDriveFiles(ctx.owner, query);
      return jsonOk({ connection, files, warning: null });
    } catch (error) {
      return jsonOk({
        connection,
        files: [],
        warning: error instanceof Error ? error.message : "Drive could not be read.",
      });
    }
  } catch (error) {
    return jsonError(error);
  }
}
