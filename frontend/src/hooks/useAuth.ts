import { useState, useEffect, useCallback } from 'react';
import { authApi, User as ApiUser, ApiResponse } from '../lib/api';

// Extend the API User type with our application-specific fields
interface User extends ApiUser {
  name?: string; // Additional client-side property
}


interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  error: string | null;
  updateUserProfile: (data: any) => Promise<ApiResponse<User>>;
}

export const useAuth = (): UseAuthReturn => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const setSession = (tokens: { access: string; refresh: string } | null) => {
    if (tokens) {
      localStorage.setItem('accessToken', tokens.access);
      localStorage.setItem('refreshToken', tokens.refresh);
      localStorage.setItem('lastTokenCheck', Date.now().toString());
      console.log('Tokens stored successfully');
    } else {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('lastTokenCheck');
      console.log('Tokens removed');
    }
  };

  // Check if we need to validate token (industry standard: every 5-15 minutes)
  const shouldCheckToken = () => {
    const lastCheck = localStorage.getItem('lastTokenCheck');
    if (!lastCheck) return true;
    
    const timeSinceLastCheck = Date.now() - parseInt(lastCheck);
    const checkInterval = 10 * 60 * 1000; // 10 minutes
    
    return timeSinceLastCheck > checkInterval;
  };

  // Add this debug function to check token status
  const checkTokenStatus = () => {
    const token = localStorage.getItem('accessToken');
    console.log('Current access token:', token ? 'Present' : 'Missing');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const exp = payload.exp * 1000;
        const now = Date.now();
        console.log('Token expires at:', new Date(exp));
        console.log('Token is', exp > now ? 'valid' : 'expired');
        
        // If token expires in less than 5 minutes, it's considered expired for our purposes
        return exp > (now + 5 * 60 * 1000);
      } catch (e) {
        console.log('Error parsing token:', e);
        return false;
      }
    }
    return false;
  };

  const getUserInfo = useCallback(async () => {
    // Set loading ONLY if this is an explicit authentication attempt
    // NOT during the automatic check on page load
    const isExplicitAuthAttempt = !!localStorage.getItem('isLoggingIn');
    
    if (isExplicitAuthAttempt) {
      setLoading(true);
    }
    
    try {
      const accessToken = localStorage.getItem('accessToken');
      if (!accessToken) {
        if (isExplicitAuthAttempt) {
          setLoading(false);
        }
        return;
      }

      // Only check with server if enough time has passed (industry standard approach)
      if (!shouldCheckToken() && !isExplicitAuthAttempt) {
        // Token is still valid based on local check, use cached user data
        if (!user && accessToken) {
          // Try to reconstruct user from token if we don't have user data
          try {
            const payload = JSON.parse(atob(accessToken.split('.')[1]));
            setUser({
              account_id: payload.user_id || payload.account_id,
              username: payload.username,
              role: payload.role || 'User',
              first_name: payload.first_name || '',
              last_name: payload.last_name || '',
              cost_tier: payload.cost_tier?.toString() || '0',
              is_active: payload.is_active !== undefined ? payload.is_active : true,
              date_joined: payload.date_joined || '',
            });
          } catch (e) {
            console.error('Error parsing cached token:', e);
          }
        }
        if (isExplicitAuthAttempt) {
          setLoading(false);
        }
        return;
      }

      // Check if token is still valid before making API call
      if (!checkTokenStatus()) {
        console.log('Token is expired, removing session');
        setSession(null);
        setUser(null);
        if (isExplicitAuthAttempt) {
          setLoading(false);
        }
        return;
      }

      // Try to get user info from API
      const response = await fetch('http://127.0.0.1:8000/api/user/', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        // Update last check time
        localStorage.setItem('lastTokenCheck', Date.now().toString());
      } else if (response.status === 401) {
        // Token is invalid, clear session
        console.log('Token validation failed, clearing session');
        setSession(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Error getting user info:', error);
    } finally {
      // Always reset loading regardless of outcome
      setLoading(false);
      // Clear login flag
      localStorage.removeItem('isLoggingIn');
    }
  }, []); // Remove the 'user' dependency to prevent infinite loop

  // Use a separate effect that only runs once on mount
  useEffect(() => {
    checkTokenStatus();
    getUserInfo();
  }, []); // Only run once on mount

  const login = async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    
    // Set flag that we're in an explicit login process
    localStorage.setItem('isLoggingIn', 'true');
    
    try {
      console.log('Sending login request with:', { username, password });
      
      const response = await fetch('http://127.0.0.1:8000/api/token/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Store tokens in localStorage
        setSession({
          access: data.access,
          refresh: data.refresh,
        });
        
        // Parse the JWT token manually
        try {
          const base64Url = data.access.split('.')[1];
          const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
          const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
          }).join(''));

          const decoded = JSON.parse(jsonPayload);
          
          // Set user directly from token data
          setUser({
            account_id: decoded.user_id || decoded.account_id,
            username: decoded.username,
            role: decoded.role || 'User',
            first_name: decoded.first_name || '',
            last_name: decoded.last_name || '',
            // Convert cost_tier to a string if needed
            cost_tier: decoded.cost_tier?.toString() || '0',
            is_active: decoded.is_active !== undefined ? decoded.is_active : true,
            date_joined: decoded.date_joined || '',
          });
        } catch (tokenErr) {
          console.error('Error decoding token:', tokenErr);
        }
      } else {
        setError(data.detail || 'Login failed. Please check your credentials.');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setSession(null);
    setUser(null);
  };

  const updateUserProfile = async (data: any): Promise<ApiResponse<User>> => {
    const response = await authApi.updateUserInfo(data);

    // If response is a fetch Response, parse it to ApiResponse<User>
    let apiResponse: ApiResponse<User>;
    if (response instanceof Response) {
      const json = await response.json();
      apiResponse = {
        data: json,
        status: response.status,
        message: response.ok ? 'Success' : 'Error'
      };
    } else {
      apiResponse = response;
    }

    if (apiResponse.status === 200 && apiResponse.data) {
      setUser({ ...user, ...apiResponse.data });
      // If password was changed, auto-logout
      if (data.new_password) {
        setTimeout(() => {
          logout();
        }, 1500); // Give user time to see the toast
      }
    }
    return apiResponse;
  };

  return {
    user,
    isAuthenticated: !!user,
    login,
    logout,
    loading,
    error,
    updateUserProfile
  };
};