import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutEndTime, setLockoutEndTime] = useState<Date | null>(null);
  const { login, isAuthenticated, loading, error } = useAuthContext();

  console.log("Render Login, isAuthenticated:", isAuthenticated);

  // Check if there's an existing lockout
  useEffect(() => {
    const storedLockoutEnd = localStorage.getItem('loginLockoutEnd');
    const storedFailedAttempts = localStorage.getItem('failedLoginAttempts');
    
    if (storedLockoutEnd) {
      const lockoutEnd = new Date(storedLockoutEnd);
      if (lockoutEnd > new Date()) {
        setIsLocked(true);
        setLockoutEndTime(lockoutEnd);
      } else {
        // Clear expired lockout
        localStorage.removeItem('loginLockoutEnd');
        localStorage.removeItem('failedLoginAttempts');
      }
    }
    
    if (storedFailedAttempts) {
      setFailedAttempts(parseInt(storedFailedAttempts));
    }
  }, []);

  // Handle lockout timer
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLocked && lockoutEndTime) {
      timer = setInterval(() => {
        if (new Date() >= lockoutEndTime) {
          setIsLocked(false);
          setLockoutEndTime(null);
          setFailedAttempts(0);
          localStorage.removeItem('loginLockoutEnd');
          localStorage.removeItem('failedLoginAttempts');
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isLocked, lockoutEndTime]);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only take the first 20 characters
    setUsername(value.slice(0, 20));
  };

  const validateForm = (): boolean => {
    let isValid = true;

    // Reset errors
    setUsernameError('');
    setPasswordError('');

    // Validate username
    if (!username.trim()) {
      setUsernameError('Employee ID is required');
      isValid = false;
    }

    // Validate password
    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    }

    return isValid;
  };

  const handleLoginFailure = () => {
    const newFailedAttempts = failedAttempts + 1;
    setFailedAttempts(newFailedAttempts);
    localStorage.setItem('failedLoginAttempts', newFailedAttempts.toString());

    if (newFailedAttempts >= 5) {
      const lockoutEnd = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes lockout
      setIsLocked(true);
      setLockoutEndTime(lockoutEnd);
      localStorage.setItem('loginLockoutEnd', lockoutEnd.toISOString());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLocked) {
      return;
    }

    if (validateForm()) {
      try {
        await login(username, password);
        // Reset failed attempts on successful login
        setFailedAttempts(0);
        localStorage.removeItem('failedLoginAttempts');
        localStorage.removeItem('loginLockoutEnd');
      } catch (error) {
        handleLoginFailure();
      }
    }
  };

  // If already authenticated, redirect to home page
  if (isAuthenticated) {
    console.log("Rendering Navigate component");
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl border-[#EBEAEA] border-[1.5px] p-8 space-y-6 shadow-sm">
        <div className="flex flex-col items-center justify-center">
          <img 
            src="https://ucarecdn.com/4833e3b0-841c-4d47-9d06-f8bca6e8e9ae/Lowtemp_Logo.svg" 
            alt="Lowtemp Logo" 
            className="h-16 mb-6"
          />
          <h2 className="text-2xl font-semibold text-[#2C2C2C]">Lowtemp Corp. Inventory</h2>
          <p className="text-[#6F6F6F] mt-1.5">Sign-in to your account</p>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-[#646464]">
                Employee ID
              </label>
              <div className="flex items-center p-2.5 border-[1.5px] border-[#EBEAEA] rounded-lg focus-within:border-[#DADAF3] transition-colors duration-200 mt-1">
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  maxLength={20}
                  className={`w-full text-sm placeholder:text-[#6F6F6F] focus:outline-none ${
                    usernameError ? 'text-red-500' : ''
                  }`}
                  value={username}
                  onChange={handleUsernameChange}
                  placeholder="Enter your employee ID"
                  disabled={isLocked}
                />
              </div>
              {usernameError && <p className="mt-1 text-sm text-red-500">{usernameError}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#646464]">
                Password
              </label>
              <div className="flex items-center p-2.5 border-[1.5px] border-[#EBEAEA] rounded-lg focus-within:border-[#DADAF3] transition-colors duration-200 mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className={`w-full text-sm placeholder:text-[#6F6F6F] focus:outline-none ${
                    passwordError ? 'text-red-500' : ''
                  }`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={isLocked}
                />
              </div>
              {passwordError && <p className="mt-1 text-sm text-red-500">{passwordError}</p>}
            </div>
          </div>

          {isLocked && (
            <div className="p-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-200">
              Too many failed attempts. Try again later.
            </div>
          )}

          {error && !isLocked && (
            <div className="p-3 text-sm text-red-700 bg-red-50 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading || isLocked}
              className="w-full py-2.5 px-4 cursor-pointer border border-transparent text-sm font-medium rounded-lg text-white bg-[#0504AA] hover:bg-opacity-90 focus:outline-none focus:ring-0 disabled:opacity-70 transition-all duration-200 ease-out active:scale-95"
            >
              {loading ? "Signing in..." : isLocked ? "Account Locked" : "Sign-in"}
            </button>
          </div>
          
          <div className="text-xs text-center text-[#6F6F6F] bg-[#FCFBFC] p-3 rounded-lg border border-[#EBEAEA]">
            <p>Need help? Contact your administrator.</p>
            <p>Remember to sign out when finished for security.</p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;