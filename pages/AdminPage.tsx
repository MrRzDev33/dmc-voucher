
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Dashboard from './admin/Dashboard';
import KasirView from './admin/KasirView';
import { Role } from '../types';
import Button from '../components/Button';
import Input from '../components/Input';
import { Loader2, LogIn } from '../components/icons/Icons';

const AdminPage: React.FC = () => {
  const { currentUser, login, logout } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const user = await login(username, password, rememberMe);
    if (!user) {
      setError('Username atau password salah.');
    }
    setLoading(false);
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-150px)] bg-gray-50">
        <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow-lg">
          <div>
            <h2 className="text-3xl font-bold text-center text-primary">Admin Login</h2>
            <p className="mt-2 text-center text-sm text-gray-600">
                Masuk ke dasboard
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
             <div className="space-y-4">
                <Input
                    label="Username"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                />
                <Input
                    label="Password"
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
             </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center">
                    <input
                        id="remember-me"
                        name="remember-me"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded cursor-pointer"
                    />
                    <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 cursor-pointer">
                        Ingat saya
                    </label>
                </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
            
            <div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <Loader2 className="animate-spin" /> : <LogIn className="mr-2" />}
                Masuk
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-2xl font-bold text-gray-800">Selamat Datang, {currentUser.username}!</h1>
            <p className="text-gray-500">Anda masuk sebagai {currentUser.role === Role.PUSAT ? 'Admin Pusat' : `Kasir (${currentUser.outlet})`}</p>
        </div>
        <Button onClick={logout} variant="secondary">Keluar</Button>
      </div>

      {currentUser.role === Role.PUSAT ? <Dashboard /> : <KasirView />}
    </div>
  );
};

export default AdminPage;
