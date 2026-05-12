import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Lock, AlertCircle, Loader2 } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  isAuthorized: boolean;
  onLogin: (password: string) => Promise<boolean>;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, isAuthorized, onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logo, setLogo] = useState<string>('');

  useEffect(() => {
    const savedLogo = localStorage.getItem('cn_brand_logo');
    if (savedLogo) setLogo(savedLogo);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    
    setLoading(true);
    setError(false);
    
    try {
      const success = await onLogin(password);
      if (!success) {
        setError(true);
        setPassword('');
      }
    } catch (err) {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (isAuthorized) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-[#0a0c14] p-6 font-sans">
      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-10 w-full max-w-md border border-white/10 shadow-2xl text-center bg-[#111420]/80 backdrop-blur-2xl"
        >
          <div className="flex flex-col items-center gap-8">
            {/* Logo Wrapper */}
            <div className="relative">
              <div className="w-24 h-24 rounded-3xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-2xl shadow-primary/10">
                {logo ? (
                  <img src={logo} alt="Logo" className="h-16 w-16 object-contain" />
                ) : (
                  <Lock className="text-primary w-10 h-10" />
                )}
              </div>
              <motion.div 
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 3 }}
                className="absolute -bottom-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center border-4 border-[#0a0c14]"
              >
                <Lock size={12} className="text-background" />
              </motion.div>
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl font-black tracking-tighter text-white font-headline">Portal CN</h1>
              <div className="flex items-center justify-center gap-2">
                <span className="h-px w-8 bg-white/10"></span>
                <p className="text-[10px] text-primary font-black uppercase tracking-[0.3em]">Acesso Restrito</p>
                <span className="h-px w-8 bg-white/10"></span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="w-full space-y-5">
              <div className="space-y-2">
                <input
                  type="password"
                  placeholder="Senha de Acesso"
                  className={cn(
                    "w-full bg-white/5 border rounded-2xl px-4 py-5 text-center text-xl font-bold text-white outline-none transition-all placeholder:text-white/20",
                    error 
                      ? "border-tertiary shadow-[0_0_25px_rgba(239,68,68,0.15)] ring-1 ring-tertiary/50" 
                      : "border-white/10 focus:border-primary/50 focus:bg-white/10"
                  )}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(false);
                  }}
                  autoFocus
                  disabled={loading}
                />
                {error && (
                  <motion.p 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-tertiary text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    <AlertCircle size={12} /> Senha Inválida. Tente Novamente.
                  </motion.p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-background py-5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-primary-dark transition-all shadow-xl shadow-primary/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'Autenticando...' : 'Autenticar Sistema'}
              </button>
            </form>

            <div className="pt-4 space-y-1">
              <p className="text-[9px] text-white/20 font-medium uppercase tracking-widest">
                CN Intelligence Security Protocol v2.6
              </p>
              <p className="text-[9px] text-white/10">
                © 2025 Todos os direitos reservados.
              </p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};