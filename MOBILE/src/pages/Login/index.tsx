import React, { useState, useEffect } from 'react';
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonInput,
  IonButton,
  IonLabel,
  IonItem,
  IonText,
  IonSpinner,
  IonModal,
  IonButtons,
  IonIcon,
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { settingsOutline } from 'ionicons/icons'; // Importa o ícone de engrenagem
import { Preferences } from '@capacitor/preferences';
import api, { setApiBaseUrl } from '../../services/api';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false); // Estado para controlar a modal
  const [apiUrl, setApiUrl] = useState(''); // Estado para a URL da API dentro da modal
  const history = useHistory();

  // Carrega a URL salva na inicialização para usar no placeholder da modal
  useEffect(() => {
    const loadSavedUrl = async () => {
      const { value } = await Preferences.get({ key: 'apiBaseUrl' });
      if (value) {
        setApiUrl(value);
      }
    };
    loadSavedUrl();
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/auth/login', {
        email,
        password,
      });

      // Verifica se a baseURL está definida. Se não, pede para o usuário configurar.
      if (!api.defaults.baseURL) {
        setError('Endereço da API não configurado. Clique na engrenagem ⚙️ para configurar.');
        setLoading(false);
        return;
      }

      const { token } = response.data;
      await Preferences.set({ key: 'token', value: token });
      history.push('/home');
    } catch (err: any) {
      if (!api.defaults.baseURL) {
         setError('Endereço da API não configurado. Clique na engrenagem ⚙️ para configurar.');
      } else {
         setError('Falha no login. Verifique o endereço da API, email e senha.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Função para salvar a URL da modal
  const handleSaveSettings = async () => {
    await Preferences.set({ key: 'apiBaseUrl', value: apiUrl });
    setApiBaseUrl(apiUrl); // Define a URL na instância da API em tempo real
    setShowSettings(false); // Fecha a modal
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Login</IonTitle>
          {/* Botão de engrenagem para abrir a modal */}
          <IonButtons slot="end">
            <IonButton onClick={() => setShowSettings(true)}>
              <IonIcon slot="icon-only" icon={settingsOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonItem>
          <IonLabel position="floating">Email</IonLabel>
          <IonInput
            value={email}
            onIonChange={(e) => setEmail(e.detail.value!)}
            type="email"
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
        {error && <IonText color="danger"><p>{error}</p></IonText>}
        <IonButton expand="full" onClick={handleLogin} disabled={loading}>
          {loading ? <IonSpinner name="crescent" /> : 'Entrar'}
        </IonButton>

        {/* Modal de Configurações */}
        <IonModal isOpen={showSettings} onDidDismiss={() => setShowSettings(false)}>
          <IonHeader>
            <IonToolbar>
              <IonTitle>Configurar API</IonTitle>
              <IonButtons slot="end">
                <IonButton onClick={() => setShowSettings(false)}>Fechar</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonHeader>
          <IonContent className="ion-padding">
            <IonItem>
              <IonLabel position="floating">Endereço da API</IonLabel>
              <IonInput
                placeholder="ex: https://seu-ngrok.io"
                value={apiUrl}
                onIonChange={(e) => setApiUrl(e.detail.value!)}
                type="url"
              />
            </IonItem>
            <IonButton expand="full" onClick={handleSaveSettings}>
              Salvar
            </IonButton>
          </IonContent>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default Login;
