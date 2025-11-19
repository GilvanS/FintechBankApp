import React, { useState, useCallback } from 'react';
import {
  IonContent,
  IonPage,
  IonInput,
  IonButton,
  IonLabel,
  IonItem,
  IonText,
  IonSpinner,
  IonModal,
  IonFooter,
  IonIcon,
  useIonViewWillEnter,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { settingsOutline, checkmarkCircle } from 'ionicons/icons';
import { Preferences } from '@capacitor/preferences';
import api, { setApiBaseUrl } from '../../services/api';
import './Login.css'; // Carrega o novo CSS

const Login: React.FC = () => {
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiUrl, setApiUrl] = useState('');
  const [tempApiUrl, setTempApiUrl] = useState('');
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  const history = useHistory();

  const checkServerStatus = useCallback(async (url: string | null) => {
    if (!url) {
      setServerStatus('offline');
      return;
    }
    setServerStatus('checking');
    try {
      setApiBaseUrl(url); // Define a URL antes de testar
      await api.get('/', { timeout: 5000 });
      setServerStatus('online');
    } catch (err) {
      setServerStatus('offline');
    }
  }, []);

  useIonViewWillEnter(() => {
    const init = async () => {
      const { value } = await Preferences.get({ key: 'apiBaseUrl' });
      setApiUrl(value || '');
      setTempApiUrl(value || '');
      await checkServerStatus(value);
    };
    init();
  });

  const handleLogin = async () => {
    if (serverStatus !== 'online') {
      setError('Servidor offline. Verifique a conexão e a configuração da API.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/login', { cpf, password });
      const { token } = response.data;
      await Preferences.set({ key: 'token', value: token });
      history.push('/home');
    } catch (err) {
      setError('CPF ou senha inválidos.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    await Preferences.set({ key: 'apiBaseUrl', value: tempApiUrl });
    setApiUrl(tempApiUrl);
    setShowSettings(false);
    await checkServerStatus(tempApiUrl);
  };

  const handleResetSettings = async () => {
    await Preferences.remove({ key: 'apiBaseUrl' });
    setApiUrl('');
    setTempApiUrl('');
    setApiBaseUrl('');
    setServerStatus('offline');
  };

  return (
    <IonPage>
      <IonContent className="login-content" scrollY={false}>
        <div className="login-container">
          <div className="login-header">
            <div className="fintech-logo">
              <IonIcon icon={checkmarkCircle} /> Fintech
            </div>
            <div className="access-account-text">Acesse sua conta</div>
          </div>

          <IonItem className="input-item">
            <IonLabel position="floating">CPF</IonLabel>
            <IonInput value={cpf} onIonChange={(e) => setCpf(e.detail.value!)} type="text" placeholder="999.999.999-99" />
          </IonItem>

          <IonItem className="input-item">
            <IonLabel position="floating">Senha</IonLabel>
            <IonInput value={password} onIonChange={(e) => setPassword(e.detail.value!)} type="password" placeholder="••••••••" />
          </IonItem>

          <div className="forgot-password">
            <a href="#">Esqueci minha senha</a>
          </div>

          {error && <IonText color="danger"><p className="ion-text-center">{error}</p></IonText>}
          
          <div className="login-button-container">
            <IonButton expand="full" onClick={handleLogin} disabled={loading}>
              {loading ? <IonSpinner /> : 'Entrar'}
            </IonButton>
          </div>

          <div className="signup-link">
            <p>Não tem uma conta? <a href="#">Cadastre-se</a></p>
          </div>
        </div>
      </IonContent>

      <IonFooter className="status-footer">
        <div className="footer-content">
          <div className="server-status">
            <div className={`status-dot ${serverStatus}`}></div>
            <IonText>{apiUrl ? `Servidor: ${apiUrl}` : 'Servidor: Não configurado'}</IonText>
          </div>
          <div className="footer-actions">
            <IonButton fill="clear" size="small" onClick={() => checkServerStatus(apiUrl)}>Re-testar</IonButton>
            <IonButton fill="clear" onClick={() => setShowSettings(true)}>
              <IonIcon slot="icon-only" icon={settingsOutline} />
            </IonButton>
          </div>
        </div>
      </IonFooter>

      <IonModal isOpen={showSettings} onDidDismiss={() => setShowSettings(false)} cssClass="settings-modal">
        <div className="modal-content">
          <h2 className="modal-title">Endereço da API do Servidor</h2>
          <IonItem className="modal-input">
            <IonInput
              value={tempApiUrl}
              onIonChange={(e) => setTempApiUrl(e.detail.value!)}
              placeholder="https://seu-servidor.ngrok.io"
            />
          </IonItem>
          <div className="modal-buttons">
            <IonButton className="save-button" onClick={handleSaveSettings}>Salvar</IonButton>
            <IonButton className="reset-button" onClick={handleResetSettings}>Resetar</IonButton>
          </div>
        </div>
      </IonModal>
    </IonPage>
  );
};

export default Login;
