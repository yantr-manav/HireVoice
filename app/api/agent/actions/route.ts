import { apiContext, jsonError, jsonOk } from "@/lib/api/http";
import { listActions, listAudit, listPendingActions } from "@/lib/db/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await apiContext();
    return jsonOk({
      actions: await listActions(40),
      audit: await listAudit(20),
      pending: (await listPendingActions()).length,
    });
  } catch (error) {
    return jsonError(error);
  }
}
