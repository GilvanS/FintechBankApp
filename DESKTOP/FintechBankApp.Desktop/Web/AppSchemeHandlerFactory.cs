using System.Collections.Specialized;
using System.IO;
using CefSharp;

namespace FintechBankApp.Desktop.Web;

public class AppSchemeHandlerFactory : ISchemeHandlerFactory
{
    private readonly string _wwwrootPath;

    public AppSchemeHandlerFactory(string wwwrootPath)
    {
        _wwwrootPath = wwwrootPath;
    }

    public IResourceHandler Create(IBrowser browser, IFrame frame, string schemeName, IRequest request)
    {
        var uri = new Uri(request.Url);
        var path = uri.AbsolutePath;

        if (path.StartsWith("/api/", StringComparison.OrdinalIgnoreCase) ||
            path.Equals("/api", StringComparison.OrdinalIgnoreCase))
        {
            return new AsyncApiProxyResourceHandler(request, uri);
        }

        return CreateStaticFileHandler(path);
    }

    private IResourceHandler CreateStaticFileHandler(string path)
    {
        var res = StaticFileResourceHandler.Resolve(_wwwrootPath, path);
        var stream = new MemoryStream(res.Body);

        var cleanMime = res.ContentType;
        if (cleanMime.Contains(';'))
        {
            cleanMime = cleanMime.Split(';')[0].Trim();
        }

        var handler = ResourceHandler.FromStream(stream, mimeType: cleanMime);
        handler.StatusCode = res.StatusCode;

        if (res.ContentType.Contains("charset"))
        {
            handler.Headers.Add("Content-Type", res.ContentType);
        }

        return handler;
    }
}

public class AsyncApiProxyResourceHandler : ResourceHandler
{
    private readonly IRequest _request;
    private readonly Uri _uri;

    public AsyncApiProxyResourceHandler(IRequest request, Uri uri)
    {
        _request = request;
        _uri = uri;
    }

    public override CefReturnValue ProcessRequestAsync(IRequest request, ICallback callback)
    {
        var method = request.Method;
        var relativeAndQuery = _uri.PathAndQuery;

        var headers = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        if (request.Headers != null)
        {
            foreach (string key in request.Headers)
            {
                var val = request.Headers[key];
                if (val != null) headers[key] = val;
            }
        }

        byte[]? body = null;
        if (request.PostData != null && request.PostData.Elements.Count > 0)
        {
            using var ms = new MemoryStream();
            foreach (var element in request.PostData.Elements)
            {
                if (element.Bytes != null && element.Bytes.Length > 0)
                {
                    ms.Write(element.Bytes, 0, element.Bytes.Length);
                }
            }
            body = ms.ToArray();
        }

        Task.Run(async () =>
        {
            try
            {
                var proxyResp = await ApiProxy.ForwardAsync(method, relativeAndQuery, headers, body);

                StatusCode = proxyResp.StatusCode;
                StatusText = proxyResp.StatusDescription;
                MimeType = proxyResp.ContentType;

                if (proxyResp.Headers != null)
                {
                    foreach (var (k, v) in proxyResp.Headers)
                    {
                        Headers.Add(k, v);
                    }
                }

                Stream = new MemoryStream(proxyResp.Body);
            }
            catch (Exception ex)
            {
                StatusCode = 500;
                StatusText = "Proxy Error";
                MimeType = "application/json";
                Stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes($"{{\"error\":true,\"message\":\"{ex.Message}\"}}"));
            }
            finally
            {
                if (!callback.IsDisposed)
                {
                    callback.Continue();
                }
            }
        });

        return CefReturnValue.ContinueAsync;
    }
}
