using System;
using System.IO;
using System.Windows.Forms;
using CefSharp;
using CefSharp.WinForms;
using FintechBankApp.Desktop.Web;

namespace FintechBankApp.Desktop;

static class Program
{
    public const string AppScheme = "https";
    public const string AppHost = "fintech.local";
    public const string AppBasePath = "/FintechBankApp/";
    public static string StartUrl => $"{AppScheme}://{AppHost}{AppBasePath}";

    [STAThread]
    static void Main()
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        var baseDir = AppDomain.CurrentDomain.BaseDirectory;
        var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        var cachePath = Path.Combine(localAppData, "FintechBankApp", "CefCacheWinForms");
        var wwwrootPath = Path.Combine(baseDir, "wwwroot");

        var settings = new CefSettings
        {
            CachePath = cachePath,
            RemoteDebuggingPort = 9222
        };

        // =========================================================================
        // PERFORMANCE & FLUIDEZ PARA CEFSHARP (GPU ON)
        // =========================================================================
        // 1. Removemos flags de desativacao de GPU/Compositing que travavam o renderer em CPU.
        // 2. Desativa apenas aceleração por software legado que causa conflito no Win11.
        settings.CefCommandLineArgs.Add("disable-software-rasterizer", "1");
        
        // 3. Ativa agendamento de alta performance e suporte a GPU moderna
        settings.CefCommandLineArgs.Add("enable-gpu-rasterization", "1");
        settings.CefCommandLineArgs.Add("enable-zero-copy", "1");

        settings.RegisterScheme(new CefCustomScheme
        {
            SchemeName = AppScheme,
            DomainName = AppHost,
            IsSecure = true,
            IsCorsEnabled = true,
            IsFetchEnabled = true,
            SchemeHandlerFactory = new AppSchemeHandlerFactory(wwwrootPath)
        });

        Cef.Initialize(settings);

        Application.Run(new MainForm());
    }
}
