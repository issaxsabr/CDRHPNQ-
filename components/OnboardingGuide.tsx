
import React, { useState, useLayoutEffect } from 'react';
import { X, ArrowLeft, ArrowRight, Zap, PartyPopper } from 'lucide-react';
import Button from './ui/Button';

interface OnboardingStep {
  targetId: string;
  title: string;
  content: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const STEPS: OnboardingStep[] = [
  {
    targetId: 'welcome-step',
    title: 'Bienvenue sur Scavenger !',
    content: "Suivez ce guide rapide pour découvrir comment vérifier et enrichir vos listes d'entreprises.",
  },
  {
    targetId: 'mode-selector',
    title: '1. Choisissez un Mode',
    content: "Utilisez 'Simple' pour une recherche unique ou 'Vérifier' pour analyser une liste complète (batch).",
    position: 'bottom',
  },
  {
    targetId: 'project-selector',
    title: '2. Sélectionnez un Dossier',
    content: "Toutes vos données sont sauvegardées dans un dossier. C'est essentiel pour organiser et retrouver votre travail.",
    position: 'bottom',
  },
  {
    targetId: 'search-form',
    title: '3. Configurez votre Recherche',
    content: "Entrez les entreprises à rechercher, choisissez une stratégie (plus elle est chère, plus elle est complète), puis lancez la vérification.",
    position: 'top',
  },
  {
    targetId: 'header-controls',
    title: '4. Gérez vos Données',
    content: 'Utilisez ces boutons pour voir tous vos dossiers, consulter le cache des recherches récentes ou vous déconnecter.',
    position: 'bottom',
  },
  {
    targetId: 'final-step',
    title: 'Vous êtes prêt !',
    content: 'Les résultats apparaîtront dans un tableau détaillé. Bonne prospection !',
  }
];


interface TooltipPosition {
  top?: string | number;
  left?: string | number;
  bottom?: string | number;
  right?: string | number;
  transform?: string;
}

const OnboardingGuide: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [position, setPosition] = useState<TooltipPosition>({});
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);

  const step = STEPS[currentStep];

  useLayoutEffect(() => {
    if (!isOpen) return;

    if (highlightedElement) {
      highlightedElement.classList.remove('onboarding-highlight');
    }

    const isModalStep = step.targetId === 'welcome-step' || step.targetId === 'final-step';

    if (isModalStep) {
      setPosition({ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' });
      setHighlightedElement(null);
      return;
    }
    
    const target = document.getElementById(step.targetId);
    setHighlightedElement(target);

    if (target) {
      target.classList.add('onboarding-highlight');
      const rect = target.getBoundingClientRect();
      const tooltipPos: TooltipPosition = {};
      const tooltipWidth = 320; // w-80 from tailwind
      const margin = 16;
      const viewportWidth = document.documentElement.clientWidth;
      
      const setHorizontalPosition = (pos: TooltipPosition) => {
          let idealLeft = rect.left + (rect.width / 2) - (tooltipWidth / 2);

          // Clamp the position within viewport bounds to prevent overflow
          if (idealLeft < margin) {
              idealLeft = margin;
          }
          if (idealLeft + tooltipWidth > viewportWidth - margin) {
              idealLeft = viewportWidth - tooltipWidth - margin;
          }

          pos.left = `${idealLeft}px`;
          pos.transform = 'none'; // No transform needed as we calculated the final left value
      }

      switch (step.position) {
        case 'top':
          tooltipPos.bottom = `${window.innerHeight - rect.top + margin}px`;
          setHorizontalPosition(tooltipPos);
          break;
        case 'left':
          tooltipPos.top = `${rect.top + rect.height / 2}px`;
          tooltipPos.right = `${viewportWidth - rect.left + margin}px`;
          tooltipPos.transform = 'translateY(-50%)';
          break;
        case 'right':
          tooltipPos.top = `${rect.top + rect.height / 2}px`;
          tooltipPos.left = `${rect.right + margin}px`;
          tooltipPos.transform = 'translateY(-50%)';
          break;
        default: // bottom
          tooltipPos.top = `${rect.bottom + margin}px`;
          setHorizontalPosition(tooltipPos);
          break;
      }
      setPosition(tooltipPos);
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    return () => {
      if (target) target.classList.remove('onboarding-highlight');
    };
  }, [currentStep, isOpen, step, highlightedElement]);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleClose = () => {
    if (highlightedElement) {
      highlightedElement.classList.remove('onboarding-highlight');
    }
    setCurrentStep(0);
    onClose();
  };

  if (!isOpen) return null;

  const isModalStep = step.targetId === 'welcome-step' || step.targetId === 'final-step';
  const isLastStep = currentStep === STEPS.length - 1;

  return (
    <>
      <div className="fixed inset-0 bg-earth-900/60 z-[1000]" onClick={isModalStep ? undefined : handleClose} />
      
      <div 
        className="fixed z-[1100] w-[90vw] max-w-xs sm:w-80 bg-white rounded-xl shadow-2xl p-5 transition-all duration-300 animate-fade-in-up" 
        style={position}
      >
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isLastStep ? 'bg-emerald-100 text-emerald-600' : 'bg-yellow-100 text-yellow-600'}`}>
              {isLastStep ? <PartyPopper className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
            </div>
            <h3 className="font-bold text-earth-900">{step.title}</h3>
          </div>
          <Button onClick={handleClose} variant="ghost" size="icon" rounded="full" className="w-6 h-6 hover:bg-beige-100 text-earth-500"><X className="w-4 h-4" /></Button>
        </div>
        <p className="text-sm text-earth-500 mb-5">{step.content}</p>

        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-earth-500/70">{currentStep + 1} / {STEPS.length}</span>
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button onClick={handlePrev} variant="secondary" size="icon" className="text-earth-500">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            )}
            <Button 
                onClick={handleNext} 
                variant="primary" 
                size="sm" 
                className="bg-earth-900 text-beige-100 hover:bg-earth-700"
                rightIcon={!isLastStep && <ArrowRight className="w-4 h-4" />}
            >
              {isLastStep ? 'Terminer' : 'Suivant'}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export default OnboardingGuide;
