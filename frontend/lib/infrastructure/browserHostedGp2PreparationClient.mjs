function requireFetch(fetchImpl) {
  if (typeof fetchImpl !== "function") throw new TypeError("Hosted GP2 preparation client requires fetch().");
  return fetchImpl;
}

async function parseResponse(response) {
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    const error = new Error("Hosted GP2 preparation API returned an unreadable response.");
    error.code = "hosted_gp2_preparation_unreadable";
    error.status = response.status;
    throw error;
  }
  if (!response.ok || !data?.ok) {
    const error = new Error(data?.error || `Hosted GP2 preparation request failed (HTTP ${response.status}).`);
    error.code = data?.code || "hosted_gp2_preparation_failed";
    error.status = response.status;
    throw error;
  }
  return data.preparation || null;
}

export function createBrowserHostedGp2PreparationClient({ fetchImpl = globalThis.fetch } = {}) {
  const fetcher = requireFetch(fetchImpl);

  async function prepareContentPiece(contentPieceId) {
    const id = String(contentPieceId || "").trim();
    if (!id) throw new TypeError("Hosted GP2 preparation requires contentPieceId.");
    const response = await fetcher("/api/gp2/preparation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentPieceId: id }),
      credentials: "same-origin",
      cache: "no-store",
    });
    return parseResponse(response);
  }

  return Object.freeze({ prepareContentPiece });
}
