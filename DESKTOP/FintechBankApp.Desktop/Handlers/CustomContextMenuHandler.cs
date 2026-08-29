using System.Windows.Forms;
using CefSharp;

namespace FintechBankApp.Desktop.Handlers;

public class CustomContextMenuHandler : IContextMenuHandler
{
    public void OnBeforeContextMenu(IWebBrowser chromiumWebBrowser, IBrowser browser, IFrame frame, IContextMenuParams parameters, IMenuModel model)
    {
        // Adiciona a opcao "Inspecionar Elemento (DevTools)" no menu de botao direito
        model.AddSeparator();
        model.AddItem((CefMenuCommand)26501, "Inspecionar elemento (DevTools)");
    }

    public bool OnContextMenuCommand(IWebBrowser chromiumWebBrowser, IBrowser browser, IFrame frame, IContextMenuParams parameters, CefMenuCommand commandId, CefEventFlags eventFlags)
    {
        if ((int)commandId == 26501)
        {
            browser.GetHost().ShowDevTools();
            return true;
        }
        return false;
    }

    public void OnContextMenuDismissed(IWebBrowser chromiumWebBrowser, IBrowser browser, IFrame frame) { }
    public bool RunContextMenu(IWebBrowser chromiumWebBrowser, IBrowser browser, IFrame frame, IContextMenuParams parameters, IMenuModel model, IRunContextMenuCallback callback) => false;
}
