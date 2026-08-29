using System;
using System.Drawing;
using System.Windows.Forms;
using CefSharp;
using CefSharp.WinForms;
using FintechBankApp.Desktop.Handlers;

namespace FintechBankApp.Desktop;

public class MainForm : Form
{
    private readonly ChromiumWebBrowser _browser;

    public MainForm()
    {
        Text = "Volt Fintech";
        Size = new Size(1280, 900);
        StartPosition = FormStartPosition.CenterScreen;
        WindowState = FormWindowState.Maximized;

        _browser = new ChromiumWebBrowser(Program.StartUrl)
        {
            Dock = DockStyle.Fill,
            LifeSpanHandler = new WinFormsLifeSpanHandler(),
            DownloadHandler = new AppDownloadHandler(),
            MenuHandler = new CustomContextMenuHandler()
        };

        // O descarte acontecia em FormClosing, antes de a janela fechar de fato:
        // o CEF ainda podia acionar callbacks sobre um objeto já liberado. Em
        // FormClosed a janela já saiu, e o controle é liberado com segurança.
        FormClosed += (s, e) => _browser.Dispose();

        Controls.Add(_browser);
    }
}
