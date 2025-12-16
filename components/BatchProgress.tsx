import React from 'react';
import { Clock, StopCircle } from 'lucide-react';
import Timeline, { TimelineStep } from './Timeline';
import Button from './ui/Button';

interface BatchProgressProps {
    progress: number;
    total: number;
    estimatedTimeLeft: string | null;
    timelineSteps: TimelineStep[];
    onStop: () => void;
    isLoading: boolean;
}

const BatchProgress: React.FC<BatchProgressProps> = ({
    progress,
    total,
    estimatedTimeLeft,
    timelineSteps,
    onStop,
    isLoading
}) => {
    return (
        <div className="max-w-4xl mx-auto mb-8 p-5 rounded-2xl bg-white border border-beige-300 shadow-xl flex flex-col sm:flex-row gap-6 animate-fade-in-up">
            {/* Left Side: Timeline */}
            <div className="w-full sm:w-1/3 border-b sm:border-b-0 sm:border-r border-beige-200 pb-4 sm:pb-0 sm:pr-6">
                <h4 className="text-sm font-bold text-earth-900 mb-4">Progression</h4>
                <Timeline steps={timelineSteps} />
            </div>

            {/* Right Side: Progress Bar & Controls */}
            <div className="flex-1 flex flex-col justify-center gap-4">
                <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-earth-900">Traitement du lot en cours</span>
                        <span className="text-xs text-earth-500">Ligne {progress} sur {total}</span>
                    </div>
                    {estimatedTimeLeft && (
                        <span className="hidden sm:flex text-xs items-center gap-1.5 text-gold-600 bg-gold-500/10 px-2.5 py-1 rounded-md border border-gold-500/20 font-mono">
                            <Clock className="w-3.5 h-3.5" /> ~ {estimatedTimeLeft}
                        </span>
                    )}
                </div>
                <div className="w-full bg-beige-100 rounded-full h-2 overflow-hidden relative">
                    <div
                        className="h-2 rounded-full transition-all duration-500 ease-out relative bg-gradient-to-r from-gold-500 to-gold-600"
                        style={{ width: `${(progress / total) * 100}%` }}
                    ></div>
                </div>
                 {isLoading && (
                    <Button 
                        onClick={onStop} 
                        variant="danger-light"
                        size="sm"
                        className="self-start"
                        leftIcon={<StopCircle className="w-3.5 h-3.5" />}
                    >
                        Arrêter
                    </Button>
                )}
            </div>
        </div>
    );
};

export default BatchProgress;