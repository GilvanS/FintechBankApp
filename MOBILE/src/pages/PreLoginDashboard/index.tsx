import React from 'react';
import {
  IonContent,
  IonPage,
  IonButton,
  IonIcon,
  IonText,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons
} from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { arrowForward, scan, documentText, card, basket, settingsOutline } from 'ionicons/icons';
import './PreLoginDashboard.css';

const PreLoginDashboard: React.FC = () => {
  const history = useHistory();

  const goToLogin = () => {
    history.push('/login');
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar color="dark">
          <IonTitle>Olá!</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => history.push('/login')}>
              <IonIcon slot="icon-only" icon={settingsOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent color="dark" className="ion-padding" fullscreen>
        <div className="grid-container">
            <div className="grid-item">
                <IonIcon icon={arrowForward} />
                <IonText>PIX e transferir</IonText>
            </div>
            <div className="grid-item">
                <IonIcon icon={scan} />
                <IonText>Pagar</IonText>
            </div>
            <div className="grid-item">
                <IonIcon icon={documentText} />
                <IonText>Extrato</IonText>
            </div>
            <div className="grid-item">
                <IonIcon icon={card} />
                <IonText>Cartões</IonText>
            </div>
            <div className="grid-item">
                <IonIcon icon={basket} />
                <IonText>Marketplace</IonText>
            </div>
        </div>

        <div className="bottom-buttons">
            <IonButton expand="block" className="login-main-button" onClick={goToLogin}>
                Acessar minha conta
            </IonButton>
            <IonButton expand="block" fill="clear" className="signup-button">
                Não é cliente? Abra uma conta
            </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default PreLoginDashboard;
