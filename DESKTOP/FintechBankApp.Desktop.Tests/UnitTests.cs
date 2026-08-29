using Xunit;
using FintechBankApp.Desktop.Web;

namespace FintechBankApp.Desktop.Tests;

public class StaticFileResourceHandlerTests
{
    [Theory]
    [InlineData("/FintechBankApp/", "index.html", 200, "text/html")]
    [InlineData("/FintechBankApp/index.html", "index.html", 200, "text/html")]
    [InlineData("/FintechBankApp/assets/test.js", "assets/test.js", 200, "text/javascript")]
    [InlineData("/FintechBankApp/assets/test.css", "assets/test.css", 200, "text/css")]
    [InlineData("/FintechBankApp/login", "index.html", 200, "text/html")]
    [InlineData("/FintechBankApp/dashboard/cards", "index.html", 200, "text/html")]
    [InlineData("/FintechBankApp/assets/missing.png", "", 404, "text/plain")]
    public void Resolve_StaticAndSpaFallback_ReturnsExpected(string requestPath, string expectedFile, int expectedStatus, string expectedMime)
    {
        var tempDir = Path.Combine(Path.GetTempPath(), "FintechTestWwwroot_" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(tempDir);
        Directory.CreateDirectory(Path.Combine(tempDir, "assets"));

        File.WriteAllText(Path.Combine(tempDir, "index.html"), "<html><body>App</body></html>");
        File.WriteAllText(Path.Combine(tempDir, "assets", "test.js"), "console.log('test');");
        File.WriteAllText(Path.Combine(tempDir, "assets", "test.css"), "body { color: red; }");

        try
        {
            var response = StaticFileResourceHandler.Resolve(tempDir, requestPath);

            Assert.Equal(expectedStatus, response.StatusCode);
            Assert.StartsWith(expectedMime, response.ContentType);
            Assert.NotEmpty(response.Body);
        }
        finally
        {
            if (Directory.Exists(tempDir))
                Directory.Delete(tempDir, true);
        }
    }
}
