import React from 'react';
import { Loader2, Check, X, Minus } from 'lucide-react';

export type TimelineStatus = 'completed' | 'active' | 'pending' | 'failed';

export interface TimelineStep {
    title: string;
    description: string;
    status: TimelineStatus;
}

const ICONS: Record<TimelineStatus, React.ReactElement> = {
    completed: <Check className="w-3 h-3" />,
    active: <Loader2 className="w-3 h-3 animate-spin" />,
    failed: <X className="w-3 h-3" />,
    pending: <Minus className="w-3 h-3" />,
};

const DOT_CLASSES: Record<TimelineStatus, string> = {
    completed: 'completed',
    active: 'active',
    failed: 'failed',
    pending: 'pending',
};

const TEXT_CLASSES: Record<TimelineStatus, { title: string; desc: string }> = {
    completed: { title: 'text-earth-900', desc: 'text-earth-500' },
    active: { title: 'text-earth-900 font-bold', desc: 'text-gold-500' },
    failed: { title: 'text-rose-600 font-semibold', desc: 'text-rose-500' },
    pending: { title: 'text-earth-500', desc: 'text-earth-500' },
};

const Timeline: React.FC<{ steps: TimelineStep[] }> = ({ steps }) => {
    return (
        <div className="space-y-0">
            {steps.map((step, index) => (
                <div key={index} className="timeline-item">
                    <div className={`timeline-dot ${DOT_CLASSES[step.status]}`}>
                        {ICONS[step.status]}
                    </div>
                    <div className="text-sm">
                        <div className={`font-semibold ${TEXT_CLASSES[step.status].title}`}>{step.title}</div>
                        <div className={`text-xs ${TEXT_CLASSES[step.status].desc}`}>{step.description}</div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default Timeline;