package com.fintechbank.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Habilitar depuração da WebView para Appium
        // Isso permite que o Appium acesse o conteúdo da WebView
        WebView.setWebContentsDebuggingEnabled(true);
    }
}
