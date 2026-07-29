import { requireOwnerAccess } from "../../_auth";
import { createJsonExport } from "../../../../lib/application/exportApplication.mjs";

export async function POST(request) {
  const accessError = requireOwnerAccess(request);
  if (accessError) return accessError;

  try {
    const projection = createJsonExport(await request.json());
    return new Response(projection.content, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${projection.filename}"`,
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: error instanceof TypeError ? 400 : 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
