import { X, Clock, Package, User, FileText, ChevronRight } from 'lucide-react';
import { Transaction } from '../../../types/inventory';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { transactionsApi, itemsApi } from '../../../lib/api';
import Toast from '../../common/Toast';
import { useAuthContext } from '../../../context/AuthContext';
import { isSales, canCancelOwnPendingTransaction } from '../../../utils/permissions';
import { User as ApiUser } from '../../../lib/api';

interface TransactionDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactionId: number | null;
  onTransactionUpdate?: (message: string) => void;
  userList?: ApiUser[];
}

export default function TransactionDetailsModal({ isOpen, onClose, transactionId, onTransactionUpdate, userList = [] }: TransactionDetailsModalProps) {
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCompletingTransaction, setIsCompletingTransaction] = useState(false);
  const [isCancellingTransaction, setIsCancellingTransaction] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [insufficientStockItems, setInsufficientStockItems] = useState<Array<{
    item_id: number;
    item_name: string;
    current_stock: number;
    requested_quantity: number;
  }>>([]);
  const { user } = useAuthContext();

  useEffect(() => {
    console.log('TransactionDetailsModal useEffect:', { isOpen, transactionId });
    if (isOpen && transactionId) {
      fetchTransactionDetails(transactionId);
      // Reset toast state when opening a modal
      setShowToast(false);
      setToastMessage('');
    }
  }, [isOpen, transactionId]);

  // Add new effect to check stock when transaction data is loaded
  useEffect(() => {
    if (transaction?.transaction_status === 'Pending' && 
        transaction.transaction_type && 
        ['Dispatch goods', 'Reserve goods'].includes(transaction.transaction_type)) {
      checkStockAvailability();
    }
  }, [transaction]);

  // Check if all items are above threshold after transaction loads
  useEffect(() => {
    const checkAllItemsAboveThreshold = async () => {
      if (!transaction?.items || transaction.items.length === 0) {
        return;
      }
      for (const item of transaction.items) {
        const itemId = 'item_id' in item ? item.item_id : (typeof item.item === 'number' ? item.item : null);
        if (typeof itemId !== 'number') continue;
        const response = await itemsApi.getById(itemId.toString());
        if (response.status === 'success' && response.data) {
          if (response.data.quantity < response.data.threshold_value) {
            return;
          }
        }
      }
    };
    if (transaction?.items && transaction.items.length > 0) {
      checkAllItemsAboveThreshold();
    }
  }, [transaction]);

  const fetchTransactionDetails = async (id: number) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await transactionsApi.getById(id.toString());
      if (response.status === 'success' && response.data) {
        setTransaction(response.data);
      } else {
        setError('Failed to load transaction details');
      }
    } catch (error) {
      console.error('Error fetching transaction details:', error);
      setError('An error occurred while loading transaction details');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelTransaction = async () => {
    if (!transaction) return;
    setIsCancellingTransaction(true);
    setShowCancelDialog(false);
    setShowToast(false); // Reset any existing toast
    
    try {
      const response = await transactionsApi.cancel(transaction.transaction_id.toString());
      
      if (response.status === 'success') {
        // Update local transaction state to reflect cancellation
        setTransaction({
          ...transaction,
          transaction_status: 'Cancelled'
        });
        
        // Show toast and notify parent of update
        setToastMessage(response.message || 'Transaction cancelled successfully');
        setToastType('success');
        setShowToast(true);
        
        // Call the onTransactionUpdate callback to refresh the list
        if (onTransactionUpdate) {
          onTransactionUpdate(response.message || 'Transaction cancelled successfully');
        }
        // Close the modal after a short delay to allow user to see the toast
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        // If cancel fails, try delete as fallback
        try {
          const deleteResponse = await transactionsApi.delete(transaction.transaction_id.toString());
          if (deleteResponse.status === 'success') {
            setToastMessage('Transaction deleted successfully');
            setToastType('success');
            setShowToast(true);
            
            // Close the modal and notify parent of update
            setTimeout(() => {
              onClose();
              if (onTransactionUpdate) {
                onTransactionUpdate('Transaction deleted successfully');
              }
            }, 1000);
          }
        } catch (deleteError: any) {
          console.error('Delete error:', deleteError);
          // Check if the error is about non-pending transactions
          const errorMessage = deleteError instanceof Error ? deleteError.message : 'Failed to delete transaction';
          if (errorMessage.includes('Only pending transactions can be deleted')) {
            setToastMessage('Cannot delete: Only pending transactions can be deleted');
          } else {
            setToastMessage(errorMessage);
          }
          setToastType('error');
          setShowToast(true);
        }
      }
    } catch (error: any) {
      console.error('Cancel error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to cancel transaction';
      setToastMessage(errorMessage);
      setToastType('error');
      setShowToast(true);
    } finally {
      setIsCancellingTransaction(false);
    }
  };

  const checkStockAvailability = async () => {
    if (!transaction?.items) return false;
    
    const insufficientItems = [];
    
    for (const item of transaction.items) {
      const itemId = 'item_id' in item ? item.item_id : ('item' in item && typeof item.item === 'number' ? item.item : null);
      if (typeof itemId !== 'number') continue;
      
      const response = await itemsApi.getById(itemId.toString());
      if (response.status === 'success' && response.data) {
        const currentStock = response.data.quantity;
        if (currentStock < Math.abs(item.quantity_change)) {
          insufficientItems.push({
            item_id: itemId,
            item_name: item.item_name,
            current_stock: currentStock,
            requested_quantity: Math.abs(item.quantity_change)
          });
        }
      }
    }
    
    setInsufficientStockItems(insufficientItems);
    return insufficientItems.length === 0;
  };

  const handleCompleteTransaction = async () => {
    if (!transaction) return;
    setIsCompletingTransaction(true);
    setError(null);
    
    try {
      const response = await transactionsApi.complete(transaction.transaction_id.toString());
      if (response.status === 'success') {
        // Update local transaction state to reflect completion
        setTransaction({
          ...transaction,
          transaction_status: 'Completed'
        });
        
        // Show toast and notify parent of update
        setToastMessage('Transaction completed successfully');
        setToastType('success');
        setShowToast(true);
        
        // Call the onTransactionUpdate callback to refresh the list
        if (onTransactionUpdate) {
          onTransactionUpdate('Transaction completed successfully');
        }
        
        // Close the modal after a delay to allow user to see the toast
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError('Failed to complete transaction');
        setToastMessage('Failed to complete transaction');
        setToastType('error');
        setShowToast(true);
      }
    } catch (error) {
      console.error('Error completing transaction:', error);
      setError('An error occurred while completing the transaction');
      setToastMessage('Failed to complete transaction');
      setToastType('error');
      setShowToast(true);
    } finally {
      setIsCompletingTransaction(false);
    }
  };

  const handleGenerateRequisitionList = async () => {
    if (!transaction?.items) return;

    // Only include items with insufficient stock
    const insufficientItems = transaction.items
      .filter(item => {
        const currentQty = item.final_quantity ?? 0;
        const reqQty = item.requested_quantity ?? Math.abs(item.quantity_change);
        return reqQty > currentQty;
      });

    // Fetch missing details for items that don't have model_number or brand_name
    const itemsWithDetails = await Promise.all(
      insufficientItems.map(async (item) => {
        // If model_number and brand_name are present, use as is
        if (item.model_number && item.brand_name) {
          return item;
        }
        // Otherwise, fetch from API
        const itemId = 'item_id' in item ? item.item_id : (typeof item.item === 'number' ? item.item : 0);
        if (!itemId) return item;
        try {
          const response = await itemsApi.getById(itemId.toString());
          if (response.status === 'success' && response.data) {
            return {
              ...item,
              model_number: response.data.model_number,
              brand_name: response.data.brand_name,
            };
          }
        } catch (e) {
          // Fallback: return item as is
        }
        return item;
      })
    );

    const items = itemsWithDetails.map(item => ({
      item_id: 'item_id' in item ? item.item_id : (typeof item.item === 'number' ? item.item : 0),
      item_name: item.item_name,
      model_number: item.model_number || '',
      brand_name: item.brand_name || '',
      quantity: item.final_quantity || 0,
      threshold_value: Math.abs(item.quantity_change),
      availability_status: 'Low Stock',
      priority: 'Urgent',
      requested_quantity: item.requested_quantity ?? Math.abs(item.quantity_change),
      due_date: transaction.due_date
    }));

    if (items.length === 0) {
      setToastMessage('No items need requisition');
      setToastType('info');
      setShowToast(true);
      return;
    }

    navigate('/alerts/generate-requisition', {
      state: { selectedItems: items }
    });
    onClose();
  };

  // Compute if there are any items that need requisition
  const hasInsufficientStockItemsForRequisition = !!transaction?.items?.some(item => {
    const currentQty = item.final_quantity ?? 0;
    const reqQty = item.requested_quantity ?? Math.abs(item.quantity_change);
    return reqQty > currentQty;
  });

  console.log('TransactionDetailsModal render:', { isOpen, transactionId, loading, transaction });
  
  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const formatTime = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).toUpperCase();
  };

  const handleNavigateToItem = (itemId: number, event: React.MouseEvent) => {
    event.stopPropagation();
    onClose();
    navigate(`/inventory/${itemId}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-[#ECFDF3] text-[#027A48] px-2.5 py-1 rounded-full text-xs font-medium';
      case 'cancelled':
        return 'bg-[#FEF3F2] text-[#B42318] px-2.5 py-1 rounded-full text-xs font-medium';
      default:
        return 'bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full text-xs font-medium';
    }
  };

  const getStatusText = (status: string, priorityStatus?: string, dueDate?: string) => {
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

  const getStatusColor = (status: string, priorityStatus?: string, dueDate?: string) => {
    if (status.toLowerCase() === 'pending') {
        // Check if overdue
        if (dueDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const dueDateObj = new Date(dueDate);
            if (dueDateObj < today) {
                return 'bg-red-50 text-red-600 px-2.5 py-1 rounded-full text-xs font-medium';
            }
        }
        
        // If not overdue, use priority status colors
        switch (priorityStatus?.toLowerCase()) {
            case 'critical':
                return 'bg-orange-50 text-orange-600 px-2.5 py-1 rounded-full text-xs font-medium';
            case 'urgent':
                return 'bg-amber-50 text-amber-600 px-2.5 py-1 rounded-full text-xs font-medium';
            case 'normal':
                return 'bg-yellow-50 text-yellow-600 px-2.5 py-1 rounded-full text-xs font-medium';
            default:
                return 'bg-yellow-50 text-yellow-600 px-2.5 py-1 rounded-full text-xs font-medium';
        }
    }
    
    return getStatusBadge(status);
  };

  const getTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'dispatch goods':
        return 'bg-[#FDF2FA] text-[#C11574] px-2.5 py-1 rounded-full text-xs font-medium';
      case 'receive goods':
        return 'bg-[#F4F3FF] text-[#5925DC] px-2.5 py-1 rounded-full text-xs font-medium';
      case 'return goods':
        return 'bg-[#F0F9FF] text-[#026AA2] px-2.5 py-1 rounded-full text-xs font-medium';
      case 'reserve goods':
        return 'bg-[#FEF3F2] text-[#B42318] px-2.5 py-1 rounded-full text-xs font-medium';
      case 'manual correction':
        return 'bg-[#F0FDF4] text-[#027A48] px-2.5 py-1 rounded-full text-xs font-medium';
      default:
        return 'text-gray-900';
    }
  };

  const formatNotes = (notes: string | undefined | null) => {
    if (!notes) return 'No notes available';
    // Split notes into regular notes and transaction info
    const [regularNotes, ...transactionInfo] = notes.split('---');
    // Helper to replace username with full name if available
    const replaceWithFullName = (line: string) => {
      const reservedMatch = line.match(/Reserved by: (\w+)/);
      const dispatchedMatch = line.match(/Dispatched by: (\w+)/);
      if (reservedMatch) {
        const username = reservedMatch[1];
        const user = userList.find(u => u.username === username);
        if (user) {
          const name = (user.first_name || user.last_name) ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : user.username;
          return line.replace(`Reserved by: ${username}`, `Reserved by: ${name}`);
        }
      }
      if (dispatchedMatch) {
        const username = dispatchedMatch[1];
        const user = userList.find(u => u.username === username);
        if (user) {
          const name = (user.first_name || user.last_name) ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : user.username;
          return line.replace(`Dispatched by: ${username}`, `Dispatched by: ${name}`);
        }
      }
      return line;
    };
    return (
      <div className="space-y-2">
        {/* Regular notes */}
        <div>{regularNotes.trim() || 'No additional notes'}</div>
        {/* Transaction info (if exists) */}
        {transactionInfo.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#EBEAEA]">
            {transactionInfo[0].split('\n').map((line, index) => (
              <div key={index} className="text-sm text-[#646464] leading-relaxed">
                {replaceWithFullName(line.trim())}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Add helper function to get user's full name
  const getUserFullName = (username: string | undefined) => {
    if (!username) return '-';
    const user = userList.find(u => u.username === username);
    if (user) {
      const name = (user.first_name || user.last_name) ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : user.username;
      return name;
    }
    return username;
  };

  return (
    <>
      {/* Main Modal */}
      <div 
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="bg-white rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
          {/* Modal Header */}
          <div className="flex justify-between items-center p-6 border-b border-[#EBEAEA]">
            <h2 className="text-xl font-semibold text-[#2C2C2C]">Transaction Details</h2>
            <button 
              onClick={onClose}
              className="text-[#646464] hover:text-[#2C2C2C] transition-colors"
            >
              <X className="h-4 w-4 cursor-pointer" />
            </button>
          </div>

          {loading ? (
            <div className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          ) : error ? (
            <div className="p-6 text-[#D3465C]">{error}</div>
          ) : transaction ? (
            <div>
              {/* Status and Total Items */}
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#FCFBFC] rounded-lg p-4 border border-[#EBEAEA]">
                    <div className="text-sm text-[#646464] mb-1.5">Status</div>
                    <span className={getStatusColor(transaction.transaction_status, transaction.priority_status, transaction.due_date)}>
                      {getStatusText(transaction.transaction_status, transaction.priority_status, transaction.due_date)}
                    </span>
                  </div>
                  <div className="bg-[#FCFBFC] rounded-lg p-4 border border-[#EBEAEA]">
                    <div className="text-sm text-[#646464] mb-1.5">Total Items</div>
                    <div className="font-medium text-[#2C2C2C]">{transaction.items?.length || 0}</div>
                  </div>
                </div>

                {/* Transaction Details */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Clock className="h-5 w-5 text-[#0504AA]" />
                    <h3 className="font-medium text-[#2C2C2C]">Transaction Details</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-x-4 gap-y-6 ml-7">
                    <div>
                      <div className="text-sm text-[#646464] mb-1.5">Date</div>
                      <div className="text-sm text-[#2C2C2C]">{formatDate(transaction.transacted_date)}</div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-[#646464] mb-1.5">Type</div>
                      <span className={getTypeColor(transaction.transaction_type)}>
                        {transaction.transaction_type}
                      </span>
                    </div>
                    
                    <div>
                      <div className="text-sm text-[#646464] mb-1.5">Reference No.</div>
                      <div className="text-sm text-[#2C2C2C]">{transaction.reference_number || '-'}</div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-[#646464] mb-1.5">Created At</div>
                      <div className="text-sm text-[#2C2C2C]">
                        {formatDate(transaction.created_at)} {formatTime(transaction.created_at)}
                      </div>
                    </div>
                    {/* Show Due Date for pending transactions */}
                    {transaction.transaction_status === 'Pending' && transaction.due_date && (
                      <div>
                        <div className="text-sm text-[#646464] mb-1.5">Due Date</div>
                        <div className="text-sm text-[#2C2C2C]">{formatDate(transaction.due_date)}</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Package className="h-5 w-5 text-[#0504AA]" />
                    <h3 className="font-medium text-[#2C2C2C]">Items</h3>
                  </div>
                  
                  <div className="space-y-2 ml-7">
                    {transaction.items?.map((item, index) => (
                      <div 
                        key={index} 
                        className="flex items-center justify-between p-4 border border-[#EBEAEA] rounded-lg cursor-pointer transition-colors group hover:bg-gray-50"
                        onClick={(e) => {
                          const id = 'item_id' in item ? item.item_id : ('item' in item ? item.item : null);
                          if (id && typeof id === 'number') handleNavigateToItem(id, e);
                        }}
                      >
                        <div>
                          <div className="font-medium text-[#2C2C2C] mb-1">{item.item_name}</div>
                          <div className="text-sm text-[#646464]">Current Stock: {item.current_stock ?? 0}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className={`text-sm font-medium ${
                            transaction.transaction_type === 'Manual correction' 
                              ? item.quantity_change > 0 ? 'text-[#027A48]' : 'text-[#B42318]'
                              : ['Receive Products', 'Receive goods', 'Return goods'].includes(transaction.transaction_type)
                                ? 'text-[#027A48]' 
                                : 'text-[#B42318]'
                          }`}>
                            {transaction.transaction_type === 'Manual correction' 
                              ? (item.quantity_change > 0 ? '+' : '') + item.quantity_change
                              : (['Receive Products', 'Receive goods', 'Return goods'].includes(transaction.transaction_type)) 
                                ? '+' + Math.abs(item.quantity_change)
                                : '-' + Math.abs(item.quantity_change)
                            }
                          </div>
                          <ChevronRight className="h-4 w-4 text-[#646464] opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* People */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <User className="h-5 w-5 text-[#0504AA]" />
                    <h3 className="font-medium text-[#2C2C2C]">People</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-x-4 ml-7">
                    {transaction.transaction_type !== 'Manual correction' && (
                      <div>
                        <div className="text-sm text-[#646464] mb-1.5">Customer/Brand</div>
                        <div className="text-sm text-[#2C2C2C]">{transaction.customer_name || transaction.brand_name || '-'}</div>
                      </div>
                    )}
                    
                    <div className={transaction.transaction_type === 'Manual correction' ? 'col-span-2' : ''}>
                      <div className="text-sm text-[#646464] mb-1.5">Processed By</div>
                      <div className="text-sm text-[#2C2C2C]">{getUserFullName(transaction.created_by)}</div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="h-5 w-5 text-[#0504AA]" />
                    <h3 className="font-medium text-[#2C2C2C]">Notes</h3>
                  </div>
                  <div className="text-sm text-[#2C2C2C] ml-7">
                    {formatNotes(transaction.notes)}
                  </div>
                </div>
              </div>

              {/* Action buttons for pending transactions */}
              {transaction.transaction_status === 'Pending' && (
                <div className="px-6 py-4 border-t border-[#EBEAEA] flex flex-col gap-2">
                  {/* Only non-sales users see Complete/Generate buttons */}
                  {!isSales(user) && <>
                    <button 
                      onClick={handleCompleteTransaction}
                      disabled={isCompletingTransaction || insufficientStockItems.length > 0}
                      className="w-full px-4 py-2 text-sm font-medium cursor-pointer text-white bg-[#0504AA] rounded-lg hover:bg-[#0504AA]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCompletingTransaction ? 'Processing...' : insufficientStockItems.length > 0 ? 'Insufficient Stock' : 'Complete Transaction'}
                    </button>
                    <button 
                      onClick={handleGenerateRequisitionList}
                      disabled={!hasInsufficientStockItemsForRequisition}
                      className={
                        `w-full cursor-pointer px-4 py-2 text-sm font-medium text-white bg-[#0504AA]/90 rounded-lg hover:bg-[#0504AA]/80 transition-colors ` +
                        (!hasInsufficientStockItemsForRequisition ? 'opacity-50 disabled:cursor-not-allowed' : '')
                      }
                    >
                      Generate Requisition List
                    </button>
                  </>}
                  {/* Sales (and others with permission) see Cancel button if allowed */}
                  {canCancelOwnPendingTransaction(user, transaction) && (
                    <button 
                      onClick={() => setShowCancelDialog(true)}
                      className="w-full cursor-pointer px-4 py-2 text-sm font-medium text-[#2C2C2C] bg-white border border-[#EBEAEA] rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel Transaction
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 text-[#646464]">No transaction details available</div>
          )}
        </div>
      </div>

      {/* Cancel Transaction Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h2 className="text-xl font-semibold text-[#2C2C2C] mb-2">Cancel pending transaction</h2>
            <p className="text-[#646464] mb-6">Are you sure you want to cancel this pending transaction? This action cannot be undone.</p>
            
            <div className="flex flex-col gap-2">
              <button
                onClick={handleCancelTransaction}
                disabled={isCancellingTransaction}
                className="w-full cursor-pointer px-4 py-2 text-sm font-medium text-[#2C2C2C] bg-white border border-[#EBEAEA] rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCancellingTransaction ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
              <button
                onClick={() => {
                  setShowCancelDialog(false);
                  setError(null);
                  setShowToast(false);
                }}
                className="w-full cursor-pointerpx-4 py-2 text-sm font-medium text-[#2C2C2C] bg-white border border-[#EBEAEA] rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {showToast && (
        <Toast
          title={toastMessage}
          type={toastType}
          duration={3000}
          isVisible={showToast}
          onClose={() => setShowToast(false)}
        />
      )}
    </>
  );
}