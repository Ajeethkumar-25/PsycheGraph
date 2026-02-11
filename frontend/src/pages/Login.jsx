import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { motion } from 'framer-motion';
import { LogIn, Activity } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { login, loading } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await login(email, password);
            navigate('/');
        } catch (err) {
            // toast handled in context
        }
    };

    return (
        <div className="flex flex-col items-center justify-center pt-12">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md"
            >
                <div className="text-center mb-10">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary-500 to-accent-600 rounded-3xl text-white shadow-2xl mb-6 transform rotate-3 animate-float">
                        <Activity size={40} />
                    </div>
                    <h1 className="text-3xl font-display font-bold text-white mb-2">Welcome Back</h1>
                    <p className="text-slate-400">Sign in to your PsycheGraph account</p>
                </div>

                <div className="glass-card">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <Input
                            label="Email Address"
                            placeholder="doctor@psychegraph.com"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <Input
                            label="Password"
                            placeholder="••••••••"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />

                        <div className="flex items-center justify-between text-sm">
                            <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                                <input type="checkbox" className="w-4 h-4 rounded border-white/10 bg-dark-700 text-primary-500 focus:ring-primary-500/20" />
                                Remember me
                            </label>
                            <a href="#" className="text-primary-400 hover:text-primary-300 transition-colors">Forgot password?</a>
                        </div>

                        <Button type="submit" className="w-full h-12" disabled={loading}>
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <LogIn size={20} />
                                    Sign In
                                </>
                            )}
                        </Button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-white/5 text-center">
                        <p className="text-sm text-slate-500">
                            Don't have an account?{' '}
                            <a href="#" className="text-white hover:text-primary-400 font-medium transition-colors">
                                Contact your administrator
                            </a>
                        </p>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default Login;
