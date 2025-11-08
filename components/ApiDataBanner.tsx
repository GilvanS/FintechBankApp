import React from 'react';

const MapIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 16.382V5.618a1 1 0 00-.553-.894L15 2m-6 5l6-3m-6 3l6 3" />
    </svg>
);

const NasaIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
);

const WorldBankIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9V3m0 18a9 9 0 009-9m-9 9a9 9 0 00-9-9" />
    </svg>
);

const ApiLinkItem: React.FC<{ icon: React.ReactNode; title: string; description: string; url: string }> = ({ icon, title, description, url }) => {
    return (
        <li className="flex items-start space-x-3">
            <div className="flex-shrink-0 pt-0.5 text-green-400">{icon}</div>
            <div>
                 <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    <strong className="text-white">{title}</strong>
                </a>
                <p className="text-gray-300">{description}</p>
            </div>
        </li>
    );
};


const ApiDataBanner: React.FC = () => {
    return (
        <div className="bg-gray-900 p-4 rounded-lg">
            <h3 className="text-lg font-bold text-white mb-3">Explore Dados Públicos</h3>
            <ul className="space-y-4 text-sm">
                <ApiLinkItem 
                    icon={<MapIcon />} 
                    title="OpenStreetMap API" 
                    description="Acesse dados geográficos abertos e colaborativos de todo o mundo."
                    url="https://www.openstreetmap.org/api"
                />
                <ApiLinkItem 
                    icon={<NasaIcon />} 
                    title="NASA API" 
                    description="Explore o universo com imagens, dados de asteroides e informações das missões."
                    url="https://api.nasa.gov/"
                />
                <ApiLinkItem 
                    icon={<WorldBankIcon />} 
                    title="World Bank API" 
                    description="Consulte indicadores de desenvolvimento global sobre economia, saúde e educação."
                    url="https://datahelpdesk.worldbank.org/knowledgebase/articles/889386-developer-information-overview"
                />
            </ul>
        </div>
    );
};

export default ApiDataBanner;