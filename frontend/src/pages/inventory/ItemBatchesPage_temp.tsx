import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import { useAuthContext } from '../../context/AuthContext';
import api from '../../lib/api';
import Toast from '../../components/common/Toast';

interface InventoryBatch {
  batch_id: number;
  batch_number: string;
  cost_price: number;
  cost_tier: string;
  cost_tier_display: string;
  tier_discount_percentage: number;
  tier_discount_amount: number;
  initial_quantity: number;
  quantity_available: number;
  quantity_reserved: number;
  quantity_sold: number;
  effective_cost_price: number;
  expiry_date: string | null;
  manufacturing_date: string | null;
  purchase_date: string;
  purchase_order_ref: string | null;
  supplier_invoice_ref: string | null;
  batch_status: string;
  batch_status_display: string;
  is_expired: boolean;
  days_to_expiry: number | null;
  notes: string | null;
  created_at: string;
}

interface Item {
  item_id: number;
  item_name: string;
  model_number: string;
  brand_name: string;
}

interface NewBatchForm {
  batch_number: string;
  cost_price: number;
  cost_tier: string;
  tier_discount_percentage: number;
  tier_discount_amount: number;
  initial_quantity: number;
  expiry_date: string;
  manufacturing_date: string;
  purchase_date: string;
  purchase_order_ref: string;
  supplier_invoice_ref: string;
  notes: string;
}

const COST_TIERS = [
  { value: 'RD', label: 'Regional Distributor' },
  { value: 'PD', label: 'Provincial Distributor' },
  { value: 'DD', label: 'District Distributor' },
  { value: 'CD', label: 'City Distributor' },
  { value: 'RS', label: 'Reseller' },
  { value: 'SUB', label: 'Sub-Reseller' },
  { value: 'SRP', label: 'Suggested Retail Price' },
];

export default function ItemBatchesPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  
  const [item, setItem] = useState<Item | null>(null);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBatch, setNewBatch] = useState<NewBatchForm>({
    batch_number: '',
    cost_price: 0,
    cost_tier: String(user?.cost_tier || 'SUB'),
    tier_discount_percentage: 0,
    tier_discount_amount: 0,
    initial_quantity: 0,
    expiry_date: '',
    manufacturing_date: '',
    purchase_date: new Date().toISOString().split('T')[0],
    purchase_order_ref: '',
    supplier_invoice_ref: '',
    notes: '',
  });
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'loading';
  }>({ show: false, message: '', type: 'success' });

  useEffect(() => {
    if (itemId) {
      fetchItemAndBatches();
    }
  }, [itemId]);

  const fetchItemAndBatches = async () => {
    try {
      setLoading(true);
      
      // Fetch item details
      const itemResponse = await api.get(`/items/${itemId}/`);
      setItem(itemResponse.data);

      // Fetch batches for this item
      const batchesResponse = await api.get(`/inventory-batches/?item_id=${itemId}`);
      setBatches(batchesResponse.data.results || batchesResponse.data);
    } catch (error) {
      console.error('Error fetching item and batches:', error);
      setToast({
        show: true,
        message: 'Failed to load item information',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddBatch = async () => {
    try {
      setToast({ show: true, message: 'Adding batch...', type: 'loading' });

      const batchData = {
        ...newBatch,
        item: parseInt(itemId!),
        quantity_available: newBatch.initial_quantity,
        expiry_date: newBatch.expiry_date || null,
        manufacturing_date: newBatch.manufacturing_date || null,
        purchase_order_ref: newBatch.purchase_order_ref || null,
        supplier_invoice_ref: newBatch.supplier_invoice_ref || null,
        notes: newBatch.notes || null,
      };

      await api.post('/inventory-batches/', batchData);
      
      // Refresh batches list
      await fetchItemAndBatches();
      
      // Reset form and close modal
      setNewBatch({
        batch_number: '',
        cost_price: 0,
        cost_tier: String(user?.cost_tier || 'SUB'),
        tier_discount_percentage: 0,
        tier_discount_amount: 0,
        initial_quantity: 0,
        expiry_date: '',
        manufacturing_date: '',
        purchase_date: new Date().toISOString().split('T')[0],
        purchase_order_ref: '',
        supplier_invoice_ref: '',
        notes: '',
      });
      setShowAddModal(false);

      setToast({
        show: true,
        message: 'Batch added successfully!',
        type: 'success'
      });
    } catch (error: any) {
      console.error('Error adding batch:', error);
      let errorMessage = 'Failed to add batch';
      
      if (error.response?.data?.batch_number) {
        errorMessage = error.response.data.batch_number[0];
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      setToast({
        show: true,
        message: errorMessage,
        type: 'error'
      });
    }
  };

  const getStatusIcon = (batch: InventoryBatch) => {
    if (batch.is_expired) {
      return <AlertTriangle className="h-5 w-5 text-red-500" />;
    }
    if (batch.days_to_expiry !== null && batch.days_to_expiry <= 30) {
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
    return <CheckCircle className="h-5 w-5 text-green-500" />;
  };

  const getStatusText = (batch: InventoryBatch) => {
    if (batch.is_expired) {
      return 'Expired';
    }
    if (batch.days_to_expiry !== null && batch.days_to_expiry <= 30) {
      return `Expires in ${batch.days_to_expiry} days`;
    }
    return 'Good';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0504AA]"></div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Item Not Found</h2>
          <p className="text-gray-600 mb-4">The requested item could not be found.</p>
          <button
            onClick={() => navigate('/inventory')}
            className="bg-[#0504AA] text-white px-4 py-2 rounded-lg hover:bg-opacity-90"
          >
            Return to Inventory
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/inventory')}
          className="flex items-center text-gray-600 hover:text-gray-800 mb-4"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Inventory
        </button>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Inventory Batches</h1>
              <div className="text-gray-600">
                <p className="font-medium">{item.item_name}</p>
                <p className="text-sm">Model: {item.model_number} | Brand: {item.brand_name}</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center space-x-2 bg-[#0504AA] text-white px-4 py-2 rounded-lg hover:bg-opacity-90"
            >
              <Plus className="h-4 w-4" />
              <span>Add Batch</span>
            </button>
          </div>
        </div>
      </div>

      {/* Batches List */}
      <div className="space-y-4">
        {batches.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Batches Found</h3>
            <p className="text-gray-600 mb-4">
              This item doesn't have any inventory batches yet. Add a batch to start tracking inventory.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-[#0504AA] text-white px-6 py-2 rounded-lg hover:bg-opacity-90"
            >
              Add First Batch
            </button>
          </div>
        ) : (
          batches.map((batch) => (
            <div key={batch.batch_id} className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(batch)}
                  <div>
                    <h3 className="font-semibold text-gray-900">Batch {batch.batch_number}</h3>
                    <p className="text-sm text-gray-600">{getStatusText(batch)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    batch.batch_status === 'Active' ? 'bg-green-100 text-green-800' :
                    batch.batch_status === 'Expired' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {batch.batch_status_display}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Quantity Info */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Quantities</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Initial:</span>
                      <span className="font-medium">{batch.initial_quantity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Available:</span>
                      <span className="font-medium text-green-600">{batch.quantity_available}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Reserved:</span>
                      <span className="font-medium text-yellow-600">{batch.quantity_reserved}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sold:</span>
                      <span className="font-medium text-blue-600">{batch.quantity_sold}</span>
                    </div>
                  </div>
                </div>

                {/* Pricing Info */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Pricing</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Cost Tier:</span>
                      <span className="font-medium">{batch.cost_tier_display}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cost Price:</span>
                      <span className="font-medium">{formatCurrency(batch.cost_price)}</span>
                    </div>
                    {(batch.tier_discount_percentage > 0 || batch.tier_discount_amount > 0) && (
                      <>
                        <div className="flex justify-between">
                          <span>Discount:</span>
                          <span className="font-medium text-green-600">
                            {batch.tier_discount_percentage > 0 
                              ? `${batch.tier_discount_percentage}%`
                              : formatCurrency(batch.tier_discount_amount)
                            }
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Effective Cost:</span>
                          <span className="font-medium">{formatCurrency(batch.effective_cost_price)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Dates */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">Important Dates</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Purchase:</span>
                      <span className="font-medium">{new Date(batch.purchase_date).toLocaleDateString()}</span>
                    </div>
                    {batch.manufacturing_date && (
                      <div className="flex justify-between">
                        <span>Manufactured:</span>
                        <span className="font-medium">{new Date(batch.manufacturing_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    {batch.expiry_date && (
                      <div className="flex justify-between">
                        <span>Expires:</span>
                        <span className={`font-medium ${
                          batch.is_expired ? 'text-red-600' :
                          batch.days_to_expiry !== null && batch.days_to_expiry <= 30 ? 'text-yellow-600' :
                          'text-gray-900'
                        }`}>
                          {new Date(batch.expiry_date).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* References */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-700">References</h4>
                  <div className="space-y-1 text-sm">
                    {batch.purchase_order_ref && (
                      <div>
                        <span className="text-gray-600">PO:</span>
                        <span className="font-medium ml-1">{batch.purchase_order_ref}</span>
                      </div>
                    )}
                    {batch.supplier_invoice_ref && (
                      <div>
                        <span className="text-gray-600">Invoice:</span>
                        <span className="font-medium ml-1">{batch.supplier_invoice_ref}</span>
                      </div>
                    )}
                    {batch.notes && (
                      <div>
                        <span className="text-gray-600">Notes:</span>
                        <p className="text-xs mt-1 text-gray-800">{batch.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Batch Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Add New Batch</h2>
              <p className="text-gray-600 text-sm mt-1">Create a new inventory batch for {item.item_name}</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Batch Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Batch Number *
                </label>
                <input
                  type="text"
                  value={newBatch.batch_number}
                  onChange={(e) => setNewBatch(prev => ({ ...prev, batch_number: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0504AA] focus:border-transparent"
                  placeholder="Enter unique batch number"
                  required
                />
              </div>

              {/* Cost Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cost Tier *
                  </label>
                  <select
                    value={newBatch.cost_tier}
                    onChange={(e) => setNewBatch(prev => ({ ...prev, cost_tier: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0504AA] focus:border-transparent"
                  >
                    {COST_TIERS.map(tier => (
                      <option key={tier.value} value={tier.value}>
                        {tier.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cost Price *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newBatch.cost_price}
                    onChange={(e) => setNewBatch(prev => ({ ...prev, cost_price: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0504AA] focus:border-transparent"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              {/* Discount Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discount Percentage
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={newBatch.tier_discount_percentage}
                    onChange={(e) => setNewBatch(prev => ({ ...prev, tier_discount_percentage: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0504AA] focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Discount Amount
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newBatch.tier_discount_amount}
                    onChange={(e) => setNewBatch(prev => ({ ...prev, tier_discount_amount: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0504AA] focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Initial Quantity *
                </label>
                <input
                  type="number"
                  min="1"
                  value={newBatch.initial_quantity}
                  onChange={(e) => setNewBatch(prev => ({ ...prev, initial_quantity: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0504AA] focus:border-transparent"
                  placeholder="Enter quantity"
                  required
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Purchase Date *
                  </label>
                  <input
                    type="date"
                    value={newBatch.purchase_date}
                    onChange={(e) => setNewBatch(prev => ({ ...prev, purchase_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0504AA] focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Manufacturing Date
                  </label>
                  <input
                    type="date"
                    value={newBatch.manufacturing_date}
                    onChange={(e) => setNewBatch(prev => ({ ...prev, manufacturing_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0504AA] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expiry Date
                  </label>
                  <input
                    type="date"
                    value={newBatch.expiry_date}
                    onChange={(e) => setNewBatch(prev => ({ ...prev, expiry_date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0504AA] focus:border-transparent"
                  />
                </div>
              </div>

              {/* References */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Purchase Order Reference
                  </label>
                  <input
                    type="text"
                    value={newBatch.purchase_order_ref}
                    onChange={(e) => setNewBatch(prev => ({ ...prev, purchase_order_ref: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0504AA] focus:border-transparent"
                    placeholder="PO reference number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Supplier Invoice Reference
                  </label>
                  <input
                    type="text"
                    value={newBatch.supplier_invoice_ref}
                    onChange={(e) => setNewBatch(prev => ({ ...prev, supplier_invoice_ref: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0504AA] focus:border-transparent"
                    placeholder="Invoice reference"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={newBatch.notes}
                  onChange={(e) => setNewBatch(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0504AA] focus:border-transparent"
                  placeholder="Additional notes about this batch..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAddBatch}
                className="px-4 py-2 bg-[#0504AA] text-white rounded-lg hover:bg-opacity-90"
              >
                Add Batch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <Toast
        title={
          toast.type === 'loading' ? 'Processing...' : 
          toast.type === 'success' ? 'Success' : 'Error'
        }
        message={toast.message}
        type={toast.type}
        duration={toast.type === 'loading' ? null : 3000}
        isVisible={toast.show}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
    </div>
  );
}
