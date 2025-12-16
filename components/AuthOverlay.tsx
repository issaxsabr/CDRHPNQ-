
import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Lock, Mail, ArrowRight, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';

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
                    // Important : Si vous avez désactivé les inscriptions publiques (Allow new user signups = OFF)
                    // mais ajouté des utilisateurs manuellement, 'shouldCreateUser: false' est correct.
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

    // Étape 2 : Vérifier le code (Support Login ET Premier Signup)
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Tentative 1 : Vérification standard (Login)
            let { error, data } = await supabase.auth.verifyOtp({
                email,
                token: otp,
                type: 'email',
            });

            // Tentative 2 : Si échec, essai en tant que "Signup" (cas fréquent pour la 1ère connexion d'un user créé manuellement)
            if (error) {
                console.log("Essai verifyOtp type='email' échoué, tentative type='signup'...");
                const retry = await supabase.auth.verifyOtp({
                    email,
                    token: otp,
                    type: 'signup',
                });
                
                if (retry.error) {
                    // Si les deux échouent, on lance l'erreur initiale
                    throw error;
                } else {
                    // Succès au 2ème essai
                    error = null;
                    data = retry.data;
                }
            }

            if (error) throw error;

            // La session est gérée automatiquement par onAuthStateChange dans App.tsx, 
            // mais on appelle onLoginSuccess pour fermer l'overlay immédiatement si besoin.
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
        <div className="fixed inset-0 z-[100] bg-[#403E37]/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in glass">
                {/* Header */}
                <div className="bg-slate-50/50 border-b border-slate-100 p-6 flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-xl flex items-center justify-center mb-3 shadow-inner">
                        {step === 'email' ? <Lock className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
                    </div>
                    <h2 className="text-xl font-bold text-slate-800 gradient-text">
                        {step === 'email' ? 'Espace de Connexion' : 'Vérification OTP'}
                    </h2>
                    <p className="text-sm text-[#8B865F] mt-1">
                        {step === 'email' 
                            ? 'Identification par courriel requise' 
                            : `Entrez le code envoyé à ${email}`}
                    </p>
                </div>

                {/* Body */}
                <div className="p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-rose-50 border border-rose-100 text-rose-600 text-xs rounded-lg flex items-start gap-2 animate-pulse">
                            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    {step === 'email' ? (
                        <form onSubmit={handleSendOtp} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-[#403E37] uppercase tracking-wider">Email professionnel</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                                        <Mail className="w-4 h-4" />
                                    </div>
                                    <input 
                                        type="email" 
                                        required
                                        autoFocus
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50/50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-100 focus:border-yellow-500 transition-all text-[#403E37] text-sm font-medium placeholder-slate-400"
                                        placeholder="nom@entreprise.com"
                                    />
                                </div>
                            </div>
                            <button 
                                type="submit" 
                                disabled={loading}
                                className="w-full bg-black text-white font-semibold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed btn-modern"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Recevoir le code <ArrowRight className="w-4 h-4" /></>}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyOtp} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-[#403E37] uppercase tracking-wider">Code reçu par email</label>
                                <input 
                                    type="text" 
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    pattern="[0-9]*"
                                    required
                                    autoFocus
                                    maxLength={8}
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                    className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-yellow-100 focus:border-yellow-500 transition-all text-[#403E37] text-center text-2xl font-mono tracking-[0.2em] placeholder-slate-300"
                                    placeholder="000000"
                                />
                                <p className="text-[10px] text-center text-slate-400">Vérifiez vos spams si vous ne recevez rien.</p>
                            </div>
                            <button 
                                type="submit" 
                                disabled={loading || otp.length < 6}
                                className="w-full bg-black text-white font-semibold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed btn-modern"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmer le code'}
                            </button>
                            <button 
                                type="button" 
                                onClick={() => { setStep('email'); setError(null); setOtp(''); }}
                                className="w-full text-xs text-slate-500 hover:text-yellow-600 mt-2 py-1"
                            >
                                Modifier l'email
                            </button>
                        </form>
                    )}
                </div>
                
                {/* Footer */}
                <div className="bg-slate-50/50 p-4 border-t border-slate-100 text-center">
                    <p className="text-[10px] text-slate-400">
                        Accès sécurisé et restreint.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AuthOverlay;