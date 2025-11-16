

import React from 'react';
// FIX: Corrected import path for Story type from parent directory.
import { Story } from '../types';

interface StoryHighlightsProps {
  stories: Story[];
  onSeeAll: () => void;
}

const StoryHighlights: React.FC<StoryHighlightsProps> = ({ stories, onSeeAll }) => {
    return (
        <div className="my-6">
            <h2 className="text-xl font-bold text-white mb-4">Descubra</h2>
            <div className="flex items-center space-x-4 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4">
                {stories.map((story, index) => (
                    <button key={index} onClick={onSeeAll} className="flex flex-col items-center space-y-2 flex-shrink-0 w-20 text-center group">
                        <div className="w-16 h-16 rounded-full border-2 border-purple-400 p-0.5 group-hover:scale-105 transition-transform">
                            <div className="w-full h-full rounded-full bg-gray-800 flex items-center justify-center text-2xl"
                                style={{
                                    backgroundImage: story.image ? `url(${story.image})` : 'none',
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                }}>
                                {!story.image && story.icon}
                            </div>
                        </div>
                        <span className="text-xs font-medium text-gray-300 truncate w-full">{story.title}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default StoryHighlights;