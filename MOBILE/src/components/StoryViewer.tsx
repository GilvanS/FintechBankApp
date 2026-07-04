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
  const hasImage = !!currentStory.image;
  const accentBg = currentStory.accent || 'bg-volt-yellow';

  return (
    <div
        className={`absolute inset-0 z-50 flex flex-col p-4 select-none animate-fade-in overflow-hidden ${hasImage ? 'bg-black' : accentBg}`}
    >
      {/* Background Image (opcional) */}
      {hasImage && (
        <>
          <img
            src={currentStory.image}
            alt={currentStory.title}
            className="absolute inset-0 w-full h-full object-cover animate-ken-burns"
            key={currentStoryIndex} // Re-trigger animation on change
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20"></div>
        </>
      )}

      {/* Main Container */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Progress Bars */}
        <div className="flex w-full space-x-1.5 mt-2">
          {stories.map((_, index) => (
            <div key={index} className={`flex-1 h-2 overflow-hidden ${hasImage ? 'bg-white/30 rounded-full' : 'bg-black/15 border-2 border-black'}`}>
              <div
                className={hasImage ? 'h-full bg-white' : 'h-full bg-black'}
                style={{
                  width: `${index < currentStoryIndex ? 100 : (index === currentStoryIndex ? progress : 0)}%`,
                  transition: index === currentStoryIndex ? 'width 0.05s linear' : 'none',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className={`flex items-center justify-between mt-4 ${hasImage ? 'text-white' : 'text-black'}`}>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-9 h-9 font-black bg-black text-volt-lime border-2 border-black">V</div>
            <span className="text-sm font-black uppercase tracking-wide">Volt Stories</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="relative z-30 w-9 h-9 flex items-center justify-center text-2xl font-black leading-none bg-white text-black border-2 border-black hover:bg-black hover:text-white transition-colors"
          >
            &times;
          </button>
        </div>

        {/* Spacer to push content to bottom */}
        <div className="flex-grow"></div>

        {/* Content */}
        <div className="w-full max-w-sm mx-auto pb-10" key={currentStoryIndex}>
          {currentStory.badge && (
            <span className="inline-block mb-4 -rotate-1 bg-black text-white text-[10px] font-black uppercase tracking-[0.18em] px-3 py-1.5">
              {currentStory.badge}
            </span>
          )}

          {currentStory.icon && !hasImage && (
            <div className="mb-4 w-16 h-16 flex items-center justify-center text-3xl bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              {currentStory.icon}
            </div>
          )}

          <h2
            className={`mb-2 text-3xl font-black uppercase leading-[0.95] ${hasImage ? 'text-white' : 'text-black'}`}
            style={hasImage ? { textShadow: '0 2px 4px rgba(0,0,0,0.5)' } : undefined}
          >
            {currentStory.title}
          </h2>
          <p
            className={`text-sm font-semibold leading-snug ${hasImage ? 'text-gray-200' : 'text-black/70'}`}
            style={hasImage ? { textShadow: '0 1px 3px rgba(0,0,0,0.5)' } : undefined}
          >
            {currentStory.description}
          </p>

          {currentStory.stats && currentStory.stats.length > 0 && (
            <div className="mt-4 space-y-2">
              {currentStory.stats.map((s, i) => (
                <div key={i} className="flex items-center justify-between bg-white border-2 border-black px-4 py-2.5 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                  <span className="text-xs font-bold uppercase tracking-wide text-black/70">{s.label}</span>
                  <span className="text-sm font-black text-black">{s.value}</span>
                </div>
              ))}
            </div>
          )}

          {currentStory.status && (
            <span className="inline-block mt-4 bg-black text-volt-lime text-xs font-black uppercase tracking-widest px-4 py-2 border-2 border-black">
              {currentStory.status}
            </span>
          )}

          {currentStory.url && (
            <a
              href={currentStory.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()} // Prevent story navigation
              className="relative z-30 block mt-4 text-center px-5 py-2.5 text-sm font-black uppercase text-black bg-volt-lime border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all"
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
