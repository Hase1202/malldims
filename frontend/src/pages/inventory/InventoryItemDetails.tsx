import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { itemsApi, usersApi } from '../../lib/api';
import { ArrowLeft, Pencil, Package, History } from 'lucide-react';
import Sidebar from '../../components/common/Sidebar';
import EditInventoryItem from './EditInventoryItem';
import TransactionDetailsModal from '../../components/features/Transactions/TransactionDetailsModal';
import type { Item, InventoryChange } from '../../types/inventory';
import { useAuthContext } from '../../context/AuthContext';
import { isSales } from '../../utils/permissions';
import { User } from '../../lib/api';

export default function InventoryItemDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [showEditModal, setShowEditModal] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showTransactionModal, setShowTransactionModal] = useState(false);
    const [selectedTransactionId, setSelectedTransactionId] = useState<number | null>(null);
    const [userList, setUserList] = useState<User[]>([]);
    const { user } = useAuthContext();

    // Debug logging
    useEffect(() => {
        console.log('InventoryItemDetails mounted with ID:', id);
        console.log('Edit modal state:', showEditModal);
    }, [id, showEditModal]);

    // Fetch users list for transaction modal
    useEffect(() => {
        usersApi.getAll().then(res => {
            if (res.status === 'success' && res.data) setUserList(res.data);
        });
    }, []);

    // Transaction modal handlers
    const handleTransactionClick = (transactionId: number) => {
        setSelectedTransactionId(transactionId);
        setShowTransactionModal(true);
    };

    const handleCloseTransactionModal = () => {
        setShowTransactionModal(false);
        setSelectedTransactionId(null);
    };

    // Fetch item details with better error handling
    const { data: item, isLoading, error } = useQuery({
        queryKey: ['item', id],
        queryFn: async () => {
            if (!id) {
                throw new Error('No item ID provided');
            }
            
            console.log('Fetching item details for ID:', id);
            const response = await itemsApi.getById(id.toString());
            
            console.log('Item API response:', response);
            
            if (response.status === 'error' || !response.data) {
                throw new Error(response.message || 'Failed to fetch item details');
            }
            
            return response.data as Item;
        },
        enabled: !!id,
        retry: 3,
        retryDelay: 1000
    });

    // Fetch transaction history with error handling
    const { data: history, isLoading: isHistoryLoading } = useQuery({
        queryKey: ['item-history', id],
        queryFn: async () => {
            if (!id) throw new Error('No item ID provided');
            
            console.log('Fetching history for item ID:', id);
            
            try {
                const response = await itemsApi.getHistory(id);
                console.log('History API response:', response);
                
                if (response.status === 'error') {
                    // Don't throw error for history - just return empty array
                    console.warn('History fetch failed:', response.message);
                    return [];
                }
                
                return response.data as InventoryChange[] || [];
            } catch (error) {
                console.error('History fetch error:', error);
                return []; // Return empty array instead of throwing
            }
        },
        enabled: !!id
    });

    // Handle edit button click
    const handleEditClick = () => {
        console.log('Edit button clicked, opening modal...');
        setShowEditModal(true);
    };

    // Handle modal close
    const handleEditModalClose = () => {
        console.log('Closing edit modal...');
        setShowEditModal(false);
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="flex flex-col lg:flex-row min-h-screen overflow-hidden">
                <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
                <div className="flex-1 bg-[#F9F9F9] overflow-y-auto lg:ml-64">
                    <div className="p-8">
                        <div className="animate-pulse">
                            <div className="h-8 bg-gray-200 rounded w-32 mb-8"></div>
                            <div className="bg-white rounded-2xl border-[1.5px] border-[#EBEAEA] p-8">
                                <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
                                <div className="h-4 bg-gray-200 rounded w-32 mb-8"></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="h-24 bg-gray-200 rounded"></div>
                                    <div className="h-24 bg-gray-200 rounded"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="flex flex-col lg:flex-row min-h-screen overflow-hidden">
                <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
                <div className="flex-1 bg-[#F9F9F9] overflow-y-auto lg:ml-64">
                    <div className="p-8">
                        <button
                            onClick={() => navigate(-1)}
                            className="flex items-center gap-2 cursor-pointer text-sm text-[#646464] hover:text-[#3d3d3d] mb-8"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Go back
                        </button>
                        <div className="bg-white rounded-2xl border-[1.5px] border-[#EBEAEA] p-8">
                            <div className="text-center">
                                <h1 className="text-xl font-medium text-red-600 mb-4">Error Loading Item</h1>
                                <p className="text-gray-600 mb-4">
                                    {error instanceof Error ? error.message : 'Failed to load item details'}
                                </p>
                                <button
                                    onClick={() => navigate('/inventory')}
                                    className="bg-[#0504AA] text-white px-4 py-2 rounded-lg hover:bg-[#0504AA]/90"
                                >
                                    Back to Inventory
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!item) {
        return (
            <div className="flex flex-col lg:flex-row min-h-screen overflow-hidden">
                <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
                <div className="flex-1 bg-[#F9F9F9] overflow-y-auto lg:ml-64">
                    <div className="p-8">
                        <div className="text-center">Item not found</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col lg:flex-row min-h-screen overflow-hidden">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <div className="flex-1 bg-[#F9F9F9] overflow-y-auto lg:ml-64">
                <div className="p-8">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 cursor-pointer text-sm text-[#646464] hover:text-[#3d3d3d] mb-8"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Go back
                    </button>

                    <div className="bg-white rounded-2xl border-[1.5px] border-[#EBEAEA] p-8">
                        {/* Header */}
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h1 className="text-2xl font-medium text-[#2C2C2C]">
                                    {item.item_name}
                                </h1>
                                <p className="text-sm text-[#646464] mt-1">
                                    {item.model_number}
                                </p>
                            </div>
                            {!isSales(user) && (
                                <button
                                    onClick={handleEditClick}
                                    className="flex items-center cursor-pointer gap-2 text-[#0504AA] hover:underline"
                                >
                                    <Pencil className="h-4 w-4" />
                                    Edit Details
                                </button>
                            )}
                        </div>

                        {/* Current Stock and Threshold Value */}
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="p-6 rounded-xl border-[1.5px] border-[#EBEAEA]">
                                <p className="text-sm text-[#646464] mb-2">Current Stock</p>
                                <p className="text-3xl font-semibold text-[#2C2C2C]">{item.quantity}</p>
                            </div>
                            <div className="p-6 rounded-xl border-[1.5px] border-[#EBEAEA]">
                                <p className="text-sm text-[#646464] mb-2">Threshold Value</p>
                                <p className="text-3xl font-semibold text-[#2C2C2C]">{item.threshold_value}</p>
                            </div>
                        </div>

                        {/* Item Details */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                            <div>
                                <p className="text-sm text-[#646464] mb-1">Type</p>
                                <p className="text-[#2C2C2C] font-medium">{item.item_type}</p>
                            </div>
                            <div>
                                <p className="text-sm text-[#646464] mb-1">Category</p>
                                <p className="text-[#2C2C2C] font-medium">{item.category}</p>
                            </div>
                            <div>
                                <p className="text-sm text-[#646464] mb-1">Brand</p>
                                <p className="text-[#2C2C2C] font-medium">
                                    {'brand_name' in item 
                                        ? (item as any).brand_name 
                                        : typeof (item as any).brand === 'string' 
                                            ? (item as any).brand 
                                            : 'N/A'}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-[#646464] mb-1">Availability</p>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                    item.availability_status === 'In Stock' ? 'bg-green-100 text-green-800' :
                                    item.availability_status === 'Low Stock' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                }`}>
                                    {item.availability_status}
                                </span>
                            </div>
                        </div>

                        {/* Transaction History */}
                        <div className="mt-8">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[#2C2C2C]">
                                <History className="h-5 w-5 text-[#0504AA]" />
                                Transaction History
                            </h2>
                            
                            {isHistoryLoading ? (
                                <div className="text-[#646464] py-4">Loading history...</div>
                            ) : history && history.length > 0 ? (
                                <div className="space-y-4">
                                    {history.slice(0, 5).map((h: any, idx) => (
                                        <div 
                                            key={idx} 
                                            className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                                                h.transaction?.transaction_id 
                                                    ? 'hover:bg-gray-50 cursor-pointer hover:border-blue-300' 
                                                    : 'bg-gray-50'
                                            }`}
                                            onClick={() => {
                                                if (h.transaction?.transaction_id) {
                                                    handleTransactionClick(h.transaction.transaction_id);
                                                }
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Package className="h-5 w-5 text-[#0504AA]" />
                                                <div>
                                                    <p className="font-medium text-[#2C2C2C]">
                                                        {h.transaction?.transaction_type || h.change_type || 'Inventory Change'}
                                                    </p>
                                                    <p className="text-sm text-[#646464]">
                                                        Quantity change: {h.quantity_change > 0 ? '+' : ''}{h.quantity_change}
                                                        {h.transaction?.reference_number && ` • Ref: ${h.transaction.reference_number}`}
                                                        {h.batch?.batch_number && ` • Batch: ${h.batch.batch_number}`}
                                                    </p>
                                                    {h.unit_price > 0 && (
                                                        <p className="text-xs text-[#646464]">
                                                            Unit Price: ₱{h.unit_price} • Total: ₱{h.total_price}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm text-[#646464]">
                                                    {h.created_at ? new Date(h.created_at).toLocaleDateString() : 'N/A'}
                                                </p>
                                                {h.transaction?.transaction_status && (
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                        h.transaction.transaction_status === 'Completed' ? 'bg-green-100 text-green-800' :
                                                        h.transaction.transaction_status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-red-100 text-red-800'
                                                    }`}>
                                                        {h.transaction.transaction_status}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                    {history.length > 5 && (
                                        <div className="text-center py-2">
                                            <p className="text-sm text-[#646464]">
                                                Showing 5 of {history.length} transactions
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-[#646464] py-4">No transaction history found for this item.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Edit Modal - Make sure this renders */}
            {showEditModal && id && (
                <EditInventoryItem
                    itemId={id}
                    onClose={handleEditModalClose}
                />
            )}

            {/* Transaction Details Modal */}
            <TransactionDetailsModal 
                isOpen={showTransactionModal}
                onClose={handleCloseTransactionModal}
                transactionId={selectedTransactionId}
                userList={userList}
            />
        </div>
    );
}