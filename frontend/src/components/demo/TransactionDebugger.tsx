import React, { useState, useEffect } from 'react';
import { itemsApi, transactionsApi, pricingApi, batchApi } from '../../lib/api';
import {
  Item,
  TransactionCreate,
  PricingTierOption,
  UserTierRestrictions,
} from '../../types/inventory';

interface DebugTransactionItem {
  item: number;
  quantity_change: number;
  item_name?: string;
  pricing_tier?: string;
  unit_price?: number;
  total_price?: number;
  batch_id?: number;
  cost_price?: number;
}

const TransactionDebugger: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [userTierRestrictions, setUserTierRestrictions] = useState<UserTierRestrictions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [customerName, setCustomerName] = useState('Test Customer');
  const [selectedItemId, setSelectedItemId] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(5);
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [selectedBatchId, setSelectedBatchId] = useState<number>(0);

  // Debug data
  const [availableBatches, setAvailableBatches] = useState<any[]>([]);
  const [lastRequest, setLastRequest] = useState<any>(null);
  const [lastResponse, setLastResponse] = useState<any>(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);

      const [itemsResponse, userTiersResponse] = await Promise.all([
        itemsApi.getAll(),
        pricingApi.getUserAllowedTiers()
      ]);

      if (itemsResponse.status === 'success') {
        const itemsData = itemsResponse.data.results || itemsResponse.data;
        setItems(Array.isArray(itemsData) ? itemsData : []);
      }

      if (userTiersResponse.status === 'success') {
        setUserTierRestrictions(userTiersResponse.data);
      }
    } catch (err) {
      setError('Failed to load initial data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadBatchesForItem = async (itemId: number) => {
    if (!itemId) {
      setAvailableBatches([]);
      return;
    }

    try {
      console.log(`🔍 Loading batches for item ${itemId}...`);
      const response = await batchApi.getByItemId(itemId, true);
      console.log('📦 Batch response:', response);

      if (response.status === 'success') {
        const batchData = response.data.results || response.data || [];
        setAvailableBatches(batchData);

        // Auto-select first batch
        if (batchData.length > 0) {
          setSelectedBatchId(batchData[0].batch_id || batchData[0].id);
        }
      } else {
        setAvailableBatches([]);
      }
    } catch (err) {
      console.error('Error loading batches:', err);
      setAvailableBatches([]);
    }
  };

  const handleItemChange = (itemId: number) => {
    setSelectedItemId(itemId);
    setSelectedTier('');
    setSelectedBatchId(0);
    loadBatchesForItem(itemId);
  };

  const calculateUnitPrice = () => {
    if (!selectedTier) return 0;

    const selectedItem = items.find(item => item.item_id === selectedItemId);
    if (selectedItem && selectedItem.tier_pricing) {
      const tierPrice = selectedItem.tier_pricing.find(tp => tp.pricing_tier === selectedTier);
      if (tierPrice) {
        return tierPrice.price;
      }
    }

    // Fallback pricing
    const defaultPrices: { [key: string]: number } = {
      'RD': 100,
      'PD': 90,
      'DD': 80,
      'CD': 70,
      'RS': 60,
      'SUB-RS': 50,
      'SRP': 40,
    };

    return defaultPrices[selectedTier] || 40;
  };

  const buildTransactionData = (): TransactionCreate => {
    const unitPrice = calculateUnitPrice();
    const totalPrice = unitPrice * quantity;

    const transactionItem: DebugTransactionItem = {
      item: selectedItemId,
      quantity_change: -Math.abs(quantity), // Negative for outgoing
      pricing_tier: selectedTier,
      unit_price: unitPrice,
      total_price: totalPrice,
    };

    if (selectedBatchId) {
      transactionItem.batch_id = selectedBatchId;
    }

    return {
      transaction_type: 'OUTGOING',
      transaction_status: 'Pending',
      customer_name: customerName,
      items: [transactionItem],
    };
  };

  const testTransaction = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const transactionData = buildTransactionData();
      setLastRequest(transactionData);

      console.log('📤 Sending transaction:', transactionData);

      const response = await transactionsApi.create(transactionData);
      setLastResponse(response);

      console.log('📥 Received response:', response);

      if (response.status === 'success') {
        setSuccess('Transaction created successfully!');
      } else {
        setError(response.message || 'Transaction failed');
      }
    } catch (err: any) {
      console.error('🚨 Transaction error:', err);
      setLastResponse({
        status: 'error',
        error: err,
        response: err.response
      });

      let errorMessage = 'Transaction failed';

      if (err.response?.status === 400) {
        const data = err.response.data;
        if (typeof data === 'string') {
          errorMessage = data;
        } else if (data?.detail) {
          errorMessage = data.detail;
        } else if (data?.message) {
          errorMessage = data.message;
        } else {
          // Parse field errors
          const fieldErrors = [];
          for (const [field, errors] of Object.entries(data || {})) {
            if (Array.isArray(errors)) {
              fieldErrors.push(`${field}: ${errors.join(', ')}`);
            }
          }
          if (fieldErrors.length > 0) {
            errorMessage = fieldErrors.join(' | ');
          }
        }
      }

      setError(`Error ${err.response?.status || 'Unknown'}: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const selectedItem = items.find(item => item.item_id === selectedItemId);
  const selectedBatch = availableBatches.find(batch =>
    (batch.batch_id || batch.id) === selectedBatchId
  );

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Transaction Debugger</h1>
          <p className="text-gray-600 mt-2">
            Debug tool for testing transaction creation and identifying 400 errors
          </p>
        </div>

        {/* Form */}
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Create Test Transaction</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter customer name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Item
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => handleItemChange(parseInt(e.target.value))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value={0}>Choose an item...</option>
                  {items.map((item) => (
                    <option key={item.item_id} value={item.item_id}>
                      {item.item_name} - {item.sku}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  min="1"
                  max="100"
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pricing Tier
                  {userTierRestrictions?.user_cost_tier && (
                    <span className="text-xs text-blue-600 ml-2">
                      (Your cost tier: {userTierRestrictions.user_cost_tier})
                    </span>
                  )}
                </label>
                <select
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={!selectedItemId}
                >
                  <option value="">Select pricing tier...</option>
                  {userTierRestrictions?.allowed_selling_tiers.map((tier) => (
                    <option key={tier.value} value={tier.value}>
                      {tier.label} (₱{calculateUnitPrice() || '—'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Batch Selection
                  <span className="text-xs text-gray-500 ml-2">
                    ({availableBatches.length} available)
                  </span>
                </label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(parseInt(e.target.value) || 0)}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  disabled={!selectedItemId || availableBatches.length === 0}
                >
                  <option value={0}>
                    {availableBatches.length === 0 ? 'No batches available' : 'Select batch (optional)'}
                  </option>
                  {availableBatches.map((batch) => (
                    <option key={batch.batch_id || batch.id} value={batch.batch_id || batch.id}>
                      Batch {batch.batch_number} - {batch.remaining_quantity} available (₱{batch.cost_price})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-4">
                <button
                  onClick={testTransaction}
                  disabled={loading || !selectedItemId || !selectedTier}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? '🔄 Creating Transaction...' : '🚀 Test Transaction'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction Preview */}
        {selectedItemId > 0 && (
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold mb-4">Transaction Preview</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-4 rounded-lg">
                <h3 className="font-medium mb-3">Request Data</h3>
                <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto">
                  {JSON.stringify(buildTransactionData(), null, 2)}
                </pre>
              </div>

              <div className="bg-white p-4 rounded-lg">
                <h3 className="font-medium mb-3">Summary</h3>
                <div className="space-y-2 text-sm">
                  <div><strong>Customer:</strong> {customerName}</div>
                  <div><strong>Item:</strong> {selectedItem?.item_name || '—'}</div>
                  <div><strong>Quantity:</strong> {quantity}</div>
                  <div><strong>Pricing Tier:</strong> {selectedTier || '—'}</div>
                  <div><strong>Unit Price:</strong> ₱{calculateUnitPrice()}</div>
                  <div><strong>Total Price:</strong> ₱{calculateUnitPrice() * quantity}</div>
                  <div><strong>Batch:</strong> {selectedBatch ? `Batch ${selectedBatch.batch_number}` : 'None'}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Results</h2>

          {/* Success/Error Messages */}
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-green-700 font-medium">✅ Success!</div>
              <div className="text-green-600">{success}</div>
            </div>
          )}

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-red-700 font-medium">❌ Error</div>
              <div className="text-red-600">{error}</div>
            </div>
          )}

          {/* Debug Information */}
          {(lastRequest || lastResponse) && (
            <div className="space-y-4">
              {lastRequest && (
                <div>
                  <h3 className="font-medium mb-2">📤 Last Request Sent:</h3>
                  <pre className="text-xs bg-gray-800 text-green-400 p-3 rounded overflow-x-auto">
                    {JSON.stringify(lastRequest, null, 2)}
                  </pre>
                </div>
              )}

              {lastResponse && (
                <div>
                  <h3 className="font-medium mb-2">
                    📥 Last Response Received:
                    <span className={`ml-2 px-2 py-1 text-xs rounded ${
                      lastResponse.status === 'success'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {lastResponse.status}
                    </span>
                  </h3>
                  <pre className="text-xs bg-gray-800 text-green-400 p-3 rounded overflow-x-auto">
                    {JSON.stringify(lastResponse, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="p-6 bg-blue-50 border-t">
          <h3 className="font-medium text-blue-900 mb-3">🧪 How to Use This Debugger</h3>
          <div className="text-sm text-blue-800 space-y-2">
            <div>1. <strong>Fill out the form</strong> with your test transaction details</div>
            <div>2. <strong>Review the preview</strong> to see what data will be sent</div>
            <div>3. <strong>Click "Test Transaction"</strong> to submit the request</div>
            <div>4. <strong>Check the results</strong> to see the API response and any errors</div>
            <div>5. <strong>Debug 400 errors</strong> by examining the request/response data</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionDebugger;
