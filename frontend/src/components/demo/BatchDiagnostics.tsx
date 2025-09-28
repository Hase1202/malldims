import React, { useState, useEffect } from 'react';
import { batchApi, itemsApi, brandsApi } from '../../lib/api';
import { Item, Brand } from '../../types/inventory';

interface BatchInfo {
  batch_id?: number;
  id?: number;
  item: number;
  batch_number: number;
  cost_price: number;
  initial_quantity: number;
  remaining_quantity: number;
  item_name?: string;
  item_sku?: string;
  brand_name?: string;
  created_at?: string;
}

const BatchDiagnostics: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number>(0);
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [activeOnly, setActiveOnly] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);

      const [itemsResponse, brandsResponse] = await Promise.all([
        itemsApi.getAll(),
        brandsApi.getAll()
      ]);

      if (itemsResponse.status === 'success') {
        const itemsData = itemsResponse.data.results || itemsResponse.data;
        setItems(Array.isArray(itemsData) ? itemsData : []);
      }

      if (brandsResponse.status === 'success') {
        const brandsData = brandsResponse.data.results || brandsResponse.data;
        setBrands(Array.isArray(brandsData) ? brandsData : []);
      }
    } catch (err) {
      setError('Failed to load initial data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBatchesForItem = async (itemId: number) => {
    if (!itemId) {
      setBatches([]);
      setApiResponse(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log(`🔍 Fetching batches for item ${itemId}...`);

      const response = await batchApi.getByItemId(itemId, activeOnly);

      console.log('📦 Batch API Response:', response);
      setApiResponse(response);

      if (response.status === 'success') {
        let batchData = [];
        if (response.data) {
          if (response.data.results) {
            batchData = response.data.results;
          } else if (Array.isArray(response.data)) {
            batchData = response.data;
          } else {
            console.warn('⚠️ Unexpected batch data format:', response.data);
          }
        }

        setBatches(batchData);
        console.log(`📊 Found ${batchData.length} batches`);
      } else {
        setError(response.message || 'Failed to fetch batches');
        setBatches([]);
      }
    } catch (err) {
      console.error('🚨 Error fetching batches:', err);
      setError('Error fetching batches');
      setBatches([]);
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = (itemId: number) => {
    setSelectedItemId(itemId);
    fetchBatchesForItem(itemId);
  };

  const selectedItem = items.find(item => item.item_id === selectedItemId);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Batch Selection Diagnostics</h1>
          <p className="text-gray-600 mt-2">
            Debug tool for batch selection issues - see what's happening with API calls
          </p>
        </div>

        {/* Controls */}
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Item to Test
              </label>
              <select
                value={selectedItemId}
                onChange={(e) => handleItemChange(parseInt(e.target.value))}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>Choose an item...</option>
                {items.map((item) => (
                  <option key={item.item_id} value={item.item_id}>
                    {item.item_name} - {item.sku} ({item.brand_name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter Options
              </label>
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={activeOnly}
                    onChange={(e) => {
                      setActiveOnly(e.target.checked);
                      if (selectedItemId) {
                        fetchBatchesForItem(selectedItemId);
                      }
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Active batches only</span>
                </label>
                <button
                  onClick={() => selectedItemId && fetchBatchesForItem(selectedItemId)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  disabled={!selectedItemId || loading}
                >
                  {loading ? '🔄 Loading...' : '🔄 Refresh'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Item Info */}
        {selectedItem && (
          <div className="p-6 border-b border-gray-200 bg-blue-50">
            <h2 className="text-lg font-semibold mb-3">Selected Item Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-3 rounded-lg">
                <div className="text-sm text-gray-500">Item Name</div>
                <div className="font-medium">{selectedItem.item_name}</div>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <div className="text-sm text-gray-500">SKU</div>
                <div className="font-medium">{selectedItem.sku || 'N/A'}</div>
              </div>
              <div className="bg-white p-3 rounded-lg">
                <div className="text-sm text-gray-500">Brand</div>
                <div className="font-medium">{selectedItem.brand_name}</div>
              </div>
            </div>
          </div>
        )}

        {/* API Response Debug */}
        {selectedItemId > 0 && (
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold mb-3">API Response Debug</h2>

            {loading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Fetching batches...</p>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <div className="text-red-700 font-medium">Error:</div>
                <div className="text-red-600">{error}</div>
              </div>
            )}

            {apiResponse && (
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium mb-2">Raw API Response:</h3>
                  <pre className="text-xs bg-gray-800 text-green-400 p-3 rounded overflow-x-auto">
                    {JSON.stringify(apiResponse, null, 2)}
                  </pre>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white border rounded-lg p-3">
                    <div className="text-sm text-gray-500">API Status</div>
                    <div className={`font-medium ${apiResponse.status === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                      {apiResponse.status === 'success' ? '✅ Success' : '❌ Error'}
                    </div>
                  </div>
                  <div className="bg-white border rounded-lg p-3">
                    <div className="text-sm text-gray-500">Response Type</div>
                    <div className="font-medium">
                      {apiResponse.data ? (
                        apiResponse.data.results ? 'Paginated' : Array.isArray(apiResponse.data) ? 'Array' : 'Object'
                      ) : 'No Data'}
                    </div>
                  </div>
                  <div className="bg-white border rounded-lg p-3">
                    <div className="text-sm text-gray-500">Batches Count</div>
                    <div className="font-medium text-blue-600">
                      {batches.length} batches
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Batches Results */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-3">
            Batch Results {batches.length > 0 && `(${batches.length} found)`}
          </h2>

          {!selectedItemId ? (
            <div className="text-center py-8 text-gray-500">
              👆 Select an item above to see its batches
            </div>
          ) : batches.length === 0 && !loading ? (
            <div className="text-center py-8">
              <div className="text-gray-500 mb-4">
                📦 No batches found for this item
              </div>
              <div className="text-sm text-gray-400">
                This could mean:
                <ul className="mt-2 space-y-1">
                  <li>• No inventory has been received for this item</li>
                  <li>• All batches have been sold out (if "Active only" is checked)</li>
                  <li>• Database is empty or needs test data</li>
                </ul>
              </div>
              <div className="mt-4">
                <div className="text-sm text-blue-600 font-medium mb-2">💡 To create test data:</div>
                <pre className="bg-gray-800 text-green-400 p-3 rounded text-xs text-left inline-block">
{`python manage.py create_test_batches`}
                </pre>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {batches.map((batch, index) => (
                <div key={batch.batch_id || batch.id || index} className="border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                      <div className="text-sm text-gray-500">Batch ID</div>
                      <div className="font-medium">{batch.batch_id || batch.id}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Batch Number</div>
                      <div className="font-medium">Batch {batch.batch_number}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Cost Price</div>
                      <div className="font-medium text-green-600">₱{batch.cost_price}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Available Quantity</div>
                      <div className="font-medium text-blue-600">{batch.remaining_quantity}</div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500">Initial Quantity</div>
                      <div className="font-medium text-gray-600">{batch.initial_quantity}</div>
                    </div>
                  </div>

                  {batch.created_at && (
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <div className="text-xs text-gray-400">
                        Created: {new Date(batch.created_at).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="p-6 bg-gray-50 border-t">
          <h3 className="font-medium text-gray-900 mb-3">🧪 Testing Instructions</h3>
          <div className="text-sm text-gray-700 space-y-2">
            <div>1. <strong>Select an item</strong> from the dropdown above</div>
            <div>2. <strong>Check the API Response</strong> to see if the request is working</div>
            <div>3. <strong>Review batch results</strong> to see what data is available</div>
            <div>4. If no batches are found, run: <code className="bg-gray-200 px-1 rounded">python manage.py create_test_batches</code></div>
            <div>5. Use this data to test batch selection in transactions</div>
          </div>
        </div>

        {/* Database Stats */}
        <div className="p-6 bg-blue-50 border-t">
          <h3 className="font-medium text-blue-900 mb-3">📊 Current Database Stats</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-white p-3 rounded text-center">
              <div className="text-2xl font-bold text-blue-600">{brands.length}</div>
              <div className="text-gray-600">Brands</div>
            </div>
            <div className="bg-white p-3 rounded text-center">
              <div className="text-2xl font-bold text-green-600">{items.length}</div>
              <div className="text-gray-600">Items</div>
            </div>
            <div className="bg-white p-3 rounded text-center">
              <div className="text-2xl font-bold text-purple-600">{batches.length}</div>
              <div className="text-gray-600">Batches (current item)</div>
            </div>
            <div className="bg-white p-3 rounded text-center">
              <div className="text-2xl font-bold text-orange-600">
                {selectedItem ? (selectedItem.total_quantity || 0) : '–'}
              </div>
              <div className="text-gray-600">Total Quantity</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchDiagnostics;
