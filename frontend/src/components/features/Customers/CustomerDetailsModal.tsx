import { X, Building2, User, MapPin, DollarSign, Clock, CheckCircle, XCircle, Edit2, Trash2, Plus, Star } from 'lucide-react';
import { Customer, CustomerSpecialPrice } from '../../../types/inventory';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersApi, customerSpecialPricesApi } from '../../../lib/api';
import Toast from '../../common/Toast';
import EditCustomerModal from './EditCustomerModal';
import { useAuthContext } from '../../../context/AuthContext';
import { canManageCustomers } from '../../../utils/permissions';

interface CustomerDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: number | null;
  onCustomerUpdate?: (message: string) => void;
}

export default function CustomerDetailsModal({ isOpen, onClose, customerId, onCustomerUpdate }: CustomerDetailsModalProps) {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [specialPrices, setSpecialPrices] = useState<CustomerSpecialPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [specialPricesLoading, setSpecialPricesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'special-pricing'>('details');  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (isOpen && customerId) {
      fetchCustomer();
      fetchSpecialPrices();
      // Reset toast state when opening modal
      setShowToast(false);
      setToastMessage('');
    }
  }, [isOpen, customerId]);

  const fetchCustomer = async () => {
    if (!customerId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await customersApi.getById(customerId.toString());
      if (response.status === 'success' && response.data) {
        setCustomer(response.data);
      } else {
        setError('Failed to load customer details');
      }
    } catch (error) {
      console.error('Error fetching customer:', error);
      setError('An error occurred while loading customer details');
    } finally {
      setLoading(false);
    }
  };

  const fetchSpecialPrices = async () => {
    if (!customerId) return;
    
    setSpecialPricesLoading(true);
    
    try {
      const response = await customerSpecialPricesApi.getByCustomerId(customerId);
      if (response.status === 'success' && response.data) {
        setSpecialPrices(Array.isArray(response.data) ? response.data : []);
      } else {
        setSpecialPrices([]);
      }
    } catch (error) {
      console.error('Error fetching special prices:', error);
      setSpecialPrices([]);
    } finally {
      setSpecialPricesLoading(false);
    }
  };
  const handleDeleteCustomer = async () => {
    if (!customer || !canManageCustomers(user)) return;

    if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        const response = await customersApi.delete(customer.customer_id.toString());
        if (response.status === 'success') {
          setToastMessage('Customer deleted successfully');
          setToastType('success');
          setShowToast(true);
          
          if (onCustomerUpdate) {
            onCustomerUpdate('Customer deleted successfully');
          }
          
          setTimeout(() => {
            onClose();
          }, 1000);
        } else {
          setError('Failed to delete customer');
        }
      } catch (error) {
        console.error('Error deleting customer:', error);
        setError('Failed to delete customer');
      }
    }
  };
  const handleApproveSpecialPrice = async (specialPriceId: number) => {
    if (!canManageCustomers(user)) return;

    try {
      const response = await customerSpecialPricesApi.approve(specialPriceId.toString());
      if (response.status === 'success') {
        setToastMessage('Special price approved successfully');
        setToastType('success');
        setShowToast(true);
        fetchSpecialPrices();
      } else {
        setError('Failed to approve special price');
      }
    } catch (error) {
      console.error('Error approving special price:', error);
      setError('Failed to approve special price');
    }
  };
  const handleRejectSpecialPrice = async (specialPriceId: number) => {
    if (!canManageCustomers(user)) return;

    try {
      const response = await customerSpecialPricesApi.reject(specialPriceId.toString());
      if (response.status === 'success') {
        setToastMessage('Special price rejected');
        setToastType('success');
        setShowToast(true);
        fetchSpecialPrices();
      } else {
        setError('Failed to reject special price');
      }
    } catch (error) {
      console.error('Error rejecting special price:', error);
      setError('Failed to reject special price');
    }
  };

  const handleEditCustomerUpdate = (message: string) => {
    setToastMessage(message);
    setToastType('success');
    setShowToast(true);
    fetchCustomer(); // Refresh customer data
    
    if (onCustomerUpdate) {
      onCustomerUpdate(message);
    }
  };

  const getCustomerTypeColor = (type: string) => {
    const colors = {
      'International': 'bg-purple-100 text-purple-800',
      'Distributor': 'bg-blue-100 text-blue-800',
      'Physical Store': 'bg-green-100 text-green-800',
      'Reseller': 'bg-orange-100 text-orange-800',
      'Direct Customer': 'bg-gray-100 text-gray-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getPricingTierColor = (tier: string) => {
    const colors = {
      'RD': 'bg-red-100 text-red-800',
      'PD': 'bg-pink-100 text-pink-800',
      'DD': 'bg-orange-100 text-orange-800',
      'CD': 'bg-yellow-100 text-yellow-800',
      'RS': 'bg-green-100 text-green-800',
      'SUB': 'bg-blue-100 text-blue-800',
      'SRP': 'bg-gray-100 text-gray-800'
    };
    return colors[tier as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (status: string) => {
    return status === 'Active' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-red-100 text-red-800';
  };

  const getApprovalStatusIcon = (status: string) => {
    switch (status) {
      case 'Approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'Rejected':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  if (!isOpen) return null;

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
        <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          {/* Modal Header */}
          <div className="flex justify-between items-center p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Customer Details</h2>
            <button 
              onClick={onClose}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {loading ? (
            <div className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-8 bg-gray-200 rounded w-1/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              </div>
            </div>
          ) : error ? (
            <div className="p-6 text-red-600">{error}</div>
          ) : customer ? (
            <div>
              {/* Customer Header */}
              <div className="p-6 space-y-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{customer.company_name}</h1>
                    <p className="text-gray-600 mt-1">{customer.contact_person}</p>
                  </div>
                    {canManageCustomers(user) && (
                    <div className="flex gap-3 mt-4 lg:mt-0">                      <button
                        onClick={() => setShowEditModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit
                      </button>
                      <button
                        onClick={handleDeleteCustomer}
                        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {/* Status and Type Badges */}
                <div className="flex flex-wrap gap-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(customer.status)}`}>
                    {customer.status}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getCustomerTypeColor(customer.customer_type)}`}>
                    {customer.customer_type}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPricingTierColor(customer.pricing_tier)}`}>
                    {customer.pricing_tier}
                  </span>
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200">
                <div className="px-6">
                  <nav className="flex space-x-8">
                    <button
                      onClick={() => setActiveTab('details')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm ${
                        activeTab === 'details'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Details
                    </button>
                    <button
                      onClick={() => setActiveTab('special-pricing')}
                      className={`py-4 px-1 border-b-2 font-medium text-sm ${
                        activeTab === 'special-pricing'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Special Pricing
                      {Array.isArray(specialPrices) && specialPrices.filter(sp => sp.approval_status === 'Pending').length > 0 && (
                        <span className="ml-2 bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full">
                          {specialPrices.filter(sp => sp.approval_status === 'Pending').length}
                        </span>
                      )}
                    </button>
                  </nav>
                </div>
              </div>

              {/* Tab Content */}
              <div className="p-6">
                {activeTab === 'details' ? (
                  <div className="space-y-6">
                    {/* Customer Information */}
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <Building2 className="h-5 w-5 text-blue-600" />
                        <h3 className="font-medium text-gray-900">Company Information</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 ml-7">
                        <div>
                          <div className="text-sm text-gray-600 mb-1.5">Company Name</div>
                          <div className="text-sm text-gray-900">{customer.company_name}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600 mb-1.5">TIN ID</div>
                          <div className="text-sm text-gray-900">{customer.tin_id || 'Not specified'}</div>
                        </div>
                      </div>
                    </div>

                    {/* Contact Information */}
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <User className="h-5 w-5 text-blue-600" />
                        <h3 className="font-medium text-gray-900">Contact Information</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 ml-7">
                        <div>
                          <div className="text-sm text-gray-600 mb-1.5">Contact Person</div>
                          <div className="text-sm text-gray-900">{customer.contact_person}</div>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600 mb-1.5">Contact Number</div>
                          <div className="text-sm text-gray-900">{customer.contact_number}</div>
                        </div>
                      </div>
                    </div>

                    {/* Address Information */}
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <MapPin className="h-5 w-5 text-blue-600" />
                        <h3 className="font-medium text-gray-900">Address</h3>
                      </div>
                      
                      <div className="ml-7">
                        <div className="text-sm text-gray-900">{customer.address || 'No address specified'}</div>
                      </div>
                    </div>

                    {/* Pricing Information */}
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <DollarSign className="h-5 w-5 text-blue-600" />
                        <h3 className="font-medium text-gray-900">Pricing Information</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 ml-7">
                        <div>
                          <div className="text-sm text-gray-600 mb-1.5">Customer Type</div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCustomerTypeColor(customer.customer_type)}`}>
                            {customer.customer_type}
                          </span>
                        </div>
                        <div>
                          <div className="text-sm text-gray-600 mb-1.5">Pricing Tier</div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPricingTierColor(customer.pricing_tier)}`}>
                            {customer.pricing_tier}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Timestamps */}
                    <div>
                      <div className="flex items-center gap-2 mb-4">
                        <Clock className="h-5 w-5 text-blue-600" />
                        <h3 className="font-medium text-gray-900">Timeline</h3>
                      </div>
                        <div className="ml-7">
                        <div>
                          <div className="text-sm text-gray-600 mb-1.5">Created</div>
                          <div className="text-sm text-gray-900">{formatDate(customer.created_at)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Special Pricing Tab */
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Star className="h-5 w-5 text-blue-600" />
                        <h3 className="font-medium text-gray-900">Special Pricing</h3>
                      </div>
                        {canManageCustomers(user) && (
                        <button
                          onClick={() => {
                            onClose();
                            navigate(`/customers/${customer.customer_id}/special-pricing/add`);
                          }}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Add Special Price
                        </button>
                      )}
                    </div>

                    <div className="overflow-x-auto">
                      {specialPricesLoading ? (
                        <div className="p-8 text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                          <p className="mt-2 text-gray-600">Loading special prices...</p>
                        </div>
                      ) : !Array.isArray(specialPrices) || specialPrices.length === 0 ? (
                        <div className="p-8 text-center">
                          <Star className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600">No special prices configured for this customer.</p>
                        </div>
                      ) : (
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Item
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Standard Price
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Special Price
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Discount
                              </th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                              </th>                              {canManageCustomers(user) && (
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Actions
                                </th>
                              )}
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {Array.isArray(specialPrices) && specialPrices.map((specialPrice) => {
                              const discount = specialPrice.standard_price > 0 
                                ? ((specialPrice.standard_price - specialPrice.special_price) / specialPrice.standard_price * 100).toFixed(1)
                                : '0';
                              
                              return (
                                <tr key={specialPrice.id} className="hover:bg-gray-50">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">
                                      {specialPrice.item_name}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      SKU: {specialPrice.item_sku}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    ₱{specialPrice.standard_price?.toFixed(2) || '0.00'}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    ₱{specialPrice.special_price.toFixed(2)}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                    {discount}%
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                      {getApprovalStatusIcon(specialPrice.approval_status)}
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        specialPrice.approval_status === 'Approved' ? 'bg-green-100 text-green-800' :
                                        specialPrice.approval_status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                        'bg-yellow-100 text-yellow-800'
                                      }`}>
                                        {specialPrice.approval_status}
                                      </span>
                                    </div>
                                  </td>                                  {canManageCustomers(user) && (
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                      {specialPrice.approval_status === 'Pending' && (
                                        <div className="flex items-center gap-2">
                                          <button
                                            onClick={() => handleApproveSpecialPrice(specialPrice.id)}
                                            className="text-green-600 hover:text-green-900"
                                          >
                                            <CheckCircle className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() => handleRejectSpecialPrice(specialPrice.id)}
                                            className="text-red-600 hover:text-red-900"
                                          >
                                            <XCircle className="w-4 h-4" />
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 text-gray-600">No customer details available</div>
          )}
        </div>
      </div>

      {/* EditCustomerModal */}
      {customer && (
        <EditCustomerModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          customer={customer}
          onCustomerUpdated={handleEditCustomerUpdate}
        />
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
