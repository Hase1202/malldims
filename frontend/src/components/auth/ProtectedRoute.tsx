import { Navigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { canViewAlerts } from '../../utils/permissions';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredPermission?: (user: any) => boolean;
}

export default function ProtectedRoute({ children, requiredPermission }: ProtectedRouteProps) {
    const { user, isAuthenticated, loading } = useAuthContext();
    const location = useLocation();

    // Show loading spinner while checking authentication status
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#F7F8FA]">
                <div className="animate-spin rounded-full h-16 w-16 border-[3px] border-[#DADAF3] border-t-[#0504AA]"></div>
                <p className="mt-4 text-[#2C2C2C] font-medium">Loading...</p>
                <p className="text-sm mt-[1.5px] text-[#6F6F6F]">Lowtemp Inventory System</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Check if the route requires a specific permission
    if (requiredPermission && !requiredPermission(user)) {
        return <Navigate to="/" replace />;
    }

    // Only block Alerts page for Sales
    if (location.pathname.startsWith('/alerts') && !canViewAlerts(user)) {
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;
} 