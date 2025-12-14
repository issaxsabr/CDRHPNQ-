
import React from 'react';
import { Clock, StopCircle } from 'lucide-react';
import Timeline, { TimelineStep } from './Timeline';

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
        <div className="max-w-4xl mx-auto mb-8 p-5 rounded-2xl bg-white border border-slate-200 shadow-xl flex flex-col sm:flex-row gap-6 animate-fade-in-up">
            {/* Left Side: Timeline */}
            <div className="w-full sm:w-1/3 border-b sm:border-b-0 sm:border-r border-slate-100 pb-4 sm:pb-0 sm:pr-6">
                <h4 className="text-sm font-bold text-slate-800 mb-4">Progression</h4>
                <Timeline steps={timelineSteps} />
            </div>

            {/* Right Side: Progress Bar & Controls */}
            <div className="flex-1 flex flex-col justify-center gap-4">
                <div className="flex justify-between items-center">
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-800">Traitement du lot en cours</span>
                        <span className="text-xs text-slate-500">Ligne {progress} sur {total}</span>
                    </div>
                    {estimatedTimeLeft && (
                        <span className="hidden sm:flex text-xs items-center gap-1.5 text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100 font-mono">
                            <Clock className="w-3.5 h-3.5" /> ~ {estimatedTimeLeft}
                        </span>
                    )}
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden relative">
                    <div
                        className="h-2 rounded-full transition-all duration-500 ease-out relative bg-gradient-to-r from-indigo-500 to-violet-500"
                        style={{ width: `${(progress / total) * 100}%` }}
                    ></div>
                </div>
                 {isLoading && (
                    <button onClick={onStop} className="flex self-start items-center gap-1.5 text-xs font-medium text-rose-500 hover:text-rose-600 border border-rose-200 rounded-lg px-3 py-1.5 bg-rose-50 hover:bg-rose-100 transition-colors">
                        <StopCircle className="w-3.5 h-3.5" /> Arrêter
                    </button>
                )}
            </div>
        </div>
    );
};

export default BatchProgress;
