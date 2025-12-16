
import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Lock, Mail, ArrowRight, ShieldCheck, AlertTriangle } from 'lucide-react';
import Button from './ui/Button';
import Input from './ui/Input';
import Card from './ui/Card';

interface AuthOverlayProps {
    onLoginSuccess: () => void;
}

const AuthOverlay: React.FC<AuthOverlayProps> = ({ onLoginSuccess }) => {
    const [step, setStep] = useState<'email' | 'otp'>('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Étape 1 : Demander le code OTP
    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Validation basique
        if (!email.includes('@') || !email.includes('.')) {
            setError("Veuillez entrer une adresse email valide.");
            setLoading(false);
            return;
        }

        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    shouldCreateUser: false, 
                }
            });

            if (error) {
                if (error.message && error.message.includes('Signups not allowed')) {
                    throw new Error("Cet email n'est pas autorisé. Contactez l'administrateur.");
                }
                throw error;
            }

            setStep('otp');
        } catch (err: any) {
            console.error("Login Error:", err);
            let msg = "Erreur lors de l'envoi du code.";
            
            if (typeof err === 'string') msg = err;
            else if (err?.message) msg = err.message;
            else if (err?.error_description) msg = err.error_description;

            if (msg.includes("security purposes") || msg.includes("after") || msg.includes("rate limit")) {
                msg = "Veuillez patienter 60 secondes avant de demander un nouveau code.";
            }
            
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    // Étape 2 : Vérifier le code
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            let { error, data } = await supabase.auth.verifyOtp({
                email,
                token: otp,
                type: 'email',
            });

            if (error) {
                console.log("Essai verifyOtp type='email' échoué, tentative type='signup'...");
                const retry = await supabase.auth.verifyOtp({
                    email,
                    token: otp,
                    type: 'signup',
                });
                
                if (retry.error) throw error;
                else { error = null; data = retry.data; }
            }

            if (error) throw error;
            onLoginSuccess();
            
        } catch (err: any) {
            console.error("OTP Error:", err);
            let msg = "Code invalide ou expiré.";
            if (err?.message) msg = err.message;
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-earth-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md animate-scale-in">
                <Card glass className="p-0 overflow-hidden shadow-2xl">
                    {/* Header */}
                    <div className="bg-beige-50/50 border-b border-beige-200 p-6 flex flex-col items-center text-center">
                        <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-xl flex items-center justify-center mb-3 shadow-inner">
                            {step === 'email' ? <Lock className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                        </div>
                        <h2 className="text-xl font-bold text-earth-900 gradient-text">
                            {step === 'email' ? 'Espace de Connexion' : 'Vérification OTP'}
                        </h2>
                        <p className="text-sm text-earth-500 mt-1">
                            {step === 'email' 
                                ? 'Identification par courriel requise' 
                                : `Entrez le code envoyé à ${email}`}
                        </p>
                    </div>

                    {/* Body */}
                    <div className="p-6 bg-white">
                        {error && (
                            <div className="mb-4 p-3 bg-rose-50 border border-rose-100 text-rose-600 text-xs rounded-lg flex items-start gap-2 animate-pulse">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        {step === 'email' ? (
                            <form onSubmit={handleSendOtp} className="space-y-4">
                                <Input 
                                    label="EMAIL PROFESSIONNEL"
                                    type="email" 
                                    required
                                    autoFocus
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="nom@entreprise.com"
                                    leftIcon={<Mail className="w-4 h-4" />}
                                    className="bg-beige-50/50"
                                />
                                <Button 
                                    type="submit" 
                                    isLoading={loading}
                                    fullWidth
                                    variant="primary"
                                    className="bg-earth-900 hover:bg-earth-700 text-beige-100"
                                    rightIcon={<ArrowRight className="w-4 h-4" />}
                                >
                                    Recevoir le code
                                </Button>
                            </form>
                        ) : (
                            <form onSubmit={handleVerifyOtp} className="space-y-4">
                                <Input
                                    label="CODE DE VÉRIFICATION"
                                    type="text" 
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    pattern="[0-9]*"
                                    required
                                    autoFocus
                                    maxLength={8}
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                    className="text-center text-2xl font-mono tracking-[0.2em] bg-beige-50/50"
                                    placeholder="000000"
                                />
                                <p className="text-[10px] text-center text-earth-500">Vérifiez vos spams si vous ne recevez rien.</p>
                                
                                <Button 
                                    type="submit" 
                                    isLoading={loading}
                                    disabled={otp.length < 6}
                                    fullWidth
                                    variant="primary"
                                    className="bg-earth-900 hover:bg-earth-700 text-beige-100"
                                >
                                    Confirmer le code
                                </Button>
                                
                                <button 
                                    type="button" 
                                    onClick={() => { setStep('email'); setError(null); setOtp(''); }}
                                    className="w-full text-xs text-earth-500 hover:text-gold-600 mt-2 py-1 text-center"
                                >
                                    Modifier l'email
                                </button>
                            </form>
                        )}
                    </div>
                    
                    {/* Footer */}
                    <div className="bg-beige-50/50 p-4 border-t border-beige-200 text-center">
                        <p className="text-[10px] text-earth-500">
                            Accès sécurisé et restreint.
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default AuthOverlay;
