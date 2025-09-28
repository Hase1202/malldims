import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, AlertTriangle, CheckCircle, Calendar, DollarSign, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import api from '../../lib/api';
import Toast from '../../components/common/Toast';
import AddTransactionModal from '../transactions/AddTransaction';
import Sidebar from '../../components/common/Sidebar';

interface InventoryBatch {
  batch_id?: number;
  batch_number: number;
  cost_price: number;
  initial_quantity: number;
  remaining_quantity: number;
  created_at: string;
  transaction?: number;
  item_name?: string;
  item_sku?: string;
  brand_name?: string;
  transaction_reference?: string;
  created_at_formatted?: string;
  // Extended fields that may be added later
  cost_tier?: string;
  cost_tier_display?: string;
  tier_discount_percentage?: number;
  tier_discount_amount?: number;
  quantity_available?: number;
  quantity_reserved?: number;
  quantity_sold?: number;
  effective_cost_price?: number;
  expiry_date?: string | null;
  manufacturing_date?: string | null;
  purchase_date?: string;
  purchase_order_ref?: string | null;
  supplier_invoice_ref?: string | null;
  batch_status?: string;
  batch_status_display?: string;
  is_expired?: boolean;
  days_to_expiry?: number | null;
  notes?: string | null;
}

interface Item {
  item_id: number;
  item_name: string;
  model_number: string;
  brand_name: string;
}

export default function ItemBatchesPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  
  const [item, setItem] = useState<Item | null>(null);
  const [batches, setBatches] = useState<InventoryBatch[]>([]);
  const [filteredBatches, setFilteredBatches] = useState<InventoryBatch[]>([]);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof InventoryBatch | null;
    direction: 'asc' | 'desc' | null;
  }>({ key: null, direction: null });
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAddTransactionModalOpen, setIsAddTransactionModalOpen] = useState(false);
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

  // Effect to filter and sort batches when sort config changes
  useEffect(() => {
    let filtered = [...batches];

    // Apply sorting
    if (sortConfig.key && sortConfig.direction) {
      filtered.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];

        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return sortConfig.direction === 'asc' ? 1 : -1;
        if (bValue == null) return sortConfig.direction === 'asc' ? -1 : 1;

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    setFilteredBatches(filtered);
  }, [batches, sortConfig]);  const fetchItemAndBatches = async () => {
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

  const handleSort = (key: keyof InventoryBatch) => {
    let direction: 'asc' | 'desc' = 'asc';
    
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof InventoryBatch) => {
    if (sortConfig.key !== key) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400 ml-1" />;
    }
    
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="h-4 w-4 text-gray-600 ml-1" />
      : <ArrowDown className="h-4 w-4 text-gray-600 ml-1" />;
  };

  const handleModalClose = () => {
    setIsAddTransactionModalOpen(false);
  };

  const handleTransactionSuccess = () => {
    // Refresh the batches data
    fetchItemAndBatches();
    
    // Show success toast
    setToast({
      show: true,
      message: 'Transaction created successfully',
      type: 'success'
    });
  };

  const getStatusIcon = (batch: InventoryBatch) => {
    if (batch.is_expired) {
      return <AlertTriangle className="h-5 w-5 text-red-500" />;
    }
    if (batch.days_to_expiry !== undefined && batch.days_to_expiry !== null && batch.days_to_expiry <= 30) {
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
    return <CheckCircle className="h-5 w-5 text-green-500" />;
  };

  const getStatusText = (batch: InventoryBatch) => {
    if (batch.is_expired) {
      return 'Expired';
    }
    if (batch.days_to_expiry !== undefined && batch.days_to_expiry !== null && batch.days_to_expiry <= 30) {
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

  const getTotalQuantities = () => {
    return batches.reduce((totals, batch) => ({
      initial: totals.initial + batch.initial_quantity,
      available: totals.available + (batch.quantity_available || batch.remaining_quantity),
      sold: totals.sold + (batch.quantity_sold || 0),
    }), { initial: 0, available: 0, sold: 0 });
  };
  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen overflow-hidden">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <div className="flex-1 bg-[#F9F9F9] overflow-y-auto lg:ml-64">
          <div className="min-h-screen flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0504AA]"></div>
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
        </div>
      </div>
    );
  }
  const totals = getTotalQuantities();

  return (
    <div className="flex flex-col lg:flex-row min-h-screen overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <div className="flex-1 bg-[#F9F9F9] overflow-y-auto lg:ml-64">
        <div className="p-4 lg:p-8">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => navigate('/inventory')}
              className="flex items-center text-gray-600 hover:text-gray-800 mb-4"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to Inventory
            </button>            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-2">Inventory Batches</h1>
                  <div className="text-gray-600">
                    <p className="font-medium">{item.item_name}</p>
                    <p className="text-sm">Model: {item.model_number} | Brand: {item.brand_name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Total Batches</p>
                  <p className="text-2xl font-bold text-[#0504AA]">{batches.length}</p>
                </div>
              </div>
            </div>
          </div>

      {/* Summary Cards */}
      {batches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center">
              <Package className="h-8 w-8 text-blue-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Initial Stock</p>
                <p className="text-lg font-semibold text-gray-900">{totals.initial}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Available</p>
                <p className="text-lg font-semibold text-gray-900">{totals.available}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Sold</p>
                <p className="text-lg font-semibold text-gray-900">{totals.sold}</p>
              </div>
            </div>
          </div>
        </div>
      )}      {/* Batches and Notes Layout */}
      <div className="flex flex-col xl:flex-row xl:items-start gap-6">
        {/* Batches List - Takes most of the width, but allows notes to show */}
        <div className="w-full xl:flex-1 bg-white rounded-lg shadow-sm">
          {batches.length > 0 ? (
            <>
              {/* Header */}
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Inventory Batches</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('batch_number')}
                      >
                        <div className="flex items-center">
                          Batch Info
                          {getSortIcon('batch_number')}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('batch_status')}
                      >
                        <div className="flex items-center">
                          Status
                          {getSortIcon('batch_status')}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('initial_quantity')}
                      >
                        <div className="flex items-center">
                          Initial Qty
                          {getSortIcon('initial_quantity')}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('quantity_available')}
                      >
                        <div className="flex items-center">
                          Available Qty
                          {getSortIcon('quantity_available')}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('cost_price')}
                      >
                        <div className="flex items-center">
                          Cost Price
                          {getSortIcon('cost_price')}
                        </div>
                      </th>
                      <th 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('purchase_date')}
                      >
                        <div className="flex items-center">
                          Dates
                          {getSortIcon('purchase_date')}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredBatches.map((batch) => (
                      <tr key={batch.batch_id || `batch-${batch.batch_number}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          Batch {batch.batch_number}
                        </div>
                        {batch.purchase_order_ref && (
                          <div className="text-xs text-gray-500">
                            PO: {batch.purchase_order_ref}
                          </div>
                        )}
                        {batch.supplier_invoice_ref && (
                          <div className="text-xs text-gray-500">
                            Invoice: {batch.supplier_invoice_ref}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(batch)}
                        <div className="ml-2">
                          <div className="text-sm text-gray-900">{getStatusText(batch)}</div>
                          <div className={`text-xs px-2 py-1 rounded-full ${
                            (batch.batch_status === 'Active' || !batch.batch_status) ? 'bg-green-100 text-green-800' :
                            batch.batch_status === 'Expired' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {batch.batch_status_display || 'Active'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-medium text-lg">{batch.initial_quantity}</div>
                      <div className="text-xs text-gray-500">Original amount</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">Available:</span>
                          <span className="font-medium text-green-600">{batch.quantity_available || batch.remaining_quantity}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">Sold:</span>
                          <span className="font-medium text-blue-600">{batch.quantity_sold || (batch.initial_quantity - (batch.quantity_available || batch.remaining_quantity))}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-medium">{formatCurrency(batch.cost_price)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="space-y-1">
                        <div className="flex items-center text-xs text-gray-500">
                          <Calendar className="h-3 w-3 mr-1" />
                          Created: {new Date(batch.created_at).toLocaleDateString()}
                        </div>
                        {batch.purchase_date && (
                          <div className="text-xs text-gray-500">
                            Purchase: {new Date(batch.purchase_date).toLocaleDateString()}
                          </div>
                        )}
                        {batch.manufacturing_date && (
                          <div className="text-xs text-gray-500">
                            Mfg: {new Date(batch.manufacturing_date).toLocaleDateString()}
                          </div>
                        )}
                        {batch.expiry_date && (
                          <div className={`text-xs ${
                            batch.is_expired ? 'text-red-600' :
                            batch.days_to_expiry !== undefined && batch.days_to_expiry !== null && batch.days_to_expiry <= 30 ? 'text-yellow-600' :
                            'text-gray-500'
                          }`}>
                            Exp: {new Date(batch.expiry_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
            </>
          ) : (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Batches Found</h3>
              <p className="text-gray-600 mb-4">
                This item doesn't have any inventory batches yet. Batches are created when receiving inventory through transactions with brands.
              </p>
              <button
                onClick={() => setIsAddTransactionModalOpen(true)}
                className="bg-[#0504AA] text-white px-4 py-2 rounded-lg hover:bg-opacity-90"
              >
                Add Transaction
              </button>
            </div>
          )}
        </div>        {/* Notes Section - Flexible width on large screens, full width on small screens */}
        {batches.some(batch => batch.notes) && (
          <div className="w-full xl:w-80 xl:flex-shrink-0 bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Batch Notes</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {batches.filter(batch => batch.notes).map((batch) => (
                <div key={batch.batch_id || `notes-${batch.batch_number}`} className="border-l-2 border-[#0504AA] pl-4">
                  <div className="text-sm font-medium text-gray-900">
                    Batch {batch.batch_number}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {batch.notes}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      </div>
    </div>

      {/* Toast Notification */}
      <Toast
        title={
          toast.type === 'loading' ? 'Loading...' : 
          toast.type === 'success' ? 'Success' : 'Error'
        }
        message={toast.message}
        type={toast.type}
        duration={toast.type === 'loading' ? null : 3000}
        isVisible={toast.show}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
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