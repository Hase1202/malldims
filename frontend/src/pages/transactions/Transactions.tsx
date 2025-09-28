import { useState, useEffect, useCallback } from 'react';
import { Filter, Menu } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import Sidebar from "../../components/common/Sidebar";
import TransactionTable from "../../components/features/Transactions/TransactionTable";
import FilterDropdown from "../../components/common/FilterDropdown";
import Toast from "../../components/common/Toast";
import AddTransactionModal from "./AddTransaction";
import { useAuthContext } from '../../context/AuthContext';
import { isSales } from '../../utils/permissions';
import { usersApi, User } from '../../lib/api';

export default function TransactionsPage() {
    const navigate = useNavigate();
    const location = useLocation();
    
    const [activeTab, setActiveTab] = useState("all");
    const [transactionType, setTransactionType] = useState<'Incoming' | 'Outgoing' | 'Adjustment' | null>(null);
    const [releaseStatus, setReleaseStatus] = useState<string | null>(null);
    const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
    const [orInvoiceStatus, setOrInvoiceStatus] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isAddTransactionModalOpen, setIsAddTransactionModalOpen] = useState(false);
    
    // Date range filter state
    const [startDate, setStartDate] = useState<string>('');
    const [endDate, setEndDate] = useState<string>('');
    const [dateRangeError, setDateRangeError] = useState<string>('');

    // Validate date range
    const validateDateRange = (start: string, end: string) => {
        if (start && end && new Date(start) > new Date(end)) {
            setDateRangeError('Start date cannot be after end date');
            return false;
        } else {
            setDateRangeError('');
            return true;
        }
    };

    // Handle start date change with validation
    const handleStartDateChange = (value: string) => {
        setStartDate(value);
        // If end date exists and start date is after end date, clear end date
        if (value && endDate && new Date(value) > new Date(endDate)) {
            setEndDate('');
            setDateRangeError('');
        } else {
            validateDateRange(value, endDate);
        }
    };

    // Handle end date change with validation
    const handleEndDateChange = (value: string) => {
        // If start date exists and end date is before start date, show error but don't set the value
        if (value && startDate && new Date(startDate) > new Date(value)) {
            setDateRangeError('End date cannot be before start date');
            return;
        }
        setEndDate(value);
        validateDateRange(startDate, value);
    };
    
    // Toast state
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
    
    const queryClient = useQueryClient();
    const { user } = useAuthContext();
    const [userList, setUserList] = useState<User[]>([]);
    
    useEffect(() => {
        console.log('TransactionsPage component mounted. Path:', location.pathname);
        
        // Check URL parameters
        const searchParams = new URLSearchParams(location.search);
        const refreshParam = searchParams.get('refresh');
        const highlightId = searchParams.get('highlight');
        const toastMessage = searchParams.get('toast');
        const shouldRefresh = refreshParam !== null;
        
        if (shouldRefresh) {
            console.log(`Refreshing data with timestamp: ${refreshParam}`);
            
            // Explicitly invalidate and refetch all transaction queries
            queryClient.invalidateQueries({ 
                queryKey: ['transactions'],
                refetchType: 'all',
                exact: false
            });
            
            // Clean up URL parameters but keep the highlight if present
            searchParams.delete('refresh');
            searchParams.delete('toast'); // Remove toast parameter as well
            const newSearchParams = searchParams.toString();
            const newUrl = newSearchParams 
                ? `${location.pathname}?${newSearchParams}`
                : location.pathname;
            
            // Show toast if provided in URL
            if (toastMessage) {
                setToastMessage(decodeURIComponent(toastMessage));
                setToastType('success');
                setShowToast(true);
            }
            // Or show generic message if we're refreshing with a transaction ID
            else if (highlightId) {
                setToastMessage('Transaction added successfully');
                setToastType('success');
                setShowToast(true);
            }
            
            // Update URL without causing a new history entry
            navigate(newUrl, { replace: true });
        }
        
        return () => {
            console.log('TransactionsPage component unmounted');
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search]);
    
    useEffect(() => {
        usersApi.getAll().then(res => {
            if (res.status === 'success' && res.data) setUserList(res.data);
        });
    }, []);
    
    // Handle transaction updates
    const handleTransactionUpdate = useCallback((message: string = 'Transaction status changed successfully') => {
        setToastMessage(message);
        setToastType('success');
        setShowToast(true);
    }, []);

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
    };

    const handleTransactionTypeChange = (type: string | null) => {
        if (type === 'Incoming' || type === 'Outgoing' || type === 'Adjustment') {
            setTransactionType(type);
        } else {
            setTransactionType(null);
        }
        // Reset status filters when changing transaction type
        setReleaseStatus(null);
        setPaymentStatus(null);
        setOrInvoiceStatus(null);
    };

    const handleReleaseStatusChange = (status: string | null) => {
        setReleaseStatus(status);
    };

    const handlePaymentStatusChange = (status: string | null) => {
        setPaymentStatus(status);
    };

    const handleOrInvoiceStatusChange = (status: string | null) => {
        setOrInvoiceStatus(status);
    };

    const handleAddTransaction = () => {
        setIsAddTransactionModalOpen(true);
    };

    const handleModalClose = () => {
        setIsAddTransactionModalOpen(false);
    };

    const handleTransactionSuccess = () => {
        // Refresh the transactions data
        queryClient.invalidateQueries({ 
            queryKey: ['transactions'],
            refetchType: 'all',
            exact: false
        });
        
        // Show success toast
        setToastMessage('Transaction created successfully');
        setToastType('success');
        setShowToast(true);
    };

    // Calculate active filter count
    const activeFilterCount = [
        transactionType,
        releaseStatus,
        paymentStatus,
        orInvoiceStatus,
        startDate,
        endDate
    ].filter(Boolean).length;

    // Only show Add Transaction button for Sales if allowed
    const canAddTransaction = !isSales(user) || true; // Sales can always add, but AddTransaction page will restrict type

    return (
        <div className="flex flex-col lg:flex-row min-h-screen overflow-hidden">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <div className="w-full h-full overflow-y-auto p-4 lg:p-8 lg:ml-64">
                {/* Mobile Header with Menu Button */}
                <div className="flex lg:hidden items-center mb-4">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-1 hover:bg-gray-100 rounded-lg"
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                </div>

                <section className="space-y-3 mt-6 lg:mt-8">
                    {/* Header with Transaction Button (both mobile and desktop) */}
                    <div className="flex flex-col space-y-1">
                        <div className="flex items-center justify-between">
                            <h1 className="text-2xl font-bold text-[#2C2C2C]">Transaction Log</h1>
                            {canAddTransaction && (
                                <button 
                                    onClick={handleAddTransaction}
                                    className="flex items-center cursor-pointer gap-1.5 py-2 px-3.5 rounded-lg text-white text-sm font-medium bg-[#0504AA] border-[1.5px] border-[#0504AA] hover:bg-[#0504AA]/90 active:scale-95 transition-all"
                                >
                                    Add Transaction
                                </button>
                            )}
                        </div>
                        
                        <p className="text-[#646464] mt-1 mb-4">Track all stock movements and pending transactions.</p>
                    </div>

                    {/* Filters Section */}
                    <div className="overflow-x-auto pb-2 mb-1">
                        {/* Date Range and Status Filters */}
                        <div className="flex items-center gap-2.5 mb-3 min-w-max">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-medium text-gray-700">Date Range:</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => handleStartDateChange(e.target.value)}
                                        className={`px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                                            dateRangeError 
                                                ? 'border-red-500 focus:ring-red-500' 
                                                : 'border-gray-300 focus:ring-blue-500'
                                        }`}
                                        placeholder="Start Date"
                                    />
                                    <span className="text-gray-500">to</span>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => handleEndDateChange(e.target.value)}
                                        className={`px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
                                            dateRangeError 
                                                ? 'border-red-500 focus:ring-red-500' 
                                                : 'border-gray-300 focus:ring-blue-500'
                                        }`}
                                        placeholder="End Date"
                                    />
                                </div>
                                
                                {/* Date Range Error Message */}
                                {dateRangeError && (
                                    <div className="text-sm text-red-600 ml-24">
                                        {dateRangeError}
                                    </div>
                                )}
                            </div>
                            
                            {/* Clear Filters Button */}
                            {activeFilterCount > 0 && (
                                <button
                                    onClick={() => {
                                        setStartDate('');
                                        setEndDate('');
                                        setDateRangeError('');
                                        setTransactionType(null);
                                        setReleaseStatus(null);
                                        setPaymentStatus(null);
                                        setOrInvoiceStatus(null);
                                    }}
                                    className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 border border-red-300 hover:border-red-400 rounded-lg"
                                >
                                    Clear All
                                </button>
                            )}
                        </div>

                        {/* Transaction Type Tabs and Status Filters */}
                        <div className="flex items-center gap-2.5 min-w-max">
                            <button 
                                onClick={() => handleTabChange("all")}
                                className={`flex items-center gap-1.5 cursor-pointer py-1.5 px-3.5 rounded-lg transition-all whitespace-nowrap active:scale-95 ${
                                    activeTab === "all" 
                                        ? "bg-[#F2F2FB] text-[#0504AA] border-[1.5px] border-[#DADAF3]" 
                                        : "border-[1.5px] border-[#EBEAEA] text-[#6F6F6F] hover:bg-gray-50"
                                }`}
                            >
                                All Transactions
                            </button>
                            
                            <button 
                                onClick={() => handleTabChange("pending")}
                                className={`flex items-center gap-1.5 cursor-pointer py-1.5 px-3.5 rounded-lg transition-all whitespace-nowrap active:scale-95 ${
                                    activeTab === "pending" 
                                        ? "bg-[#F2F2FB] text-[#0504AA] border-[1.5px] border-[#DADAF3]" 
                                        : "border-[1.5px] border-[#EBEAEA] text-[#6F6F6F] hover:bg-gray-50"
                                }`}
                            >
                                Pending Transactions
                            </button>
                            
                            <button 
                                onClick={() => handleTabChange("completed")}
                                className={`flex items-center cursor-pointer gap-1.5 py-1.5 px-3.5 rounded-lg transition-all whitespace-nowrap active:scale-95 ${
                                    activeTab === "completed" 
                                        ? "bg-[#F2F2FB] text-[#0504AA] border-[1.5px] border-[#DADAF3]" 
                                        : "border-[1.5px] border-[#EBEAEA] text-[#6F6F6F] hover:bg-gray-50"
                                }`}
                            >
                                Completed Transactions
                            </button>

                            {/* Transaction Type Filter */}
                            <FilterDropdown
                                label="Transaction Type"
                                options={['Incoming', 'Outgoing', 'Adjustment']}
                                value={transactionType}
                                onChange={handleTransactionTypeChange}
                            />

                            {/* Status Filters for OUTGOING transactions only */}
                            {transactionType === 'Outgoing' && (
                                <>
                                    <FilterDropdown
                                        label="Release Status"
                                        options={['Released', 'Not Released']}
                                        value={releaseStatus}
                                        onChange={handleReleaseStatusChange}
                                    />

                                    <FilterDropdown
                                        label="Payment Status"
                                        options={['Paid', 'Not Paid']}
                                        value={paymentStatus}
                                        onChange={handlePaymentStatusChange}
                                    />

                                    <FilterDropdown
                                        label="O.R/Invoice Status"
                                        options={['Sent', 'Not Sent']}
                                        value={orInvoiceStatus}
                                        onChange={handleOrInvoiceStatusChange}
                                    />
                                </>
                            )}

                            <div className={`flex-shrink-0 flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg border-[1.5px] border-[#DADAF3] text-[#0504AA] bg-[#F2F2FB]`}>
                                <Filter className="h-4 w-4" />
                                Filters - {activeFilterCount}
                            </div>
                        </div>
                    </div>

                    <TransactionTable 
                        key={`transactions-${activeTab}-${transactionType || 'all'}-${releaseStatus || ''}-${paymentStatus || ''}-${orInvoiceStatus || ''}-${startDate}-${endDate}`}
                        transactionType={activeTab as 'completed' | 'pending' | 'all'}
                        searchQuery=""
                        filters={{
                            ...(transactionType ? { transactionType } : {}),
                            ...(releaseStatus ? { releaseStatus } : {}),
                            ...(paymentStatus ? { paymentStatus } : {}),
                            ...(orInvoiceStatus ? { orInvoiceStatus } : {}),
                            ...(startDate ? { startDate } : {}),
                            ...(endDate ? { endDate } : {})
                        }}
                        onTransactionUpdate={handleTransactionUpdate}
                        userList={userList}
                    />
                </section>
            </div>
            
            {/* Toast notification */}
            <Toast
                isVisible={showToast}
                title={toastMessage}
                type={toastType === 'error' ? 'error' : 'success'}
                onClose={() => setShowToast(false)}
            />
            
            {/* Add Transaction Modal */}
            <AddTransactionModal
                isOpen={isAddTransactionModalOpen}
                onClose={handleModalClose}
                onSuccess={handleTransactionSuccess}
            />
        </div>
    );
}