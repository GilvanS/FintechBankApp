import React from 'react';
// FIX: Corrected import path for User type from parent directory.
import { User } from '../types';
import InfoBanner from './InfoBanner';
import ApiDataBanner from './ApiDataBanner'; // Import the new component

interface MyDataProps {
    user: User;
    onBack: () => void;
    onNavigateToEdit: () => void;
}

const InfoRow: React.FC<{ label: string; value: string | undefined; testId?: string }> = ({ label, value, testId }) => (
    <div data-testid={testId ? `${testId}-row` : undefined}>
        <p className="text-sm text-gray-400">{label}</p>
        <p className="text-white font-semibold" data-testid={testId} data-cy={testId} data-playwright={testId}>{value || '-'}</p>
    </div>
);

const MyData: React.FC<MyDataProps> = ({ user, onBack, onNavigateToEdit }) => {
    return (
        <div
            className="bg-background-dark text-white p-4 min-h-full w-full max-w-md mx-auto pb-28 test-my-data"
            id="my-data"
            data-testid="my-data"
            data-cy="my-data"
            data-playwright="my-data"
        >
            <header className="flex items-center mb-6">
                <button
                    onClick={onBack}
                    className="mr-2 p-2 rounded-full hover:bg-white/10 test-my-data-back"
                    id="btn-my-data-back"
                    name="my-data-back"
                    data-testid="my-data-back-button"
                    data-cy="my-data-back-button"
                    data-playwright="my-data-back-button"
                    aria-label="Voltar"
                    type="button"
                >
                     <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
                </button>
                <h2 className="text-2xl font-bold text-white">Meus Dados</h2>
            </header>

            <main className="space-y-6">
                <div className="bg-surface-dark p-4 rounded-lg space-y-4">
                    <InfoRow testId="mydata-fullname" label="Nome Completo" value={user.fullName} />
                    <InfoRow testId="mydata-username" label="Nome de Usuário" value={user.username} />
                    <InfoRow testId="mydata-email" label="Email" value={user.email} />
                     <div data-testid="mydata-description-row">
                        <p className="text-sm text-gray-400">Descrição</p>
                        <p className="text-white italic" data-testid="mydata-description" data-cy="mydata-description" data-playwright="mydata-description">{user.profileDescription || 'Sem descrição.'}</p>
                    </div>
                </div>

                <button
                    onClick={onNavigateToEdit}
                    className="w-full py-3 font-semibold text-background-dark bg-primary rounded-lg hover:opacity-90 transition-colors test-my-data-edit"
                    id="btn-my-data-edit"
                    name="my-data-edit"
                    data-testid="my-data-edit-button"
                    data-cy="my-data-edit-button"
                    data-playwright="my-data-edit-button"
                    aria-label="Editar Perfil"
                    type="button"
                >
                    Editar Perfil
                </button>

                <InfoBanner />
                <ApiDataBanner />
            </main>
        </div>
    );
};

export default MyData;