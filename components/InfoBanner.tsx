import React from 'react';

const BellIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
);

const SecurityIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
);

const TrendUpIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
);


const InfoBanner: React.FC = () => {
    return (
        <div className="bg-gray-900 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-white mb-3">Dicas e Avisos</h3>
            <ul className="space-y-4 text-sm">
                <li className="flex items-start space-x-3">
                    <div className="flex-shrink-0 pt-0.5 text-green-400"><BellIcon /></div>
                    <p className="text-gray-300">
                        <strong className="text-white">Renovação de Senha:</strong> Fique de olho nas notificações! Avisaremos por lá assim que sua solicitação for aprovada pelo administrador.
                    </p>
                </li>
                <li className="flex items-start space-x-3">
                    <div className="flex-shrink-0 pt-0.5 text-green-400"><SecurityIcon /></div>
                    <p className="text-gray-300">
                        <strong className="text-white">Dica de Segurança:</strong> Para não esquecer, use um gerenciador de senhas ou crie frases que só você entende, em vez de senhas curtas.
                    </p>
                </li>
                <li className="flex items-start space-x-3">
                    <div className="flex-shrink-0 pt-0.5 text-green-400"><TrendUpIcon /></div>
                    <p className="text-gray-300">
                        <strong className="text-white">Limite PIX:</strong> Precisando de um limite maior? Você pode solicitar um aumento a qualquer momento através da opção 'Segurança' no Menu.
                    </p>
                </li>
            </ul>
        </div>
    );
};

export default InfoBanner;