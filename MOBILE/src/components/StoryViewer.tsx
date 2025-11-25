import React, { useState, useEffect, useRef } from 'react';
// FIX: Corrected import path for Story type from parent directory.
import { Story } from '../types';

interface StoryViewerProps {
  stories: Story[];
  onClose: () => void;
}

const STORY_DURATION = 7000; // 7 seconds

const StoryViewer: React.FC<StoryViewerProps> = ({ stories, onClose }) => {
  const [currentStoryIndex, setCurrentStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressStartTimeRef = useRef<number>(Date.now());

  const goToNextStory = () => {
    if (currentStoryIndex < stories.length - 1) {
      setCurrentStoryIndex(currentStoryIndex + 1);
    } else {
      onClose();
    }
  };
  
  const goToPreviousStory = () => {
    if (currentStoryIndex > 0) {
      setCurrentStoryIndex(currentStoryIndex - 1);
    }
  };

  useEffect(() => {
      setProgress(0);
  }, [currentStoryIndex]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    progressStartTimeRef.current = Date.now();
    
    timerRef.current = setInterval(() => {
        const elapsedTime = Date.now() - progressStartTimeRef.current;
        const currentProgress = (elapsedTime / STORY_DURATION) * 100;

        if (currentProgress >= 100) {
            goToNextStory();
        } else {
            setProgress(currentProgress);
        }
    }, 16); // ~60fps

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentStoryIndex]);


  const handleTap = (e: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, currentTarget } = e;
    const { left, width } = currentTarget.getBoundingClientRect();
    const tapPosition = clientX - left;
    
    if (tapPosition < width * 0.3) {
      goToPreviousStory();
    } else {
      goToNextStory();
    }
  };

  const currentStory = stories[currentStoryIndex];

  return (
    <div 
        className="absolute inset-0 bg-black z-50 flex flex-col p-4 select-none animate-fade-in overflow-hidden"
    >
      {/* Background Image */}
      {currentStory.imageUrl && (
          <img 
          src={currentStory.imageUrl} 
            alt={currentStory.title}
            className="absolute inset-0 w-full h-full object-cover animate-ken-burns"
            key={currentStoryIndex} // Re-trigger animation on change
          />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20"></div>

      {/* Main Container */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Progress Bars */}
        <div className="flex w-full space-x-1 mt-2">
          {stories.map((_, index) => (
            <div key={index} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white"
                style={{
                  width: `${index < currentStoryIndex ? 100 : (index === currentStoryIndex ? progress : 0)}%`,
                  transition: index === currentStoryIndex ? 'width 0.05s linear' : 'none',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mt-4 text-white">
          <div className="flex items-center space-x-2">
            <div className="flex items-center justify-center w-8 h-8 font-bold bg-green-500 rounded-full text-black">F</div>
            <span className="text-sm font-semibold">Fintech App</span>
          </div>
          <button onClick={onClose} className="text-2xl text-white/80 hover:text-white transition-colors">&times;</button>
        </div>
        
        {/* Spacer to push content to bottom */}
        <div className="flex-grow"></div>

        {/* Content */}
        <div className="max-w-sm px-2 mx-auto text-center text-white pb-8">
          {!currentStory.imageUrl && (
            <div className="mb-4 text-6xl transition-transform duration-500 transform" key={currentStoryIndex}>{currentStory.icon}</div>
          )}
          <h2 className="mb-3 text-2xl font-bold leading-tight" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>{currentStory.title}</h2>
          <p className="text-md text-gray-200" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>{currentStory.description}</p>
          {currentStory.url && (
            <a
              href={currentStory.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()} // Prevent story navigation
              className="inline-block px-5 py-2 mt-4 text-sm font-bold text-black bg-green-400 rounded-full hover:bg-green-300 transition-colors"
            >
              Ler Notícia
            </a>
          )}
        </div>
      </div>
      
      {/* Click Handlers */}
      <div 
        className="absolute inset-0 z-20"
        onClick={handleTap}
      />

       <style>{`
        @keyframes fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        @keyframes ken-burns {
            0% {
                transform: scale(1) translate(0, 0);
                opacity: 0.8;
            }
            100% {
                transform: scale(1.1) translate(-2%, 2%);
                opacity: 1;
            }
        }
        .animate-ken-burns {
            animation: ken-burns ${STORY_DURATION / 1000}s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default StoryViewer;