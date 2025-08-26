import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, BellRing, LogOut, ChevronDown, User } from 'lucide-react';
import { useAuthContext } from '../../context/AuthContext';
import { canViewAlerts } from '../../utils/permissions';

interface SidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose = () => {} }: SidebarProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const currentPath = location.pathname;
    const { user, logout } = useAuthContext();
    const [showUserMenu, setShowUserMenu] = useState(false);

    const directNavigate = (path: string) => {
        try {
            onClose();
            
            if (currentPath === path) {
                window.location.href = path;
                return;
            }
            
            navigate(path, { replace: true });
        } catch (error) {
            window.location.href = path;
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
        onClose();
        setShowUserMenu(false);
    };

    const toggleUserMenu = () => {
        setShowUserMenu(!showUserMenu);
    };

    // Get user's name or username
    const displayName = user?.first_name && user?.last_name 
        ? `${user.first_name} ${user.last_name}`
        : user?.username || 'User';

    return (
        <>
            {/* Overlay */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-white bg-opacity-80 backdrop-blur-sm transition-opacity lg:hidden z-20"
                    onClick={onClose}
                />
            )}
            
            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 
                transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0
                transition-transform duration-300 ease-in-out
                w-64 min-w-[256px] border-r-[1.5px] border-[#F0F0F0] bg-[#FCFBFC] 
                p-4 z-30 flex flex-col h-screen overflow-y-auto
            `}>
                {/* Header */}
                <div className="flex items-center justify-start pl-2 pt-2 mb-8">
                    <div className="flex items-center">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-purple-500 rounded-lg flex items-center justify-center mr-3">
                            <span className="text-white font-bold text-sm">LT</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="font-bold text-gray-900 text-lg">Lowtemp</span>
                            <span className="text-xs text-gray-500">Inventory System</span>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="lg:hidden ml-auto p-1 hover:bg-gray-100 rounded-lg"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Main navigation */}
                <nav className="space-y-1 mb-auto">
                    <button
                        onClick={() => directNavigate('/')} 
                        className={`w-full flex items-center px-3 py-2 rounded-lg cursor-pointer
                            ${currentPath === '/' ? 'bg-[#E6E6FE] text-[#0504AA]' : 'hover:bg-gray-100'}`}
                    >
                        <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                            <path d="M9 9h6M9 12h6M9 15h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <span>Dashboard</span>
                    </button>

                    <button
                        onClick={() => directNavigate('/inventory')}
                        className={`w-full flex items-center px-3 py-2 rounded-lg cursor-pointer
                            ${currentPath.startsWith('/inventory') ? 'bg-[#E6E6FE] text-[#0504AA]' : 'hover:bg-gray-100'}`}
                    >
                        <svg className="w-5 h-5 mr-3" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3.30902 1C2.93025 1 2.58398 1.214 2.41459 1.55279L1.05279 4.27639C1.01807 4.34582 1 4.42238 1 4.5V13C1 13.5523 1.44772 14 2 14H13C13.5523 14 14 13.5523 14 13V4.5C14 4.42238 13.9819 4.34582 13.9472 4.27639L12.5854 1.55281C12.416 1.21403 12.0698 1.00003 11.691 1.00003L7.5 1.00001L3.30902 1ZM3.30902 2L7 2.00001V4H2.30902L3.30902 2ZM8 4V2.00002L11.691 2.00003L12.691 4H8ZM7.5 5H13V13H2V5H7.5ZM5.5 7C5.22386 7 5 7.22386 5 7.5C5 7.77614 5.22386 8 5.5 8H9.5C9.77614 8 10 7.77614 10 7.5C10 7.22386 9.77614 7 9.5 7H5.5Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"/>
                        </svg>
                        <span>Inventory</span>
                    </button>

                    <button
                        onClick={() => directNavigate('/brands')}
                        className={`w-full flex items-center px-3 py-2 rounded-lg cursor-pointer
                            ${currentPath.startsWith('/brands') ? 'bg-[#E6E6FE] text-[#0504AA]' : 'hover:bg-gray-100'}`}
                    >
                        <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                            <path d="M5 21v-2a7 7 0 0114 0v2" stroke="currentColor" strokeWidth="2" />
                        </svg>
                        <span>Brands</span>
                    </button>

                    <button
                        onClick={() => directNavigate('/customers')}
                        className={`w-full flex items-center px-3 py-2 rounded-lg cursor-pointer
                            ${currentPath.startsWith('/customers') ? 'bg-[#E6E6FE] text-[#0504AA]' : 'hover:bg-gray-100'}`}
                    >
                        <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" />
                            <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2" />
                            <path d="m22 11-3-3m0 0-3 3m3-3v6" stroke="currentColor" strokeWidth="2" />
                        </svg>
                        <span>Customers</span>
                    </button>

                    <button
                        onClick={() => directNavigate('/transactions')}
                        className={`w-full flex items-center px-3 py-2 rounded-lg cursor-pointer
                            ${currentPath.startsWith('/transactions') ? 'bg-[#E6E6FE] text-[#0504AA]' : 'hover:bg-gray-100'}`}
                    >
                        <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M3 5h6M3 12h12M3 19h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <span>Transactions</span>
                    </button>
                </nav>

                {/* Bottom section */}
                <div className="space-y-1 mt-auto">
                    {canViewAlerts(user) && (
                        <button
                            onClick={() => directNavigate('/alerts')}
                            className={`w-full flex items-center px-3 py-2 rounded-lg cursor-pointer
                                ${currentPath.startsWith('/alerts') ? 'bg-[#E6E6FE] text-[#0504AA]' : 'hover:bg-gray-100'}`}
                        >
                            <BellRing className="w-5 h-5 mr-3" />
                            <span>Alerts</span>
                        </button>
                    )}
                    
                    {/* User profile dropdown */}
                    <div className="relative mt-4">
                        <button
                            onClick={toggleUserMenu}
                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-100 cursor-pointer"
                        >
                            <div className="flex items-center">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white mr-2.5">
                                    <span className="text-xs font-medium">
                                        {displayName.split(' ').map(n => n[0]).join('').toUpperCase()}
                                    </span>
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className="font-medium truncate max-w-[120px] text-sm">{displayName}</span>
                                    <span className="text-xs text-gray-500">{user?.role}</span>
                                </div>
                            </div>
                            <ChevronDown className={`w-4 h-4 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {/* Dropdown menu */}
                        {showUserMenu && (
                            <div className="absolute bottom-full left-0 mb-1 w-full bg-white rounded-lg shadow-md border border-gray-100 z-10 overflow-hidden">
                                <button
                                    onClick={() => {
                                        directNavigate('/settings');
                                        setShowUserMenu(false);
                                    }}
                                    className="w-full cursor-pointer flex items-center px-4 py-2.5 hover:bg-gray-50 text-left"
                                >
                                    <User className="w-4 h-4 mr-3" />
                                    <span>Settings</span>
                                </button>
                                <div className="border-t border-gray-100"></div>
                                <button
                                    onClick={handleLogout}
                                    className="w-full cursor-pointer flex items-center px-4 py-2.5 hover:bg-gray-50 text-left text-red-600"
                                >
                                    <LogOut className="w-4 h-4 mr-3" />
                                    <span>Logout</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </aside>
        </>
    );
}