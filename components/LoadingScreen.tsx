
import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';

const LOADING_STAGES = [
    { text: "Initialisation du moteur...", duration: 2000, progress: 20 },
    { text: "Vérification de la session...", duration: 1500, progress: 50 },
    { text: "Chargement des modules...", duration: 2000, progress: 80 },
    { text: "Finalisation...", duration: 1000, progress: 100 },
];

const LoadingScreen: React.FC = () => {
    const [stageIndex, setStageIndex] = useState(0);
    const [progress, setProgress] = useState(10);
    const [currentText, setCurrentText] = useState("Initialisation...");

    useEffect(() => {
        const currentStage = LOADING_STAGES[stageIndex];
        if (!currentStage) return;

        // Set text and trigger typewriter animation
        setCurrentText(currentStage.text);
        
        // Animate progress bar
        const progressTimeout = setTimeout(() => {
             setProgress(currentStage.progress);
        }, 100);

        // Move to next stage
        const stageTimeout = setTimeout(() => {
            if (stageIndex < LOADING_STAGES.length - 1) {
                setStageIndex(stageIndex + 1);
            }
        }, currentStage.duration);

        return () => {
            clearTimeout(progressTimeout);
            clearTimeout(stageTimeout);
        };
    }, [stageIndex]);
    
    // CSS variable for typewriter effect
    const typewriterStyle = {
        '--char-count': currentText.length
    } as React.CSSProperties;

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-slate-900 z-[200]">
            {/* Aurora background */}
            <div className="aurora absolute inset-0"></div>
            
            {/* Content */}
            <div className="relative z-10 text-center animate-fade-in">
                <div className="blob-morph w-32 h-32 mx-auto mb-8 bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-2xl shadow-indigo-500/20">
                    <Sparkles className="w-16 h-16 text-white animate-spin-slow" />
                </div>
                
                {/* Company name without glitch */}
                <h1 className="text-4xl font-bold text-white mb-4">
                    CDRHPNQ
                </h1>
                
                {/* Loading dots */}
                <div className="loading-dots text-indigo-400 justify-center mb-6">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                
                {/* Progress bar */}
                <div className="max-w-xs mx-auto">
                    <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                            className="h-full progress-bar bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-1000 ease-out" 
                            style={{ width: `${progress}%` }}
                        >
                        </div>
                    </div>
                    
                    <p 
                        key={currentText} /* Remount component on text change to restart animation */
                        className="text-sm text-slate-400 mt-4 typewriter"
                        style={typewriterStyle}
                    >
                        {currentText}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default LoadingScreen;