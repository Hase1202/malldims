import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { itemsApi, usersApi } from '../../lib/api';
import api from '../../lib/api';
import { ArrowLeft, Pencil, Package, History } from 'lucide-react';
import Sidebar from '../../components/common/Sidebar';
import EditInventoryItem from './EditInventoryItem';
import TransactionDetailsModal from '../../components/features/Transactions/TransactionDetailsModal';
import SpecialPricingComponent from '../../components/features/Inventory/SpecialPricingComponent';
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

    // Fetch batches for this item
    const { data: batches } = useQuery({
        queryKey: ['item-batches', id],
        queryFn: async () => {
            if (!id) throw new Error('No item ID provided');
            
            try {
                const response = await api.get(`/inventory-batches/?item_id=${id}`);
                return response.data.results || response.data || [];
            } catch (error) {
                console.error('Batches fetch error:', error);
                return [];
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
                                {item.sku && (
                                    <p className="text-sm text-[#646464] mt-1">
                                        SKU: {item.sku}
                                    </p>
                                )}
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

                        {/* Current Stock */}
                        <div className="grid grid-cols-1 gap-4 mb-8">
                            <div className="p-6 rounded-xl border-[1.5px] border-[#EBEAEA]">
                                <p className="text-sm text-[#646464] mb-2">Current Stock</p>
                                <p className="text-3xl font-semibold text-[#2C2C2C]">{item.quantity}</p>
                            </div>
                        </div>

                        {/* Item Details */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-6 mb-8">
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
                                <p className="text-sm text-[#646464] mb-1">Unit of Measure</p>
                                <p className="text-[#2C2C2C] font-medium">{item.uom}</p>
                            </div>
                        </div>

                        {/* Batch Information */}
                        <div className="mb-8">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold flex items-center gap-2 text-[#2C2C2C]">
                                    <Package className="h-5 w-5 text-[#0504AA]" />
                                    Inventory Batches
                                </h2>
                                {batches && batches.length > 0 && (
                                    <button
                                        onClick={() => navigate(`/inventory/${id}/batches`)}
                                        className="text-sm text-[#0504AA] hover:underline"
                                    >
                                        View All Batches
                                    </button>
                                )}
                            </div>
                            
                            {batches && batches.length > 0 ? (
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Batch</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Available</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost Price</th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {batches.slice(0, 3).map((batch: any, index: number) => (
                                                <tr key={batch.batch_id || `batch-${index}`} className="hover:bg-gray-50 cursor-pointer"
                                                    onClick={() => navigate(`/inventory/${id}/batches`)}>
                                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                                        Batch {batch.batch_number}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-900">
                                                        {batch.quantity_available || batch.remaining_quantity}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-900">
                                                        ₱{batch.cost_price ? Number(batch.cost_price).toFixed(2) : '0.00'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-500">
                                                        {new Date(batch.created_at).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {batches.length > 3 && (
                                        <div className="bg-gray-50 px-4 py-3 text-center">
                                            <button
                                                onClick={() => navigate(`/inventory/${id}/batches`)}
                                                className="text-sm text-[#0504AA] hover:underline"
                                            >
                                                View {batches.length - 3} more batches
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="p-4 border rounded-lg bg-gray-50">
                                    <p className="text-[#646464]">
                                        No batches found for this item. Batches are created when receiving inventory through transactions.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Transaction History and Special Pricing */}
                        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Transaction History */}
                            <div>
                                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[#2C2C2C]">
                                    <History className="h-5 w-5 text-[#0504AA]" />
                                    Transaction History
                                </h2>
                                
                                {isHistoryLoading ? (
                                    <div className="text-[#646464] py-4">Loading history...</div>
                                ) : history && history.length > 0 ? (
                                    <div className="space-y-4 max-h-96 overflow-y-auto">
                                        {history.slice(0, 5).map((h: any, idx) => (
                                            <div 
                                                key={h.transaction_id || `history-${idx}`} 
                                                className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                                                    h.transaction_id 
                                                        ? 'hover:bg-gray-50 cursor-pointer hover:border-blue-300' 
                                                        : 'bg-gray-50'
                                                }`}
                                                onClick={() => {
                                                    if (h.transaction_id) {
                                                        handleTransactionClick(h.transaction_id);
                                                    }
                                                }}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Package className="h-5 w-5 text-[#0504AA]" />
                                                    <div>
                                                        <p className="font-medium text-[#2C2C2C]">
                                                            {h.transaction_type || 'Inventory Change'}
                                                        </p>
                                                        <p className="text-sm text-[#646464]">
                                                            Quantity change: {h.quantity_change > 0 ? '+' : ''}{h.quantity_change}
                                                            {h.reference_number && ` • Ref: ${h.reference_number}`}
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

                            {/* Special Pricing */}
                            <SpecialPricingComponent itemId={id!} />
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