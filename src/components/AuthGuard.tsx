import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Lock, Mail, AlertCircle } from 'lucide-react';
import { apiAuth } from '../api';
import { useAppData } from '../hooks/useAppData';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [logo, setLogo] = useState<string>('');
  const { setIsAuthorized } = useAppData();

  useEffect(() => {
    const savedLogo = localStorage.getItem('cn_brand_logo');
    if (savedLogo) setLogo(savedLogo);
  }, []);

  // Verificar se já está autenticado
  useEffect(() => {
    if (apiAuth.isAuthenticated()) {
      setIsAuthorized(true);
    }
  }, [setIsAuthorized]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await apiAuth.login(email, password);
      setIsAuthorized(true);
      setPassword('');
      setEmail('');
    } catch (err: any) {
      setError(err.message || 'Email ou senha inválidos');
      setPassword('');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    apiAuth.logout();
    setIsAuthorized(false);
  };

  if (apiAuth.isAuthenticated()) {
    return (
      <div className="relative">
        {/* Botão de logout discreto */}
        <button
          onClick={handleLogout}
          className="fixed top-4 right-4 z-[600] bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-[10px] font-bold text-white/60 uppercase tracking-widest hover:text-white transition-all backdrop-blur-sm"
          title="Sair"
        >
          Sair
        </button>
        {children}
      </div>
    );
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
            {/* Logo */}
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
              {/* Email */}
              <div className="space-y-2">
                <div className="relative">
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="email"
                    placeholder="Email de acesso"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError('');
                    }}
                    className="w-full bg-white/5 border rounded-2xl pl-12 pr-4 py-5 text-center text-xl font-bold text-white outline-none transition-all placeholder:text-white/20"
                    required
                  />
                </div>
              </div>

              {/* Senha */}
              <div className="space-y-2">
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    type="password"
                    placeholder="Senha de Acesso"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError('');
                    }}
                    className="w-full bg-white/5 border rounded-2xl pl-12 pr-4 py-5 text-center text-xl font-bold text-white outline-none transition-all placeholder:text-white/20"
                    required
                  />
                </div>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-tertiary text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-1"
                  >
                    <AlertCircle size={12} /> {error}
                  </motion.p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-background py-5 rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-primary-dark transition-all shadow-xl shadow-primary/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full"
                    />
                    Autenticando...
                  </>
                ) : (
                  'Autenticar Sistema'
                )}
              </button>
            </form>

            <div className="pt-4 space-y-1">
              <p className="text-[9px] text-white/20 font-medium uppercase tracking-widest">
                CN Intelligence Security Protocol v3.0
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