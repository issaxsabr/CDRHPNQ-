
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
    
    // Check for reduced motion preference
    const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
        <div className="fixed inset-0 flex items-center justify-center bg-earth-900 z-[200]">
            {/* Aurora background - Conditional Rendering */}
            {!prefersReducedMotion && <div className="aurora absolute inset-0"></div>}
            
            {/* Content */}
            <div className="relative z-10 text-center animate-fade-in">
                <div className="blob-morph w-24 h-24 md:w-32 md:h-32 mx-auto mb-8 bg-gradient-to-br from-gold-500 to-yellow-600 flex items-center justify-center shadow-2xl shadow-gold-500/10">
                    <Sparkles className="w-16 h-16 text-white animate-spin-slow" />
                </div>
                
                {/* Company name without glitch */}
                <h1 className="text-4xl font-bold text-beige-100 mb-4">
                    CDRHPNQ
                </h1>
                
                {/* Loading dots */}
                <div className="loading-dots text-gold-500 justify-center mb-6">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                
                {/* Progress bar */}
                <div className="max-w-xs mx-auto">
                    <div className="h-1 bg-black/20 rounded-full overflow-hidden">
                        <div 
                            className="h-full progress-bar bg-gradient-to-r from-gold-500 to-yellow-600 rounded-full transition-all duration-1000 ease-out" 
                            style={{ width: `${progress}%` }}
                        >
                        </div>
                    </div>
                    
                    <p 
                        key={currentText} /* Remount component on text change to restart animation */
                        className="text-sm text-beige-300 mt-4 typewriter"
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
