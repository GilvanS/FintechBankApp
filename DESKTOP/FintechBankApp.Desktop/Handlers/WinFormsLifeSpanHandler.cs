using System;
using System.Diagnostics;
using System.Drawing;
using System.Windows.Forms;
using CefSharp;
using CefSharp.WinForms;

namespace FintechBankApp.Desktop.Handlers;

public class WinFormsLifeSpanHandler : ILifeSpanHandler
{
    public bool OnBeforePopup(
        IWebBrowser chromiumWebBrowser,
        IBrowser browser,
        IFrame frame,
        string targetUrl,
        string targetFrameName,
        WindowOpenDisposition targetDisposition,
        bool userGesture,
        IPopupFeatures popupFeatures,
        IWindowInfo windowInfo,
        IBrowserSettings browserSettings,
        ref bool noJavascriptAccess,
        out IWebBrowser? newWebView)
    {
        newWebView = null;

        if (targetDisposition == WindowOpenDisposition.CurrentTab || string.IsNullOrEmpty(targetUrl))
        {
            return false;
        }

        if (Uri.TryCreate(targetUrl, UriKind.Absolute, out var uri) &&
            !uri.Host.Equals(Program.AppHost, StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                Process.Start(new ProcessStartInfo(targetUrl) { UseShellExecute = true });
            }
            catch {}
            return true; // Cancela popup do Chromium e abre no navegador padrao
        }

        // Popups internos (janela WinForms com ChromiumWebBrowser nativo).
        //
        // O controle de origem é o próprio `chromiumWebBrowser`. O handle devolvido
        // por GetWindowHandle() é a janela nativa do Chromium, e Control.FromHandle
        // sobre ele não devolve um Form — o cast direto derrubava o aplicativo assim
        // que a página chamasse window.open.
        //
        // Este método roda na thread de IO do CEF, então tudo que toca em Control
        // precisa ser agendado na thread da interface.
        if (chromiumWebBrowser is Control origem && !origem.IsDisposed)
        {
            // Lidos agora: popupFeatures pertence ao CEF e não sobrevive até o
            // callback rodar na outra thread.
            var largura = popupFeatures.Width.HasValue && popupFeatures.Width.Value > 200 ? popupFeatures.Width.Value : 900;
            var altura = popupFeatures.Height.HasValue && popupFeatures.Height.Value > 200 ? popupFeatures.Height.Value : 600;
            var titulo = string.IsNullOrWhiteSpace(targetFrameName) ? "Volt Fintech" : targetFrameName;
            var url = targetUrl;

            try
            {
                origem.BeginInvoke(new Action(() =>
                {
                    var popupForm = new Form
                    {
                        Text = titulo,
                        Size = new Size(largura, altura),
                        StartPosition = FormStartPosition.CenterScreen
                    };

                    var childBrowser = new ChromiumWebBrowser(url)
                    {
                        Dock = DockStyle.Fill,
                        LifeSpanHandler = new WinFormsLifeSpanHandler(),
                        DownloadHandler = new AppDownloadHandler()
                    };

                    popupForm.Controls.Add(childBrowser);
                    popupForm.Show(origem.FindForm());
                }));
            }
            catch (InvalidOperationException)
            {
                // A janela de origem pode ter sido fechada entre a chamada e o
                // agendamento; nesse caso não há popup a abrir.
            }
        }

        return true;
    }

    public void OnAfterCreated(IWebBrowser chromiumWebBrowser, IBrowser browser) { }
    public bool DoClose(IWebBrowser chromiumWebBrowser, IBrowser browser) => false;
    public void OnBeforeClose(IWebBrowser chromiumWebBrowser, IBrowser browser) { }
}
