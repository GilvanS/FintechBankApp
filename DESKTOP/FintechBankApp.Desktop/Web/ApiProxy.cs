using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Text;

namespace FintechBankApp.Desktop.Web;

public static class ApiProxy
{
    public const string TargetBase = "http://localhost:3001";

    private static readonly System.Net.CookieContainer CookieJar = new();
    private static readonly HttpClientHandler Handler = new()
    {
        CookieContainer = CookieJar,
        UseCookies = true,
        AllowAutoRedirect = false,
    };

    private static readonly HttpClient Client = new(Handler)
    {
        BaseAddress = new Uri(TargetBase),
        Timeout = TimeSpan.FromSeconds(30),
    };

    private static readonly HashSet<string> DisallowedRequestHeaders = new(StringComparer.OrdinalIgnoreCase)
    {
        "Host", "Connection", "Keep-Alive", "Accept-Encoding",
        "Transfer-Encoding", "Origin", "Referer"
    };

    private static readonly HashSet<string> DisallowedResponseHeaders = new(StringComparer.OrdinalIgnoreCase)
    {
        "Transfer-Encoding", "Content-Encoding"
    };

    public record ProxyResponse(
        int StatusCode,
        string StatusDescription,
        string ContentType,
        byte[] Body,
        IDictionary<string, string> Headers);

    public static async Task<ProxyResponse> ForwardAsync(
        string httpMethod,
        string relativePathAndQuery,
        IDictionary<string, string> requestHeaders,
        byte[]? requestBody)
    {
        try
        {
            var targetUri = new Uri(new Uri(TargetBase), relativePathAndQuery);
            using var req = new HttpRequestMessage(new HttpMethod(httpMethod), targetUri);

            // Garante que o Host enviado para a API Node seja http://localhost:3001
            req.Headers.Host = "localhost:3001";

            foreach (var (key, val) in requestHeaders)
            {
                if (DisallowedRequestHeaders.Contains(key)) continue;
                req.Headers.TryAddWithoutValidation(key, val);
            }

            if (requestBody is { Length: > 0 })
            {
                req.Content = new ByteArrayContent(requestBody);
                if (requestHeaders.TryGetValue("Content-Type", out var ct) && ct != null)
                {
                    try
                    {
                        req.Content.Headers.ContentType = System.Net.Http.Headers.MediaTypeHeaderValue.Parse(ct);
                    }
                    catch
                    {
                        req.Content.Headers.TryAddWithoutValidation("Content-Type", ct);
                    }
                }
            }

            using var resp = await Client.SendAsync(req);
            var respBody = await resp.Content.ReadAsByteArrayAsync();

            var respContentType = resp.Content.Headers.ContentType?.ToString()
                ?? "application/json; charset=utf-8";

            var respHeaders = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            foreach (var h in resp.Headers)
            {
                if (!DisallowedResponseHeaders.Contains(h.Key))
                    respHeaders[h.Key] = string.Join(", ", h.Value);
            }
            foreach (var h in resp.Content.Headers)
            {
                if (!DisallowedResponseHeaders.Contains(h.Key))
                    respHeaders[h.Key] = string.Join(", ", h.Value);
            }

            return new ProxyResponse(
                (int)resp.StatusCode,
                resp.ReasonPhrase ?? "OK",
                respContentType,
                respBody,
                respHeaders);
        }
        catch (HttpRequestException ex)
        {
            var errJson = $"{{\"error\": true, \"message\": \"API fora do ar em {TargetBase}\", \"details\": \"{ex.Message.Replace("\"", "\\\"")}\"}}";
            return new ProxyResponse(
                503,
                "Service Unavailable",
                "application/json; charset=utf-8",
                Encoding.UTF8.GetBytes(errJson),
                new Dictionary<string, string>());
        }
    }
}
