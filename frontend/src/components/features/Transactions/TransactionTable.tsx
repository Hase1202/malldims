import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { transactionsApi } from '../../../lib/api';
import { User } from '../../../lib/api';
import TransactionDetailsModal from './TransactionDetailsModal';
import { Transaction } from '../../../types/inventory';
import { useAuthContext } from '../../../context/AuthContext';
import { isSales } from '../../../utils/permissions';

interface APIResponse {
    count: number;
    next: string | null;
    previous: string | null;
    results: Transaction[];
}

interface SortConfig {
    field: string;
    direction: 'asc' | 'desc';
}

interface SortableColumn {
    key: string;
    label: string;
}

const SORTABLE_COLUMNS: SortableColumn[] = [
    { key: 'transacted_date', label: 'Date' },
    { key: 'brand_name', label: 'Brand/Customer' },
    { key: 'due_date', label: 'Due Date' },
    { key: 'priority_status', label: 'Status' }
];

interface TransactionTableProps {
    transactionType?: 'completed' | 'pending';
    stockMovementType?: 'in' | 'out' | null;
    searchQuery?: string;
    filters?: Record<string, string>;
    onTransactionUpdate?: (message?: string) => void;
    userList?: User[];
}

const getBrandOrCustomer = (tx: Transaction) =>
    (tx.brand_name || tx.customer_name || '').toLowerCase();

const TransactionTable: React.FC<TransactionTableProps> = ({ 
    transactionType = 'completed',
    stockMovementType,
    searchQuery = '', 
    filters = {},
    onTransactionUpdate,
    userList = [],
}) => {
    const [selectedTransactionId, setSelectedTransactionId] = useState<number | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    
    // Debug logging for state changes
    useEffect(() => {
        console.log('TransactionTable state changed:', { isModalOpen, selectedTransactionId });
    }, [isModalOpen, selectedTransactionId]);
    const [sort, setSort] = useState<SortConfig>({ field: 'created_at', direction: 'desc' });
    const [activeSortColumn, setActiveSortColumn] = useState<string | null>(null);
    const queryClient = useQueryClient();
    const { user } = useAuthContext();
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (activeSortColumn && !((event.target as Element).closest('.sort-dropdown') || (event.target as Element).closest('.sort-button'))) {
                console.log('Click outside detected, closing dropdown');
                setActiveSortColumn(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeSortColumn]);

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading,
        error,
        refetch
    } = useInfiniteQuery<APIResponse>({
        queryKey: ['transactions', searchQuery, transactionType, stockMovementType, filters, sort],
        initialPageParam: 1,
        queryFn: async ({ pageParam }) => {
            try {
                const params = new URLSearchParams({
                    page: String(pageParam)
                });
                
                params.append('status', transactionType === 'completed' ? 'Completed' : 'Pending');
                
                if (sort.field) {
                    let sortField = sort.field;
                    if (sort.field === 'brand_name') {
                        if (stockMovementType === 'in') {
                            sortField = 'brand__brand_name';
                        } else if (stockMovementType === 'out') {
                            sortField = 'customer_name';
                        }
                    } else if (sort.field === 'priority_status' && transactionType === 'pending') {
                        // Custom handling for priority status sorting will be done client-side
                        sortField = 'priority_status';
                    }
                    params.append('ordering', `${sort.direction === 'desc' ? '-' : ''}${sortField}`);
                } else {
                    params.append('ordering', '-created_at');
                }
                
                if (searchQuery) {
                    params.append('search', searchQuery);
                }
                
                if (stockMovementType === 'in') {
                    params.append('type', 'Receive Products,Return goods');
                } else if (stockMovementType === 'out') {
                    params.append('type', 'Dispatch goods,Reserve goods');
                }
                
                if (filters.type) {
                    // Handle special case for Manual correction filters
                    if (filters.type === 'Manual correction (+)') {
                        params.set('type', 'Manual correction');
                        params.append('correction_type', 'positive');
                    } else if (filters.type === 'Manual correction (-)') {
                        params.set('type', 'Manual correction');
                        params.append('correction_type', 'negative');
                    } else {
                        params.set('type', filters.type);
                    }
                }
                
                if (isSales(user)) {
                    params.set('mine', 'true');
                }
                
                console.log('API params:', Object.fromEntries(params.entries()));
                
                const response = await transactionsApi.getAll(params);
                
                if (response.status === 'error' || !response.data) {
                    throw new Error(response.message || 'Failed to fetch transactions');
                }
                
                // Handle different response formats
                if (Array.isArray(response.data)) {
                    console.log('Response is an array with', response.data.length, 'transactions');
                    return {
                        count: response.data.length,
                        next: null,
                        previous: null,
                        results: response.data
                    } as APIResponse;
                } else if (response.data && typeof response.data === 'object' && 'results' in response.data) {
                    console.log('Response is paginated with', (response.data as any).results.length, 'transactions');
                    return response.data as APIResponse;
                }
                
                return {
                    count: 0,
                    next: null,
                    previous: null,
                    results: []
                } as APIResponse;
            } catch (error) {
                console.error('Error fetching transactions:', error);
                throw error;
            }
        },
        getNextPageParam: (lastPage: APIResponse) => {
            if (!lastPage.next) return undefined;
            const nextUrl = new URL(lastPage.next);
            const nextPage = nextUrl.searchParams.get('page');
            return nextPage ? parseInt(nextPage) : undefined;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
    });

    // This effect runs when query dependencies change
    useEffect(() => {
        // Only refetch if modal is not open to prevent closing it
        if (!isModalOpen) {
            console.log('Transaction query dependencies changed, refetching');
            refetch();
        } else {
            console.log('Modal is open, skipping refetch to prevent modal closure');
        }
    }, [transactionType, stockMovementType, filters, sort, refetch, isModalOpen]);

    // Function to handle transaction updates
    const handleTransactionUpdate = useCallback((message?: string) => {
        console.log('Transaction was updated, but keeping modal open...');
        
        // Only invalidate queries without immediate refetch to prevent modal closure
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        
        // Call the parent's onTransactionUpdate callback if provided
        if (onTransactionUpdate) {
            onTransactionUpdate(message);
        }
        
        // Delay refetch until modal is closed
        setTimeout(() => {
            if (!isModalOpen) {
                refetch();
            }
        }, 500);
    }, [onTransactionUpdate, queryClient, isModalOpen, refetch]);

    // Separate handler for modal close that won't trigger refetch
    const handleCloseModal = useCallback(() => {
        console.log('Closing transaction modal manually');
        setIsModalOpen(false);
        setSelectedTransactionId(null);
    }, []);

    // Intersection Observer setup with debouncing
    const observer = useRef<IntersectionObserver>();
    const lastItemRef = useCallback((node: HTMLDivElement | null) => {
        if (isFetchingNextPage) return;

        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
                    console.log('Loading next page...');
                    fetchNextPage();
                }
            },
            {
                threshold: 0.1,
                rootMargin: '100px'
            }
        );

        if (node) observer.current.observe(node);
    }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

    const handleViewDetails = (transactionId: number, event?: React.MouseEvent) => {
        console.log('handleViewDetails called with ID:', transactionId);
        console.log('Event details:', event?.target, event?.currentTarget);
        
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        
        setSelectedTransactionId(transactionId);
        setIsModalOpen(true);
        console.log('Modal state set - isModalOpen:', true, 'selectedTransactionId:', transactionId);
    };

    const handleSort = (columnKey: string, direction: 'asc' | 'desc' | null) => {
        console.log('Sorting:', columnKey, direction);
        if (direction === null) {
            // Reset to default sort
            setSort({ field: 'created_at', direction: 'desc' });
        } else {
            setSort({ field: columnKey, direction });
        }
        setActiveSortColumn(null);
    };

    // Only show sort icon for columns that are sortable
    const isSortableColumn = (columnKey: string) => {
        return SORTABLE_COLUMNS.some(col => col.key === columnKey);
    };

    const getSortIcon = (columnKey: string) => {
        if (!isSortableColumn(columnKey)) return null;
        
        if (sort.field !== columnKey) {
            return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
        }
        return sort.direction === 'asc' 
            ? <ArrowUp className="w-4 h-4 text-gray-700" />
            : <ArrowDown className="w-4 h-4 text-gray-700" />;
    };

    const getTypeColor = (type: string): string => {
        switch (type.toLowerCase()) {
            case 'dispatch goods':
                return 'bg-[#FDF2FA] text-[#C11574] px-2.5 py-1 rounded-full text-xs';
            case 'receive goods':
            case 'receive products':
                return 'bg-[#F4F3FF] text-[#5925DC] px-2.5 py-1 rounded-full text-xs';
            case 'return goods':
                return 'bg-[#F0F9FF] text-[#026AA2] px-2.5 py-1 rounded-full text-xs';
            case 'reserve goods':
                return 'bg-[#FEF3F2] text-[#B42318] px-2.5 py-1 rounded-full text-xs';
            case 'manual correction':
                return 'bg-[#F0FDF4] text-[#027A48] px-2.5 py-1 rounded-full text-xs';
            default:
                return 'text-gray-900';
        }
    };

    const getStatusBadge = (status: string, priorityStatus?: string, dueDate?: string): string => {
        if (status.toLowerCase() === 'pending') {
            // Check if overdue
            if (dueDate) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dueDateObj = new Date(dueDate);
                if (dueDateObj < today) {
                    return 'bg-red-50 text-red-600 px-2.5 py-1 rounded-full text-xs';
                }
            }
            
            // If not overdue, use priority status colors
            switch (priorityStatus?.toLowerCase()) {
                case 'critical':
                    return 'bg-orange-50 text-orange-600 px-2.5 py-1 rounded-full text-xs';
                case 'urgent':
                    return 'bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full text-xs';
                case 'normal':
                    return 'bg-yellow-50 text-yellow-600 px-2.5 py-1 rounded-full text-xs';
                default:
                    return 'bg-yellow-50 text-yellow-600 px-2.5 py-1 rounded-full text-xs';
            }
        }
        
        switch (status.toLowerCase()) {
            case 'completed':
                return 'bg-green-50 text-green-600 px-2.5 py-1 rounded-full text-xs';
            case 'cancelled':
                return 'bg-red-50 text-red-600 px-2.5 py-1 rounded-full text-xs';
            default:
                return 'bg-gray-50 text-gray-600 px-2.5 py-1 rounded-full text-xs';
        }
    };

    const getStatusText = (status: string, priorityStatus?: string, dueDate?: string): string => {
        if (status.toLowerCase() === 'pending') {
            // Check if overdue
            if (dueDate) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dueDateObj = new Date(dueDate);
                if (dueDateObj < today) {
                    return 'Overdue';
                }
            }
            return priorityStatus || 'Normal';
        }
        return status;
    };

    // Add priority status weight for sorting
    const getPriorityWeight = (status: string, priorityStatus?: string, dueDate?: string): number => {
        if (status.toLowerCase() === 'pending') {
            // Check if overdue first
            if (dueDate) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const dueDateObj = new Date(dueDate);
                if (dueDateObj < today) {
                    return 4; // Overdue has highest priority
                }
            }
            
            // Then check priority status
            switch (priorityStatus?.toLowerCase()) {
                case 'critical':
                    return 3;
                case 'urgent':
                    return 2;
                case 'normal':
                    return 1;
                default:
                    return 0;
            }
        }
        return 0;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    };

    const TableSkeleton = () => (
        <>
            <table className="w-full border-collapse">
                <thead>
                    <tr className="border-b border-[#EBEAEA] bg-gray-50">
                        {['Date', 'Type', 'Items', 'Brand/Customer', 'Reference No.', 'Status'].map((_, index) => (
                            <th key={index} className="px-4 py-4 text-left">
                                <div className="h-5 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {[...Array(5)].map((_, index) => (
                        <tr key={index} className="border-b border-[#EBEAEA]">
                            <td className="px-4 py-5">
                                <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                            </td>
                            <td className="px-4 py-5">
                                <div className="h-4 bg-gray-200 rounded w-28 animate-pulse"></div>
                            </td>
                            <td className="px-4 py-5">
                                <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                            </td>
                            <td className="px-4 py-5">
                                <div className="h-4 bg-gray-200 rounded w-36 animate-pulse"></div>
                            </td>
                            <td className="px-4 py-5">
                                <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                            </td>
                            <td className="px-4 py-5">
                                <div className="h-6 bg-gray-200 rounded w-24 animate-pulse"></div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="flex justify-between items-center p-4 border-x border-b border-[#EBEAEA] rounded-b-xl">
                <div className="h-8 bg-gray-200 rounded w-20 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                <div className="h-8 bg-gray-200 rounded w-20 animate-pulse"></div>
            </div>
        </>
    );

    if (isLoading) return (
        <div className="w-full bg-white rounded-t-xl border-[#EBEAEA] border-[1.5px]">
            <TableSkeleton />
        </div>
    );
    
    if (error) return <div className="w-full p-8 text-center text-red-500">Error: {error instanceof Error ? error.message : 'An error occurred'}</div>;
    
    if (!data || !data.pages[0] || data.pages[0].results.length === 0) {
        return <div className="w-full p-8 text-center text-gray-500">No transactions found.</div>;
    }

    // Only use API transactions
    const apiTransactions = data.pages.flatMap(page => page.results);

    // When mapping/filtering transaction types, if isSales(user), filter out 'Manual correction' types from the displayed transactions.
    const filteredTransactions = apiTransactions.filter(transaction => {
        if (isSales(user) && transaction.transaction_type === 'Manual correction') {
            return false;
        }
        return true;
    });

    // Modify the filtered transactions to include priority sorting if needed
    let sortedTransactions = [...filteredTransactions];
    if (sort.field === 'priority_status' && transactionType === 'pending') {
        sortedTransactions.sort((a, b) => {
            const weightA = getPriorityWeight(a.transaction_status, a.priority_status, a.due_date);
            const weightB = getPriorityWeight(b.transaction_status, b.priority_status, b.due_date);
            return sort.direction === 'asc' ? weightB - weightA : weightA - weightB;
        });
    } else if (sort.field === 'brand_name' && sort.direction) {
        sortedTransactions.sort((a, b) => {
            // Defensive: always compare strings, never undefined
            const aName = getBrandOrCustomer(a) || '';
            const bName = getBrandOrCustomer(b) || '';
            if (aName < bName) return sort.direction === 'asc' ? -1 : 1;
            if (aName > bName) return sort.direction === 'asc' ? 1 : -1;
            return 0;
        });
    } else if (sort.field && sort.direction) {
        sortedTransactions.sort((a, b) => {
            // Defensive: always compare strings, never undefined
            const aValue = String(a[sort.field as keyof Transaction] || '');
            const bValue = String(b[sort.field as keyof Transaction] || '');
            if (aValue < bValue) return sort.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sort.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    return (
        <>
            <div className="w-full bg-white">
                <div className="overflow-x-auto rounded-xl border-[#EBEAEA] border-[1.5px]">
                    <table className="w-full border-collapse" role="grid" aria-label="Transaction list">
                        <thead>
                            <tr className="border-b border-[#EBEAEA] bg-gray-50">
                                <th className="px-4 py-3 text-left text-sm font-medium text-[#646464]">
                                    <div className="relative inline-block">
                                        <button
                                            onClick={() => setActiveSortColumn(activeSortColumn === 'transacted_date' ? null : 'transacted_date')}
                                            className="inline-flex items-center gap-1.5 px-2 rounded transition-all text-[#6F6F6F] hover:bg-gray-100 active:scale-95 sort-button"
                                        >
                                            Date
                                            {getSortIcon('transacted_date')}
                                        </button>
                                        {activeSortColumn === 'transacted_date' && (
                                            <div className="absolute z-10 mt-1 w-36 bg-white rounded-lg shadow-lg border-[1.5px] border-[#EBEAEA] py-1 sort-dropdown">
                                                <button
                                                    onClick={() => handleSort('transacted_date', 'asc')}
                                                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#6F6F6F] font-normal hover:bg-gray-50 active:scale-95"
                                                >
                                                    <ArrowUp className="w-4 h-4" />
                                                    Earliest first
                                                </button>
                                                <button
                                                    onClick={() => handleSort('transacted_date', 'desc')}
                                                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#6F6F6F] font-normal hover:bg-gray-50 active:scale-95"
                                                >
                                                    <ArrowDown className="w-4 h-4" />
                                                    Latest first
                                                </button>
                                                {sort.field === 'transacted_date' && (
                                                    <button
                                                        onClick={() => handleSort('transacted_date', null)}
                                                        className="flex items-center gap-2 w-full px-3 py-2.5 -mb-1 text-sm text-red-500 font-normal hover:bg-gray-50 active:scale-95 border-t border-[#EBEAEA]"
                                                    >
                                                        <X className="w-4 h-4" />
                                                        Clear sort
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-[#646464]">
                                    <div className="inline-block">
                                        Type
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-[#646464]">
                                    Items
                                </th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-[#646464]">
                                    <div className="relative inline-block">
                                        <button
                                            onClick={() => setActiveSortColumn(activeSortColumn === 'brand_name' ? null : 'brand_name')}
                                            className="inline-flex items-center gap-1.5 px-2 rounded transition-all text-[#6F6F6F] hover:bg-gray-100 active:scale-95 sort-button"
                                        >
                                            Brand/Customer
                                            {getSortIcon('brand_name')}
                                        </button>
                                        {activeSortColumn === 'brand_name' && (
                                            <div className="absolute z-10 mt-1 w-36 bg-white rounded-lg shadow-lg border-[1.5px] border-[#EBEAEA] py-1 sort-dropdown">
                                                <button
                                                    onClick={() => handleSort('brand_name', 'asc')}
                                                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#6F6F6F] font-normal hover:bg-gray-50 active:scale-95"
                                                >
                                                    <ArrowUp className="w-4 h-4" />
                                                    A-Z
                                                </button>
                                                <button
                                                    onClick={() => handleSort('brand_name', 'desc')}
                                                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#6F6F6F] font-normal hover:bg-gray-50 active:scale-95"
                                                >
                                                    <ArrowDown className="w-4 h-4" />
                                                    Z-A
                                                </button>
                                                {sort.field === 'brand_name' && (
                                                    <button
                                                        onClick={() => handleSort('brand_name', null)}
                                                        className="flex items-center gap-2 w-full px-3 py-2.5 -mb-1 text-sm text-red-500 font-normal hover:bg-gray-50 active:scale-95 border-t border-[#EBEAEA]"
                                                    >
                                                        <X className="w-4 h-4" />
                                                        Clear sort
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-[#646464]">
                                    Reference No.
                                </th>
                                {transactionType === 'pending' && (
                                    <th className="px-4 py-3 text-left text-sm font-medium text-[#646464]">
                                        <div className="relative inline-block">
                                            <button
                                                onClick={() => setActiveSortColumn(activeSortColumn === 'due_date' ? null : 'due_date')}
                                                className="inline-flex items-center gap-1.5 px-2 rounded transition-all text-[#6F6F6F] hover:bg-gray-100 active:scale-95 sort-button"
                                            >
                                                Due Date
                                                {getSortIcon('due_date')}
                                            </button>
                                            {activeSortColumn === 'due_date' && (
                                                <div className="absolute z-10 mt-1 w-36 bg-white rounded-lg shadow-lg border-[1.5px] border-[#EBEAEA] py-1 sort-dropdown">
                                                    <button
                                                        onClick={() => handleSort('due_date', 'asc')}
                                                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#6F6F6F] font-normal hover:bg-gray-50 active:scale-95"
                                                    >
                                                        <ArrowUp className="w-4 h-4" />
                                                        Earliest first
                                                    </button>
                                                    <button
                                                        onClick={() => handleSort('due_date', 'desc')}
                                                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#6F6F6F] font-normal hover:bg-gray-50 active:scale-95"
                                                    >
                                                        <ArrowDown className="w-4 h-4" />
                                                        Latest first
                                                    </button>
                                                    {sort.field === 'due_date' && (
                                                        <button
                                                            onClick={() => handleSort('due_date', null)}
                                                            className="flex items-center gap-2 w-full px-3 py-2.5 -mb-1 text-sm text-red-500 font-normal hover:bg-gray-50 active:scale-95 border-t border-[#EBEAEA]"
                                                        >
                                                            <X className="w-4 h-4" />
                                                            Clear sort
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </th>
                                )}
                                {transactionType === 'pending' && (
                                    <th className="px-4 py-3 text-left text-sm font-medium text-[#646464]">
                                        <div className="relative inline-block">
                                            <button
                                                onClick={() => setActiveSortColumn(activeSortColumn === 'priority_status' ? null : 'priority_status')}
                                                className="inline-flex items-center gap-1.5 px-2 rounded transition-all text-[#6F6F6F] hover:bg-gray-100 active:scale-95 sort-button"
                                            >
                                                Status
                                                {getSortIcon('priority_status')}
                                            </button>
                                            {activeSortColumn === 'priority_status' && (
                                                <div className="absolute z-10 mt-1 w-36 bg-white rounded-lg shadow-lg border-[1.5px] border-[#EBEAEA] py-1 sort-dropdown">
                                                    <button
                                                        onClick={() => handleSort('priority_status', 'asc')}
                                                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#6F6F6F] font-normal hover:bg-gray-50 active:scale-95"
                                                    >
                                                        <ArrowUp className="w-4 h-4" />
                                                        Highest priority
                                                    </button>
                                                    <button
                                                        onClick={() => handleSort('priority_status', 'desc')}
                                                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#6F6F6F] font-normal hover:bg-gray-50 active:scale-95"
                                                    >
                                                        <ArrowDown className="w-4 h-4" />
                                                        Lowest priority
                                                    </button>
                                                    {sort.field === 'priority_status' && (
                                                        <button
                                                            onClick={() => handleSort('priority_status', null)}
                                                            className="flex items-center gap-2 w-full px-3 py-2.5 -mb-1 text-sm text-red-500 font-normal hover:bg-gray-50 active:scale-95 border-t border-[#EBEAEA]"
                                                        >
                                                            <X className="w-4 h-4" />
                                                            Clear sort
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </th>
                                )}
                                {transactionType === 'completed' && (
                                    <th className="px-4 py-3 text-left text-sm font-medium text-[#646464]">
                                        Status
                                    </th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedTransactions.map((transaction, index) => {
                                const handleRowClick = (e: React.MouseEvent) => {
                                    console.log('Row click handler triggered for transaction:', transaction.transaction_id);
                                    console.log('Click event target:', e.target);
                                    console.log('Click event currentTarget:', e.currentTarget);
                                    handleViewDetails(transaction.transaction_id, e);
                                };

                                return (
                                <tr 
                                    key={`${transaction.transaction_id}-${index}`} 
                                    className="border-b border-[#EBEAEA] hover:bg-gray-50 cursor-pointer transition-colors"
                                    ref={index === sortedTransactions.length - 1 ? lastItemRef : null}
                                    onClick={handleRowClick}
                                    onMouseDown={() => console.log('Mouse down on row:', transaction.transaction_id)}
                                    title="Click to view transaction details"
                                >
                                    <td className="px-4 py-5 whitespace-nowrap text-sm text-gray-900">
                                        {formatDate(transaction.transacted_date)}
                                    </td>
                                    <td className="px-4 py-5 whitespace-nowrap text-sm">
                                        <span className={getTypeColor(transaction.transaction_type)}>
                                            {transaction.transaction_type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-5 text-sm text-gray-900">
                                        <div className="space-y-1">
                                            {transaction.items && transaction.items.length > 0 ? (
                                                transaction.items.map((item, idx) => (
                                                    <div key={idx} className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium">{item.item_name}</span>
                                                            <span className="text-xs text-gray-500">
                                                                ({Math.abs(item.quantity_change)} 
                                                                {item.quantity_change > 0 ? ' received' : ' sold'})
                                                            </span>
                                                        </div>
                                                        {item.batch_number && (
                                                            <div className="text-xs text-blue-600">
                                                                Batch: {item.batch_number}
                                                                {item.cost_price && (
                                                                    <span className="ml-2">
                                                                        Cost: ₱{Number(item.cost_price).toFixed(2)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <span className="text-gray-500">No items found</span>
                                            )}
                                            {transaction.items && transaction.items.length > 1 && (
                                                <div className="text-xs text-blue-600 mt-1">
                                                    +{transaction.items.length - 1} more item{transaction.items.length > 2 ? 's' : ''}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-5 whitespace-nowrap text-sm text-gray-900">
                                        {transaction.customer_name || transaction.brand_name || '-'}
                                    </td>
                                    <td className="px-4 py-5 whitespace-nowrap text-sm text-gray-900">
                                        {transaction.reference_number || '-'}
                                    </td>
                                    {transactionType === 'pending' && (
                                        <td className="px-4 py-5 whitespace-nowrap text-sm text-gray-900">
                                            {transaction.due_date ? formatDate(transaction.due_date) : '-'}
                                        </td>
                                    )}
                                    <td className="px-4 py-5 whitespace-nowrap">
                                        <span className={getStatusBadge(transaction.transaction_status, transaction.priority_status, transaction.due_date)}>
                                            {getStatusText(transaction.transaction_status, transaction.priority_status, transaction.due_date)}
                                        </span>
                                    </td>
                                </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {isFetchingNextPage && (
                        <div className="p-4 text-center border-t border-[#EBEAEA]">
                            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite] text-gray-400"></div>
                        </div>
                    )}
                </div>
            </div>

            {/* Transaction Details Modal */}
            <TransactionDetailsModal 
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                transactionId={selectedTransactionId}
                onTransactionUpdate={handleTransactionUpdate}
                userList={userList}
            />
        </>
    );
};

export default TransactionTable;