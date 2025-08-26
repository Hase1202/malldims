import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Item } from '../../../types/inventory';
import { itemsApi, transactionsApi } from '../../../lib/api';
import Toast from '../../common/Toast';
import { useAuthContext } from '../../../context/AuthContext';
import { isSales } from '../../../utils/permissions';

interface InventoryAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item | null;
  onAdjustment?: (message: string, updatedItem?: Item) => void;
}

const InventoryAdjustmentModal: React.FC<InventoryAdjustmentModalProps> = ({
  isOpen,
  onClose,
  item,
  onAdjustment
}) => {
  const [quantity, setQuantity] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  
  const { user } = useAuthContext();
  if (isSales(user)) return null;
  
  // Reset form when the modal opens with a new item
  useEffect(() => {
    if (isOpen && item) {
      setQuantity(item.quantity);
      setNotes('');
      setError(null);
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Calculate the quantity change (difference from current quantity)
      const quantityChange = quantity - item.quantity;
      
      if (quantityChange === 0) {
        setError('No quantity change detected. Please adjust the quantity.');
        setIsLoading(false);
        return;
      }

      // Create the transaction data
      const transactionData = {
        transaction_type: 'Manual correction' as const,
        transaction_status: 'Completed' as const,
        reference_number: 'ADJ-01', // This will be replaced by the backend
        notes: notes || 'Inventory quantity adjustment',
        items: [
          {
            item: item.item_id,
            quantity_change: quantityChange, // This can be positive or negative
          }
        ]
      };

      // Make the API call
      const response = await transactionsApi.create(transactionData);

      if (response.status === 'success') {
        // Get updated item data
        const updatedItemResponse = await itemsApi.getById(item.item_id.toString());
        
        // Create success message
        const successMessage = `Quantity for ${item.item_name} has been adjusted to ${quantity}`;
        
        // Set these for compatibility but don't display the toast
        setToastMessage(successMessage);
        setToastType('success');
        
        // Close the modal immediately
        onClose();
        
        // Call the onAdjustment callback if provided
        if (onAdjustment && updatedItemResponse.status === 'success') {
          // Pass both message and updated item to callback
          onAdjustment(successMessage, updatedItemResponse.data);
        } else if (onAdjustment) {
          // If we couldn't get updated item, just pass message
          onAdjustment(successMessage);
        }
      } else {
        setError(response.message || 'Failed to adjust inventory');
        setToastMessage(response.message || 'Failed to adjust inventory');
        setToastType('error');
      }
    } catch (error: any) {
      console.error('Error adjusting inventory:', error);
      
      // Extract error message
      let errorMessage = 'An error occurred while processing your request.';
      
      if (error?.data) {
        const errorData = error.data;
        
        if (typeof errorData === 'object') {
          const errors: string[] = [];
          
          // Handle non-field errors
          if (Array.isArray(errorData.non_field_errors)) {
            errors.push(...errorData.non_field_errors);
          }
          
          // Handle detail message
          if (typeof errorData.detail === 'string') {
            errors.push(errorData.detail);
          }
          
          // Handle field-specific errors
          Object.entries(errorData).forEach(([field, messages]) => {
            if (field !== 'non_field_errors' && field !== 'detail') {
              if (Array.isArray(messages)) {
                errors.push(`${field}: ${messages.join(', ')}`);
              } else if (typeof messages === 'string') {
                errors.push(`${field}: ${messages}`);
              }
            }
          });
          
          if (errors.length > 0) {
            errorMessage = errors.join('; ');
          }
        } else if (typeof errorData.message === 'string') {
          errorMessage = errorData.message;
        }
      }
      
      setError(errorMessage);
      setToastMessage(errorMessage);
      setToastType('error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50 p-4">
      <div 
        className="bg-white rounded-xl shadow-lg max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-[#EBEAEA]">
          <h2 className="text-lg font-medium text-[#2C2C2C]">Adjust Inventory Quantity</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <h3 className="font-medium text-[#2C2C2C] mb-1">{item.item_name}</h3>
          <p className="text-sm text-gray-500 mb-6">Model: {item.model_number}</p>

          {error && (
            <div className="bg-red-50 border-l-4 border-[#D3465C] p-4 mb-6">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-[#D3465C]" />
                <p className="text-[#D3465C]">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm mb-2 text-[#2C2C2C]">
                Quantity <span className="text-[#2C2C2C]/50">*</span>
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-grow flex rounded-lg border-[1.5px] border-[#D5D7DA] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setQuantity((prev) => Math.max(0, prev - 1))}
                    className="px-3 py-2 cursor-pointer border-r border-[#D5D7DA] hover:bg-gray-100"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                    className="flex-grow p-2 text-center focus:outline-none"
                    min="0"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity((prev) => prev + 1)}
                    className="px-3 py-2 cursor-pointer border-l border-[#D5D7DA] hover:bg-gray-100"
                  >
                    +
                  </button>
                </div>
              </div>
              <p className="text-xs mt-1 text-gray-500">Current quantity: {item.quantity}</p>
            </div>

            <div>
              <label className="block text-sm mb-2 text-[#2C2C2C]">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2.5 border-[1.5px] border-[#D5D7DA] rounded-lg min-h-[120px] placeholder-black/40"
                placeholder="Add reason for adjustment or any additional context..."
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 cursor-pointer rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || quantity === item.quantity}
                className="px-4 py-2 bg-[#0504AA] cursor-pointer text-white rounded-lg hover:bg-[#0504AA]/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Keep this component but hide it - never actually show it */}
      <Toast
        title={toastMessage}
        type={toastType}
        duration={3000}
        isVisible={false} // Always false to never display it
        onClose={() => {}} // Empty function since we never show the toast
      />
    </div>
  );
};

export default InventoryAdjustmentModal; 