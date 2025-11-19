import React, { useState, useEffect, useCallback } from 'react';
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
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonFooter,
  IonIcon,
  useIonViewWillEnter,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { settingsOutline } from 'ionicons/icons';
import { Preferences } from '@capacitor/preferences';
import api, { setApiBaseUrl } from '../../services/api';
import './Login.css'; // Importando o CSS para estilização

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
      // Usamos um endpoint genérico que deve sempre responder, como o raiz.
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
      setApiBaseUrl(value || ''); // Configura a URL na api
      await checkServerStatus(value);
    };
    init();
  });

  const handleLogin = async () => {
    if (serverStatus !== 'online') {
      setError('Não é possível fazer login. O servidor está offline ou não foi configurado.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/login', {
        cpf,
        password,
      });
      const { token } = response.data;
      await Preferences.set({ key: 'token', value: token });
      history.push('/home'); // Navega para a home após login
    } catch (err) {
      setError('Falha no login. Verifique o CPF e a senha.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    await Preferences.set({ key: 'apiBaseUrl', value: tempApiUrl });
    setApiUrl(tempApiUrl);
    setApiBaseUrl(tempApiUrl);
    setShowSettings(false);
    await checkServerStatus(tempApiUrl);
  };
  
  const handleResetSettings = async () => {
    await Preferences.remove({ key: 'apiBaseUrl' });
    setApiUrl('');
    setTempApiUrl('');
    setApiBaseUrl('');
    setShowSettings(false);
    setServerStatus('offline');
  };
  
  const handleRetest = () => {
    checkServerStatus(apiUrl);
  };

  const openSettingsModal = () => {
    setTempApiUrl(apiUrl); // Garante que a modal abra com a URL atualmente em uso
    setShowSettings(true);
  };

  return (
    <IonPage>
      <IonContent className="ion-padding login-content" scrollY={false}>
        <div className="login-form">
          <IonItem>
            <IonLabel position="floating">CPF</IonLabel>
            <IonInput
              value={cpf}
              onIonChange={(e) => setCpf(e.detail.value!)}
              type="text"
            />
          </IonItem>
          <IonItem>
            <IonLabel position="floating">Senha</IonLabel>
            <IonInput
              value={password}
              onIonChange={(e) => setPassword(e.detail.value!)}
              type="password"
            />
          </IonItem>
          {error && <IonText color="danger"><p className="ion-text-center">{error}</p></IonText>}
          <IonButton className="login-button" expand="full" onClick={handleLogin} disabled={loading || serverStatus !== 'online'}>
            {loading ? <IonSpinner name="crescent" /> : 'Acessar minha conta'}
          </IonButton>
        </div>
      </IonContent>

      <IonFooter className="status-footer">
        <div className="footer-content">
          <div className="server-status">
            <div className={`status-dot ${serverStatus}`}></div>
            <IonText>Servidor: {apiUrl ? apiUrl.substring(0, 25) + '...' : 'Não configurado'}</IonText>
          </div>
          <div className="footer-actions">
            <IonButton fill="clear" color="primary" onClick={handleRetest}>Re-testar</IonButton>
            <IonButton fill="clear" onClick={openSettingsModal}>
              <IonIcon slot="icon-only" icon={settingsOutline} />
            </IonButton>
          </div>
        </div>
      </IonFooter>

      {/* Modal de Configurações */}
      <IonModal isOpen={showSettings} onDidDismiss={() => setShowSettings(false)} className="settings-modal">
          <div className="modal-content">
            <IonTitle className="modal-title">Endereço da API do Servidor</IonTitle>
            <IonItem className="modal-input">
                <IonInput
                    placeholder="http://192.168.0.1:3001"
                    value={tempApiUrl}
                    onIonChange={(e) => setTempApiUrl(e.detail.value!)}
                    type="url"
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
