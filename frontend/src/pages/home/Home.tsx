import { useState, useEffect } from 'react';
import { Menu, ArrowUpRight, Package2, ArrowBigDownDash, TriangleAlert, Users, History } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import Sidebar from "../../components/common/Sidebar";
import Toast from "../../components/common/Toast";
import { itemsApi, brandsApi, transactionsApi, authApi, User, usersApi } from "../../lib/api";
import { Item, InventoryStats } from "../../types/inventory";
import { isSales, isWarehouseStaff, isInventoryManager } from '../../utils/permissions';
import DashboardCharts from "../../components/features/Dashboard/DashboardCharts";
import TransactionDetailsModal from "../../components/features/Transactions/TransactionDetailsModal";

interface RecentTransaction {
    transaction_id: number;
    transaction_type: string;
    transacted_date: string;
    reference_number: string;
    transaction_status: 'Pending' | 'Completed' | 'Cancelled';
    created_by?: string;
    notes?: string;
}

interface InventoryItem extends Item {
    current_stock: number;
    minimum_stock: number;
}

interface UserInfo extends User {
    // No additional fields needed as User already has all required fields
}

// Generic paginated response interface
interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

export default function HomePage() {
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [inventoryStats, setInventoryStats] = useState<InventoryStats>({
        total_items: 0,
        low_stock: 0,
        out_of_stock: 0
    });
    const [totalBrands, setTotalBrands] = useState<number>(0);
    const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);
    const [recentItems, setRecentItems] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastState, setToastState] = useState<'loading' | 'success' | 'error'>('loading');
    const [user, setUser] = useState<UserInfo | null>(null);
    const [userList, setUserList] = useState<User[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTransactionId, setSelectedTransactionId] = useState<number | null>(null);
    const [chartTransactions, setChartTransactions] = useState<RecentTransaction[]>([]);

    useEffect(() => {
        const fetchUserInfo = async () => {
            try {
                const response = await authApi.getUserInfo();
                if (response.status === 'success' && response.data) {
                    setUser(response.data);
                }
            } catch (err) {
                console.error('Error fetching user info:', err);
            }
        };
        fetchUserInfo();
        // Fetch user list
        const fetchUserList = async () => {
            try {
                const response = await usersApi.getAll();
                if (response.status === 'success' && response.data) {
                    setUserList(response.data);
                }
            } catch (err) {
                console.error('Error fetching user list:', err);
            }
        };
        fetchUserList();
    }, []);

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            setError(null);
            
            try {
                // Fetch inventory stats
                const statsResponse = await itemsApi.getStats();
                if (statsResponse.status === 'success' && statsResponse.data) {
                    setInventoryStats(statsResponse.data);
                }

                // Fetch transactions for the last 7 days for the chart
                let chartTransactions: RecentTransaction[] = [];
                try {
                    const today = new Date();
                    const start = new Date(today);
                    start.setDate(today.getDate() - 6);
                    const startDate = start.toISOString().split('T')[0];
                    const endDate = today.toISOString().split('T')[0];
                    const params: Record<string, string> = {
                        ordering: '-transacted_date',
                        start_date: startDate,
                        end_date: endDate,
                        all: 'true'
                    };
                    const transactionsResponse = await transactionsApi.getAll(params);
                    if (transactionsResponse.status === 'success' && transactionsResponse.data) {
                        if (Array.isArray(transactionsResponse.data)) {
                            chartTransactions = transactionsResponse.data;
                        } else if (
                            typeof transactionsResponse.data === 'object' &&
                            transactionsResponse.data !== null &&
                            'results' in transactionsResponse.data &&
                            Array.isArray((transactionsResponse.data as any).results)
                        ) {
                            chartTransactions = (transactionsResponse.data as { results: RecentTransaction[] }).results;
                        }
                    }
                    // Debug log: print number of transactions and their dates
                    console.log('Chart transactions fetched:', chartTransactions.length, chartTransactions.map(t => t.transacted_date));
                } catch (err) {
                    console.error('Error fetching transactions for chart:', err);
                }

                // Fetch the 10 most recent transactions for the list
                let transactionItems: RecentTransaction[] = [];
                try {
                    const params: Record<string, string> = {
                        ordering: '-transaction_id',
                        limit: '10'
                    };
                    const transactionsResponse = await transactionsApi.getAll(params);
                    if (transactionsResponse.status === 'success' && transactionsResponse.data) {
                        if (Array.isArray(transactionsResponse.data)) {
                            transactionItems = transactionsResponse.data;
                        } else if (
                            typeof transactionsResponse.data === 'object' &&
                            transactionsResponse.data !== null &&
                            'results' in transactionsResponse.data &&
                            Array.isArray((transactionsResponse.data as any).results)
                        ) {
                            transactionItems = (transactionsResponse.data as { results: RecentTransaction[] }).results;
                        }
                    }
                } catch (err) {
                    console.error('Error fetching recent transactions:', err);
                }

                // Filter for sales: only show their pending reserved goods and completed dispatched goods from their own reserves
                if (isSales(user)) {
                    const username = user?.username;
                    // Pending reserved goods
                    const pendingReserves = transactionItems.filter(t => t.transaction_type === 'Reserve goods' && t.transaction_status === 'Pending' && t.created_by === username);
                    // Completed dispatched goods that originated from their own reserves
                    const completedDispatches = transactionItems.filter(t => t.transaction_type === 'Dispatch goods' && t.transaction_status === 'Completed' && t.notes && t.notes.includes(`Reserved by: ${username}`));
                    setRecentTransactions([...pendingReserves, ...completedDispatches]);
                } else {
                    setRecentTransactions(transactionItems);
                }

                // Pass chartTransactions to DashboardCharts
                setChartTransactions(chartTransactions);

                // Fetch recent items (last 5)
                try {
                    const itemsResponse = await itemsApi.getAll({ 
                        limit: '5', 
                        ordering: '-updated_at'
                    });
                    
                    if (itemsResponse.status === 'success' && itemsResponse.data) {
                        let itemsWithStock: InventoryItem[] = [];
                        
                        // Check if data is an array (direct result)
                        if (Array.isArray(itemsResponse.data)) {
                            itemsWithStock = itemsResponse.data.map(item => ({
                                ...item,
                                current_stock: item.quantity,
                                minimum_stock: item.threshold_value
                            }));
                        } 
                        // Check if data is paginated
                        else if (typeof itemsResponse.data === 'object' && 
                                 itemsResponse.data !== null && 
                                 'results' in itemsResponse.data && 
                                 Array.isArray((itemsResponse.data as any).results)) {
                            
                            const paginatedData = itemsResponse.data as PaginatedResponse<Item>;
                            itemsWithStock = paginatedData.results.map(item => ({
                                ...item,
                                current_stock: item.quantity,
                                minimum_stock: item.threshold_value
                            }));
                        }
                        
                        setRecentItems(itemsWithStock);
                    }
                } catch (err) {
                    console.error('Error fetching recent items:', err);
                }

                // Fetch brand count - using 'all=true' parameter to get full list
                try {
                    const brandsResponse = await brandsApi.getAll({ all: 'true' });
                    if (brandsResponse.status === 'success' && brandsResponse.data) {
                        if (Array.isArray(brandsResponse.data)) {
                            setTotalBrands(brandsResponse.data.length);
                        } else if (brandsResponse.data.count !== undefined) {
                            setTotalBrands(brandsResponse.data.count);
                        }
                    }
                } catch (err) {
                    console.error('Error fetching brands:', err);
                }

                setIsLoading(false);
            } catch (err) {
                console.error('Error fetching dashboard data:', err);
                setError('Failed to load dashboard data');
                setIsLoading(false);

                setToastState('error');
                setToastMessage('Failed to load dashboard data');
                setShowToast(true);
                setTimeout(() => setShowToast(false), 3000);
            }
        };

        fetchDashboardData();
    }, [user]);

    // Fetch alerts for warehouse staff
    useEffect(() => {
        if (!isWarehouseStaff(user) || !user) return;
        const fetchAlerts = async () => {
            const response = await itemsApi.getAll({ needs_attention: 'true' });
            if (response.status === 'success' && response.data) {
                // No need to fetch items as they are not used in the fetchAlerts function
            }
        };
        fetchAlerts();
    }, [user]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        }).format(date);
    };

    const handleLowStockClick = () => {
        // Use normal navigation with correct URL parameters
        navigate('/inventory?availability_status=Low+Stock');
    };

    const handleOutOfStockClick = () => {
        // Use normal navigation with correct URL parameters
        navigate('/inventory?availability_status=Out+of+Stock');
    };

    const getGreeting = () => {
        if (!user) return 'Welcome to your inventory dashboard';
        
        const name = user.first_name || user.username;
        return `Hi ${name}!`;
    };

    return (
        <div className="flex flex-col lg:flex-row min-h-screen overflow-hidden">
            {/* Sidebar */}
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            {/* Main Content */}
            <div className="flex-1 space-y-6 lg:space-y-8 p-4 lg:p-8 overflow-y-auto pb-12 lg:ml-64">
                {/* Mobile Header with Menu Button */}
                <div className="flex lg:hidden items-center mb-4">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-1 hover:bg-gray-100 rounded-lg"
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                </div>

                {/* Dashboard Header */}
                <header className="space-y-1">
                    <h1 className="text-2xl font-bold text-[#2C2C2C]">{getGreeting()}</h1>
                    <p className="text-[#646464]">
                        {isSales(user) ? "Track your reservations and dispatches." : "Your inventory at a glance."}
                    </p>
                </header>

                {/* Stats Cards - Simplified for Sales */}
                {isSales(user) ? (
                    <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Total Items Card */}
                        <div 
                            onClick={() => navigate('/inventory')}
                            className="bg-[#FCFBFC] border border-[#EBEAEA] rounded-xl p-5 cursor-pointer hover:border-[#DADAF3] transition-all"
                        >
                            <div className="flex justify-between items-start">
                                <div className="bg-[#E6E6FE] p-2 rounded-lg">
                                    <Package2 className="h-5 w-5 text-[#4237C7]" />
                                </div>
                                <ArrowUpRight className="h-5 w-5 text-gray-400" />
                            </div>
                            <h3 className="text-3xl font-semibold mt-4 text-[#2C2C2C]">
                                {isLoading ? '...' : inventoryStats.total_items}
                            </h3>
                            <p className="text-[#646464] mt-1">Available Items</p>
                        </div>

                        {/* Out of Stock Card */}
                        <div 
                            onClick={handleOutOfStockClick}
                            className="bg-[#FCFBFC] border border-[#EBEAEA] rounded-xl p-5 cursor-pointer hover:border-[#DADAF3] transition-all"
                        >
                            <div className="flex justify-between items-start">
                                <div className="bg-[#FEECEC] p-2 rounded-lg">
                                    <TriangleAlert className="h-5 w-5 text-[#DF3938]" />
                                </div>
                                <ArrowUpRight className="h-5 w-5 text-gray-400" />
                            </div>
                            <h3 className="text-3xl font-semibold mt-4 text-[#2C2C2C]">
                                {isLoading ? '...' : inventoryStats.out_of_stock}
                            </h3>
                            <p className="text-[#646464] mt-1">Out of Stock Items</p>
                        </div>
                    </section>
                ) : (
                    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Total Items Card */}
                        <div 
                            onClick={() => navigate('/inventory')}
                            className="bg-[#FCFBFC] border border-[#EBEAEA] rounded-xl p-5 cursor-pointer hover:border-[#DADAF3] transition-all"
                        >
                            <div className="flex justify-between items-start">
                                <div className="bg-[#E6E6FE] p-2 rounded-lg">
                                    <Package2 className="h-5 w-5 text-[#4237C7]" />
                                </div>
                                <ArrowUpRight className="h-5 w-5 text-gray-400" />
                            </div>
                            <h3 className="text-3xl font-semibold mt-4 text-[#2C2C2C]">
                                {isLoading ? '...' : inventoryStats.total_items}
                            </h3>
                            <p className="text-[#646464] mt-1">Total Items</p>
                        </div>

                        {/* Low Stock Card */}
                        <div 
                            onClick={handleLowStockClick}
                            className="bg-[#FCFBFC] border border-[#EBEAEA] rounded-xl p-5 cursor-pointer hover:border-[#DADAF3] transition-all"
                        >
                            <div className="flex justify-between items-start">
                                <div className="bg-[#FFF2E5] p-2 rounded-lg">
                                    <ArrowBigDownDash className="h-5 w-5 text-[#D97708]" />
                                </div>
                                <ArrowUpRight className="h-5 w-5 text-gray-400" />
                            </div>
                            <h3 className="text-3xl font-semibold mt-4 text-[#2C2C2C]">
                                {isLoading ? '...' : inventoryStats.low_stock}
                            </h3>
                            <p className="text-[#646464] mt-1">Low Stock</p>
                        </div>

                        {/* Out of Stock Card */}
                        <div 
                            onClick={handleOutOfStockClick}
                            className="bg-[#FCFBFC] border border-[#EBEAEA] rounded-xl p-5 cursor-pointer hover:border-[#DADAF3] transition-all"
                        >
                            <div className="flex justify-between items-start">
                                <div className="bg-[#FEECEC] p-2 rounded-lg">
                                    <TriangleAlert className="h-5 w-5 text-[#DF3938]" />
                                </div>
                                <ArrowUpRight className="h-5 w-5 text-gray-400" />
                            </div>
                            <h3 className="text-3xl font-semibold mt-4 text-[#2C2C2C]">
                                {isLoading ? '...' : inventoryStats.out_of_stock}
                            </h3>
                            <p className="text-[#646464] mt-1">Out of Stock</p>
                        </div>

                        {/* Total Brands Card */}
                        <div 
                            onClick={() => navigate('/brands')}
                            className="bg-[#FCFBFC] border border-[#EBEAEA] rounded-xl p-5 cursor-pointer hover:border-[#DADAF3] transition-all"
                        >
                            <div className="flex justify-between items-start">
                                <div className="bg-[#E6E6FE] p-2 rounded-lg">
                                    <Users className="h-5 w-5 text-[#4237C7]" />
                                </div>
                                <ArrowUpRight className="h-5 w-5 text-gray-400" />
                            </div>
                            <h3 className="text-3xl font-semibold mt-4 text-[#2C2C2C]">
                                {isLoading ? '...' : totalBrands}
                            </h3>
                            <p className="text-[#646464] mt-1">Brands</p>
                        </div>
                    </section>
                )}

                {/* Dashboard Charts for Inventory Manager */}
                {isInventoryManager(user) && (
                    <DashboardCharts 
                        inventoryStats={inventoryStats}
                        chartTransactions={chartTransactions}
                    />
                )}

                {/* Recent Transactions and Items Layout */}
                {isSales(user) ? (
                    // For Sales, show only Recent Transactions full width
                    <section className="bg-[#FCFBFC] border border-[#EBEAEA] rounded-xl p-6 mt-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                                <History className="h-5 w-5 text-[#4237C7] mr-2" />
                                <h2 className="text-lg font-semibold text-[#2C2C2C]">Your Recent Transactions</h2>
                            </div>
                            <button 
                                onClick={() => navigate('/transactions')}
                                className="text-[#0504AA] text-sm font-medium hover:underline"
                            >
                                View All
                            </button>
                        </div>
                        {isLoading ? (
                            <div className="py-4 text-center text-[#646464]">Loading...</div>
                        ) : error ? (
                            <div className="py-4 text-center text-[#DF3938]">{error}</div>
                        ) : recentTransactions.length === 0 ? (
                            <div className="py-4 text-center text-[#646464]">No transactions found</div>
                        ) : (
                            <div className="space-y-3">
                                {recentTransactions
                                    .filter(transaction => transaction.transaction_type === 'Reserve goods' || transaction.transaction_type === 'Dispatch goods')
                                    .map((transaction) => (
                                        <div 
                                            key={transaction.transaction_id} 
                                            className="border border-[#EBEAEA] rounded-lg p-3 cursor-pointer hover:border-[#DADAF3]"
                                            onClick={() => {
                                                setSelectedTransactionId(transaction.transaction_id);
                                                setModalOpen(true);
                                            }}
                                        >
                                            <div className="flex justify-between">
                                                <div className="flex-1 overflow-hidden">
                                                    <p className="font-medium text-[#2C2C2C] truncate">{transaction.transaction_type}</p>
                                                    <p className="text-sm text-[#646464] truncate">Ref: {transaction.reference_number}</p>
                                                </div>
                                                <div className="text-right ml-2 flex-shrink-0">
                                                    <p className="text-sm text-[#646464]">{formatDate(transaction.transacted_date)}</p>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                        transaction.transaction_status === 'Completed' 
                                                            ? 'bg-[#ECFDF5] text-[#065F46]'
                                                            : transaction.transaction_status === 'Cancelled'
                                                                ? 'bg-[#FEF3F2] text-[#B42318]'
                                                                : 'bg-[#FFF2E5] text-[#D97708]'
                                                    }`}>
                                                        {transaction.transaction_status}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </section>
                ) : (
                    // For other roles, keep the two-column layout
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Recent Transactions */}
                        <section className="bg-[#FCFBFC] border border-[#EBEAEA] rounded-xl p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center">
                                    <History className="h-5 w-5 text-[#4237C7] mr-2" />
                                    <h2 className="text-lg font-semibold text-[#2C2C2C]">Recent Transactions</h2>
                                </div>
                                <button 
                                    onClick={() => navigate('/transactions')}
                                    className="text-[#0504AA] text-sm font-medium hover:underline"
                                >
                                    View All
                                </button>
                            </div>
                            {isLoading ? (
                                <div className="py-4 text-center text-[#646464]">Loading...</div>
                            ) : error ? (
                                <div className="py-4 text-center text-[#DF3938]">{error}</div>
                            ) : recentTransactions.length === 0 ? (
                                <div className="py-4 text-center text-[#646464]">No transactions found</div>
                            ) : (
                                <div className="space-y-3">
                                    {recentTransactions.map((transaction) => (
                                        <div 
                                            key={transaction.transaction_id} 
                                            className="border border-[#EBEAEA] rounded-lg p-3 cursor-pointer hover:border-[#DADAF3]"
                                            onClick={() => {
                                                setSelectedTransactionId(transaction.transaction_id);
                                                setModalOpen(true);
                                            }}
                                        >
                                            <div className="flex justify-between">
                                                <div className="flex-1 overflow-hidden">
                                                    <p className="font-medium text-[#2C2C2C] truncate">{transaction.transaction_type}</p>
                                                    <p className="text-sm text-[#646464] truncate">Ref: {transaction.reference_number}</p>
                                                </div>
                                                <div className="text-right ml-2 flex-shrink-0">
                                                    <p className="text-sm text-[#646464]">{formatDate(transaction.transacted_date)}</p>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                        transaction.transaction_status === 'Completed' 
                                                            ? 'bg-[#ECFDF5] text-[#065F46]'
                                                            : transaction.transaction_status === 'Cancelled'
                                                                ? 'bg-[#FEF3F2] text-[#B42318]'
                                                                : 'bg-[#FFF2E5] text-[#D97708]'
                                                    }`}>
                                                        {transaction.transaction_status}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                        {/* Recent Items - Hide for Sales */}
                        {!isSales(user) && (
                            <section className="bg-[#FCFBFC] border border-[#EBEAEA] rounded-xl p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center">
                                        <Package2 className="h-5 w-5 text-[#4237C7] mr-2" />
                                        <h2 className="text-lg font-semibold text-[#2C2C2C]">Item List</h2>
                                    </div>
                                    <button 
                                        onClick={() => navigate('/inventory')}
                                        className="text-[#0504AA] text-sm font-medium hover:underline"
                                    >
                                        View All
                                    </button>
                                </div>

                                {isLoading ? (
                                    <div className="py-4 text-center text-[#646464]">Loading...</div>
                                ) : error ? (
                                    <div className="py-4 text-center text-[#DF3938]">{error}</div>
                                ) : recentItems.length === 0 ? (
                                    <div className="py-4 text-center text-[#DF3938]">Failed to load dashboard data</div>
                                ) : (
                                    <div className="space-y-3">
                                        {recentItems.map((item) => (
                                            <div 
                                                key={item.item_id} 
                                                className="border border-[#EBEAEA] rounded-lg p-3 cursor-pointer hover:border-[#DADAF3]"
                                                onClick={() => navigate(`/inventory/${item.item_id}`)}
                                            >
                                                <div className="flex justify-between">
                                                    <div className="flex-1 overflow-hidden">
                                                        <p className="font-medium text-[#2C2C2C] truncate">{item.item_name}</p>
                                                        <p className="text-sm text-[#646464] truncate">
                                                            {item.sku || 'No SKU'} | {item.category}
                                                        </p>
                                                    </div>
                                                    <div className="text-right ml-2 flex-shrink-0">
                                                        <p className="text-sm">
                                                            <span className="font-medium">{item.current_stock}</span>
                                                            <span className="text-[#646464]"> in stock</span>
                                                        </p>
                                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                            item.availability_status === 'Out of Stock' 
                                                                ? 'bg-[#FEECEC] text-[#DF3938]' 
                                                                : item.availability_status === 'Low Stock'
                                                                ? 'bg-[#FFF2E5] text-[#D97708]'
                                                                : 'bg-[#ECFDF5] text-[#065F46]'
                                                        }`}>
                                                            {item.availability_status}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}
                    </div>
                )}

                {/* Toast notification */}
                <Toast 
                    title={
                        toastState === 'loading' ? 'Loading...' : 
                        toastState === 'success' ? 'Success' : 'Error'
                    }
                    message={toastMessage}
                    type={toastState}
                    duration={3000}
                    isVisible={showToast} 
                    onClose={() => setShowToast(false)} 
                />
            </div>
            {/* Always render the TransactionDetailsModal at the root */}
            <TransactionDetailsModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                transactionId={selectedTransactionId}
                userList={userList}
            />
        </div>
    );
} 