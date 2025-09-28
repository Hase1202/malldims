import { useState, useEffect } from 'react';
import { X, AlertCircle, Package } from 'lucide-react';
import { Item } from '../../../types/inventory';
import { itemsApi, transactionsApi } from '../../../lib/api';
import api from '../../../lib/api';
import Toast from '../../common/Toast';
import { useAuthContext } from '../../../context/AuthContext';
import { isSales } from '../../../utils/permissions';

interface InventoryAdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: Item | null;
  onAdjustment?: (message: string, updatedItem?: Item) => void;
}

interface BatchOption {
  batch_id: number;
  batch_number: number;
  remaining_quantity: number;
  cost_price: number;
  created_at: string;
}

const InventoryAdjustmentModal: React.FC<InventoryAdjustmentModalProps> = ({
  isOpen,
  onClose,
  item,
  onAdjustment
}) => {
  const [step, setStep] = useState<'select-batch' | 'adjust-quantity'>('select-batch');
  const [selectedBatch, setSelectedBatch] = useState<BatchOption | null>(null);
  const [availableBatches, setAvailableBatches] = useState<BatchOption[]>([]);
  const [formData, setFormData] = useState({
    newQuantity: '',
    notes: ''
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isFetchingBatches, setIsFetchingBatches] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  
  const { user } = useAuthContext();
  if (isSales(user)) return null;
  
  // Fetch available batches when modal opens
  useEffect(() => {
    if (isOpen && item) {
      setStep('select-batch');
      setSelectedBatch(null);
      setFormData({
        newQuantity: '',
        notes: ''
      });
      setError(null);
      fetchBatches();
    }
  }, [isOpen, item]);

  const fetchBatches = async () => {
    if (!item) return;
    
    setIsFetchingBatches(true);
    try {
      const response = await api.get(`/inventory-batches/?item_id=${item.item_id}`);
      const batchData = response.data.results || response.data || [];
      
      // Filter only batches with remaining quantity > 0
      const availableBatchesData = batchData.filter((batch: any) => 
        (batch.remaining_quantity || batch.quantity_available) > 0
      );
      
      setAvailableBatches(availableBatchesData);
    } catch (error) {
      console.error('Error fetching batches:', error);
      setError('Failed to load available batches.');
    } finally {
      setIsFetchingBatches(false);
    }
  };

  const handleBatchSelect = (batch: BatchOption) => {
    setSelectedBatch(batch);
    setFormData({
      newQuantity: (batch.remaining_quantity || 0).toString(),
      notes: ''
    });
    setStep('adjust-quantity');
    setError(null);
  };

  const handleBackToBatchSelection = () => {
    setStep('select-batch');
    setSelectedBatch(null);
    setFormData({
      newQuantity: '',
      notes: ''
    });
    setError(null);
  };

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) {
      setError('Please select a batch first.');
      return;
    }
    
    setIsLoading(true);
    setError(null);

    try {
      const newQuantity = parseInt(formData.newQuantity);
      
      if (isNaN(newQuantity) || newQuantity < 0 || !Number.isInteger(newQuantity)) {
        setError('Please enter a valid whole number (0 or greater).');
        setIsLoading(false);
        return;
      }

      // Calculate the quantity change (difference from current batch quantity)
      const currentBatchQuantity = selectedBatch.remaining_quantity || 0;
      const quantityChange = newQuantity - currentBatchQuantity;
      
      if (quantityChange === 0) {
        setError('No quantity change detected. Please adjust the quantity.');
        setIsLoading(false);
        return;
      }

      // Create the transaction data for batch adjustment
      const transactionData = {
        transaction_type: 'ADJUSTMENT' as const,
        brand: item?.brand,
        reference_number: `ADJ-BATCH-${selectedBatch.batch_number}`, 
        notes: formData.notes || `Batch ${selectedBatch.batch_number} quantity adjustment`,
        items: [
          {
            item: item?.item_id,
            batch_id: selectedBatch.batch_id,
            quantity_change: quantityChange,
          }
        ]
      };
      // Make the API call
      const response = await transactionsApi.create(transactionData);

      if (response.status === 'success') {
        // Get updated item data
        const updatedItemResponse = await itemsApi.getById(item!.item_id.toString());
        
        // Create success message
        const successMessage = `Batch ${selectedBatch.batch_number} for ${item!.item_name} has been adjusted to ${newQuantity}`;
        
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
          <h2 className="text-lg font-medium text-[#2C2C2C]">
            {step === 'select-batch' ? 'Select Batch to Adjust' : 'Adjust Batch Quantity'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {step === 'select-batch' ? (
            // Step 1: Batch Selection
            <div className="space-y-4">
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Item Information</h3>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm"><strong>{item?.item_name}</strong></p>
                  <p className="text-xs text-gray-600">
                    SKU: {item?.sku || 'No SKU'} • Brand: {item?.brand_name || 'N/A'}
                  </p>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border-l-4 border-[#D3465C] p-4 mb-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-[#D3465C]" />
                    <p className="text-[#D3465C]">{error}</p>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">
                  Available Batches {isFetchingBatches && <span className="text-xs text-gray-500">(Loading...)</span>}
                </h3>
                
                {isFetchingBatches ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0504AA] mx-auto"></div>
                  </div>
                ) : availableBatches.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {availableBatches.map((batch, index) => (
                      <div
                        key={batch.batch_id || `batch-${index}`}
                        onClick={() => handleBatchSelect(batch)}
                        className="border border-gray-200 rounded-lg p-3 hover:border-[#0504AA] hover:bg-blue-50 cursor-pointer transition-colors"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-medium text-gray-900">Batch {batch.batch_number}</p>
                            <p className="text-sm text-gray-600">
                              Available: {batch.remaining_quantity} {item?.uom}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900">
                              ₱{Number(batch.cost_price || 0).toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(batch.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Package className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>No batches with available quantity found.</p>
                    <p className="text-sm">Batches are created when receiving inventory.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // Step 2: Quantity Adjustment
            <div className="space-y-4">
              {selectedBatch && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-700">Selected Batch</h3>
                    <button
                      onClick={handleBackToBatchSelection}
                      className="text-xs text-[#0504AA] hover:underline"
                    >
                      Change Batch
                    </button>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                    <p className="font-medium text-gray-900">
                      {item?.item_name} - Batch {selectedBatch.batch_number}
                    </p>
                    <p className="text-sm text-gray-600">
                      Current: {selectedBatch.remaining_quantity} {item?.uom} • 
                      Cost: ₱{Number(selectedBatch.cost_price || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border-l-4 border-[#D3465C] p-4 mb-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-[#D3465C]" />
                    <p className="text-[#D3465C]">{error}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Batch Quantity <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.newQuantity}
                      onChange={(e) => {
                        const value = e.target.value;
                        // Only allow whole numbers
                        if (value === '' || (!isNaN(parseInt(value)) && parseInt(value) >= 0)) {
                          setFormData(prev => ({ ...prev, newQuantity: value }));
                        }
                      }}
                      placeholder="Enter new quantity for this batch"
                      className="w-full p-2.5 pr-16 border-[1.5px] border-[#D5D7DA] rounded-lg focus:border-[#3B82F6] focus:outline-none"
                      min="0"
                      step="1"
                    />
                    <span className="absolute right-10 top-1/2 transform -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
                      {item?.uom}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Current batch quantity: {selectedBatch?.remaining_quantity} {item?.uom}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Optional notes for this batch adjustment"
                    rows={3}
                    className="w-full p-2.5 border-[1.5px] border-[#D5D7DA] rounded-lg focus:border-[#3B82F6] focus:outline-none resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleBackToBatchSelection}
                    className="px-4 py-2 border border-gray-300 cursor-pointer rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !formData.newQuantity || !selectedBatch || parseInt(formData.newQuantity) === selectedBatch.remaining_quantity}
                    className="px-4 py-2 bg-[#0504AA] cursor-pointer text-white rounded-lg hover:bg-[#0504AA]/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Processing...' : 'Confirm Adjustment'}
                  </button>
                </div>
              </form>
            </div>
          )}
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