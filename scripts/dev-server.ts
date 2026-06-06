const root = new URL("../public/", import.meta.url);
const legacyRoot = new URL("../legacy/", import.meta.url);

const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function contentType(pathname: string): string {
  const match = pathname.match(/\.[^.]+$/);
  return match ? mimeTypes[match[0]] ?? "application/octet-stream" : "text/html; charset=utf-8";
}

Bun.serve({
  port: 4173,
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const isLegacy = pathname.startsWith("/legacy/");
    const fileUrl = isLegacy ? new URL(`.${pathname.slice("/legacy".length)}`, legacyRoot) : new URL(`.${pathname}`, root);
    const file = Bun.file(fileUrl);
    if (!(await file.exists())) {
      return new Response("Not found", { status: 404 });
    }
    return new Response(file, {
      headers: { "content-type": contentType(pathname) }
    });
  }
});

console.log("GAPCytoEx dev server: http://localhost:4173");
