using System.IO;
using System.Text;

namespace FintechBankApp.Desktop.Web;

public static class StaticFileResourceHandler
{
    private static readonly Dictionary<string, string> MimeTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        { ".html", "text/html; charset=utf-8" },
        { ".htm", "text/html; charset=utf-8" },
        { ".js", "text/javascript; charset=utf-8" },
        { ".mjs", "text/javascript; charset=utf-8" },
        { ".css", "text/css; charset=utf-8" },
        { ".json", "application/json; charset=utf-8" },
        { ".svg", "image/svg+xml" },
        { ".png", "image/png" },
        { ".jpg", "image/jpeg" },
        { ".jpeg", "image/jpeg" },
        { ".gif", "image/gif" },
        { ".ico", "image/x-icon" },
        { ".woff", "font/woff" },
        { ".woff2", "font/woff2" },
        { ".ttf", "font/ttf" },
        { ".wasm", "application/wasm" },
    };

    public record StaticResponse(int StatusCode, string ContentType, byte[] Body);

    public static StaticResponse Resolve(string baseDirectory, string requestPath)
    {
        var rel = requestPath;
        if (rel.StartsWith(Program.AppBasePath, StringComparison.OrdinalIgnoreCase))
        {
            rel = rel[Program.AppBasePath.Length..];
        }
        else if (rel.StartsWith("/FintechBankApp", StringComparison.OrdinalIgnoreCase))
        {
            rel = rel["/FintechBankApp".Length..];
        }

        rel = rel.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        if (string.IsNullOrEmpty(rel) || rel.Equals("FintechBankApp", StringComparison.OrdinalIgnoreCase))
        {
            rel = "index.html";
        }

        var fullPath = Path.Combine(baseDirectory, rel);

        if (File.Exists(fullPath))
        {
            var ext = Path.GetExtension(fullPath);
            var mime = MimeTypes.TryGetValue(ext, out var m) ? m : "application/octet-stream";
            return new StaticResponse(200, mime, File.ReadAllBytes(fullPath));
        }

        var extMissing = Path.GetExtension(rel);
        if (!string.IsNullOrEmpty(extMissing))
        {
            var errBytes = Encoding.UTF8.GetBytes($"404 Asset Not Found: {rel}");
            return new StaticResponse(404, "text/plain; charset=utf-8", errBytes);
        }

        var indexPath = Path.Combine(baseDirectory, "index.html");
        if (File.Exists(indexPath))
        {
            return new StaticResponse(200, "text/html; charset=utf-8", File.ReadAllBytes(indexPath));
        }

        var missing404 = Encoding.UTF8.GetBytes("404 Not Found");
        return new StaticResponse(404, "text/plain; charset=utf-8", missing404);
    }
}
