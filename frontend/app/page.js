import { redirect } from "next/navigation";
import LandingPage from "../components/LandingPage";

function forwardQuery(searchParams, excludedKeys = []) {
  const excluded = new Set(excludedKeys);
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams || {})) {
    if (excluded.has(key) || value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, String(item));
    } else {
      query.append(key, String(value));
    }
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export default async function Home({ searchParams }) {
  const params = await searchParams;
  const workspace = Array.isArray(params?.workspace) ? params.workspace[0] : params?.workspace;
  const socialStatus = Array.isArray(params?.social_status) ? params.social_status[0] : params?.social_status;
  const forwarded = forwardQuery(params, ["workspace"]);

  if (workspace === "settings") redirect(`/settings${forwarded}`);
  if (workspace === "connections" || socialStatus) redirect(`/connections${forwarded}`);
  if (workspace === "library") redirect(`/library${forwarded}`);
  if (workspace === "create" || workspace === "studio") redirect(`/studio${forwarded}`);

  return <LandingPage />;
}
