import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();
const appServerRoot = path.join(root, ".next", "server", "app");
const outputPath = path.join(root, "function-trace-audit.json");
const CRITICAL_PACKAGES = ["sharp", "jszip", "ws", "@neondatabase/serverless"];

function bytesToMiB(bytes) {
  return Number((bytes / 1024 / 1024).toFixed(3));
}

function packageName(filePath) {
  const normalized = filePath.split(path.sep).join("/");
  const marker = "/node_modules/";
  const index = normalized.lastIndexOf(marker);
  if (index < 0) return null;
  const rest = normalized.slice(index + marker.length).split("/");
  if (!rest[0]) return null;
  return rest[0].startsWith("@") && rest[1] ? rest.slice(0, 2).join("/") : rest[0];
}

function routeName(traceFile) {
  const relative = path.relative(appServerRoot, traceFile).split(path.sep).join("/");
  return "/" + relative.replace(/\/route\.js\.nft\.json$/, "");
}

async function walk(directory) {
  const out = [];
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else out.push(full);
  }
  return out;
}

async function statSafe(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() ? stat.size : 0;
  } catch {
    return 0;
  }
}

const allFiles = await walk(appServerRoot);
const traceFiles = allFiles.filter((file) => file.endsWith(path.sep + "route.js.nft.json"));
if (!traceFiles.length) throw new Error("No Next.js App Router function trace files were found after next build.");

const routeReports = [];
const aggregatePackageBytes = new Map();
const aggregatePackageRoutes = new Map();
const uniqueFiles = new Map();

for (const traceFile of traceFiles) {
  const trace = JSON.parse(await fs.readFile(traceFile, "utf8"));
  const resolvedFiles = Array.from(new Set((trace.files || []).map((entry) => path.resolve(path.dirname(traceFile), entry)));
  resolvedFiles.push(traceFile.replace(/\.nft\.json$/, ""));
  const packageBytes = new Map();
  let tracedBytes = 0;
  let tracedFiles = 0;
  for (const file of Array.from(new Set(resolvedFiles))) {
    const size = await statSafe(file);
    if (!size) continue;
    tracedBytes += size;
    tracedFiles += 1;
    if (!uniqueFiles.has(file)) uniqueFiles.set(file, size);
    const pkg = packageName(file);
    if (pkg) packageBytes.set(pkg, (packageBytes.get(pkg) || 0) + size);
  }
  const route = routeName(traceFile);
  for (const [pkg, size] of packageBytes) {
    aggregatePackageBytes.set(pkg, (aggregatePackageBytes.get(pkg) || 0) + size);
    if (!aggregatePackageRoutes.has(pkg)) aggregatePackageRoutes.set(pkg, new Set());
    aggregatePackageRoutes.get(pkg).add(route);
  }
  const imgPackages = [...packageBytes.keys()].filter((pkg) => pkg.startsWith("@img/"));
  routeReports.push({
    route, tracedBytes, tracedMiB: bytesToMiB(tracedBytes), tracedFiles,
    critical: {
      sharp: packageBytes.has("sharp"),
      imgNativePackages: imgPackages,
      jszip: packageBytes.has("jszip"),
      ws: packageBytes.has("ws"),
      neon: packageBytes.has("@neondatabase/serverless")
    }
  });
}

routeReports.sort((a, b) => b.tracedBytes - a.tracedBytes);
const packageRows = [...aggregatePackageBytes.entries()].map(([pkg, bytes]) => ({
  package: pkg,
  repeatedBytesAcrossRoutes: bytes,
  repeatedMiBAcrossRoutes: bytesToMiB(bytes),
  routes: aggregatePackageRoutes.get(pkg)?.size || 0
})).sort((a, b) => b.repeatedBytesAcrossRoutes - a.repeatedBytesAcrossRoutes);

const critical = {};
for (const pkg of CRITICAL_PACKAGES) {
  const row = packageRows.find((item) => item.package === pkg);
  critical[pkg] = row || { package: pkg, repeatedBytesAcrossRoutes: 0, repeatedMiBAcrossRoutes: 0, routes: 0 };
}
const imgRows = packageRows.filter((item) => item.package.startsWith("@img/"));
critical["@img/*"] = {
  package: "@img/*",
  repeatedBytesAcrossRoutes: imgRows.reduce((sum, item) => sum + item.repeatedBytesAcrossRoutes, 0),
  repeatedMiBAcrossRoutes: bytesToMiB(imgRows.reduce((sum, item) => sum + item.repeatedBytesAcrossRoutes, 0)),
  routes: new Set(routeReports.filter((route) => route.critical.imgNativePackages.length).map((route) => route.route)).size
};

const totalRepeatedBytes = routeReports.reduce((sum, route) => sum + route.tracedBytes, 0);
const uniqueBytes = [...uniqueFiles.values()].reduce((sum, size) => sum + size, 0);
const report = {
  generatedAt: new Date().toISOString(),
  nextBuildTraceType: "app-route-nft",
  routeCount: routeReports.length,
  repeatedTracedBytesAcrossRoutes: totalRepeatedBytes,
  repeatedTracedMiBAcrossRoutes: bytesToMiB(totalRepeatedBytes),
  uniqueTracedBytesAcrossRoutes: uniqueBytes,
  uniqueTracedMiBAcrossRoutes: bytesToMiB(uniqueBytes),
  criticalPackages: critical,
  routes: routeReports,
  packages: packageRows
};
await fs.writeFile(outputPath, JSON.stringify(report, null, 2) + "\n");

console.log("\nSignalFlow function trace audit");
console.log("--------------------------------");
console.log("Route function traces: " + report.routeCount);
console.log("Repeated traced bytes across routes: " + report.repeatedTracedMiBAcrossRoutes + " MiB");
console.log("Unique traced bytes across all routes: " + report.uniqueTracedMiBAcrossRoutes + " MiB");
console.log("\nCritical package routing:");
for (const [name, value] of Object.entries(report.criticalPackages)) {
  console.log("- " + name + ": " + value.repeatedMiBAcrossRoutes + " MiB across " + value.routes + " route(s)");
}
console.log("\nLargest route traces:");
for (const route of routeReports.slice(0, 15)) {
  console.log("- " + route.route + ": " + route.tracedMiB + " MiB / " + route.tracedFiles + " files" +
    " | sharp=" + route.critical.sharp +
    " @img=" + (route.critical.imgNativePackages.length > 0) +
    " jszip=" + route.critical.jszip +
    " ws=" + route.critical.ws +
    " neon=" + route.critical.neon);
}
console.log("\nTop repeated package contributions:");
for (const row of packageRows.slice(0, 20)) {
  console.log("- " + row.package + ": " + row.repeatedMiBAcrossRoutes + " MiB across " + row.routes + " route(s)");
}
console.log("\nFull JSON report: " + path.relative(root, outputPath));
