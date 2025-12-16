
// FIX: Import `useEffect` from `react` to fix 'Cannot find name' error.
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { Check, AlertTriangle, X, Info } from 'lucide-react';
import { ToastMessage, ToastType } from '../types';

type ToastContextType = {
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// --- Sub-Components for Toast Display ---

const Toast: React.FC<{ toast: ToastMessage; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  useEffect(() => {
    if (toast.type !== 'error') {
      const timer = setTimeout(() => {
        onRemove(toast.id);
      }, toast.duration || 4000);
      return () => clearTimeout(timer);
    }
  }, [toast, onRemove]);

  const ICONS: Record<ToastType, React.ReactElement> = {
    success: <Check className="w-6 h-6 text-white" />,
    error: <AlertTriangle className="w-6 h-6 text-white" />,
    info: <Info className="w-6 h-6 text-white" />
  };

  const BORDER_COLORS: Record<ToastType, string> = {
    success: 'border-emerald-500',
    error: 'border-rose-500',
    info: 'border-yellow-500'
  };
  
  const ICON_BG_COLORS: Record<ToastType, string> = {
    success: 'bg-emerald-500',
    error: 'bg-rose-500',
    info: 'bg-yellow-500'
  };

  const PROGRESS_BG_COLORS: Record<ToastType, string> = {
    success: 'bg-emerald-500',
    error: 'bg-rose-500',
    info: 'bg-yellow-500'
  }

  const isError = toast.type === 'error';

  return (
    <div className={`notification-enter glass rounded-xl p-4 shadow-elegant max-w-sm w-full border-l-4 ${BORDER_COLORS[toast.type]}`}>
      <div className="flex items-start gap-3">
        <div className={isError ? 'animate-shake' : 'animate-bounce'}>
          <div className={`w-10 h-10 ${ICON_BG_COLORS[toast.type]} rounded-full flex items-center justify-center`}>
            {ICONS[toast.type]}
          </div>
        </div>
        
        <div className="flex-1 pt-1">
          <h4 
            className="font-bold text-earth-900 mb-0.5"
          >
            {toast.title}
          </h4>
          <p className="text-sm text-earth-500">{toast.message}</p>
        </div>
        
        <button onClick={() => onRemove(toast.id)} className="text-beige-300 hover:text-earth-700 transition hover-rotate shrink-0">
          <X className="w-5 h-5" />
        </button>
      </div>
      
      {toast.type !== 'error' && (
        <div className="mt-3 h-1 bg-beige-200 rounded-full overflow-hidden">
          <div 
            className={`h-full ${PROGRESS_BG_COLORS[toast.type]} rounded-full`}
            style={{ animation: `progress-fill ${ (toast.duration || 4000) / 1000 }s linear` }}
          ></div>
        </div>
      )}
    </div>
  );
};

const ToastContainer: React.FC<{ toasts: ToastMessage[]; onRemove: (id: string) => void }> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed bottom-4 right-4 z-[200] space-y-3">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};


// --- Provider Component ---

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = crypto.randomUUID();
    setToasts((prevToasts) => [...prevToasts, { id, ...toast }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};
