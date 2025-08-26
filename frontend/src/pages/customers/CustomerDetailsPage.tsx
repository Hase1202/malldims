import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { customersApi, customerSpecialPricesApi } from '../../lib/api';
import { Customer, CustomerSpecialPrice } from '../../types/inventory';
import Sidebar from '../../components/common/Sidebar';
import { 
  Menu, 
  ArrowLeft, 
  Edit2, 
  Trash2, 
  Plus, 
  Star,
  Building2,
  User,
  MapPin,
  FileText,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

const CustomerDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [specialPrices, setSpecialPrices] = useState<CustomerSpecialPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [specialPricesLoading, setSpecialPricesLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'special-pricing'>('details');

  useEffect(() => {
    if (id) {
      fetchCustomer();
      fetchSpecialPrices();
    }
  }, [id]);  const fetchCustomer = async () => {
    try {
      const response = await customersApi.getById(id!);
      if (response.status === 'success' && response.data) {
        setCustomer(response.data);
      } else {
        console.error('Failed to fetch customer:', response.message);
        toast.error(response.message || 'Failed to fetch customer details');
        navigate('/customers');
      }
    } catch (error) {
      console.error('Error fetching customer:', error);
      toast.error('Failed to fetch customer details');
      navigate('/customers');
    } finally {
      setLoading(false);
    }
  };  const fetchSpecialPrices = async () => {
    try {
      const response = await customerSpecialPricesApi.getByCustomerId(parseInt(id!));
      if (response.status === 'success' && response.data) {
        setSpecialPrices(Array.isArray(response.data) ? response.data : []);
      } else {
        console.error('Failed to fetch special prices:', response.message);
        setSpecialPrices([]);
        toast.error('Failed to fetch special prices');
      }
    } catch (error) {
      console.error('Error fetching special prices:', error);
      setSpecialPrices([]);
      toast.error('Failed to fetch special prices');
    } finally {
      setSpecialPricesLoading(false);
    }
  };  const handleDeleteCustomer = async () => {
    if (!customer) return;

    if (window.confirm('Are you sure you want to delete this customer?')) {
      try {
        const response = await customersApi.delete(customer.customer_id.toString());
        if (response.status === 'success') {
          toast.success('Customer deleted successfully');
          navigate('/customers');
        } else {
          toast.error(response.message || 'Failed to delete customer');
        }
      } catch (error) {
        console.error('Error deleting customer:', error);
        toast.error('Failed to delete customer');
      }
    }
  };const handleApproveSpecialPrice = async (specialPriceId: number) => {
    try {
      const response = await customerSpecialPricesApi.approve(specialPriceId.toString());
      if (response.status === 'success') {
        toast.success('Special price approved successfully');
        fetchSpecialPrices();
      } else {
        toast.error(response.message || 'Failed to approve special price');
      }
    } catch (error) {
      console.error('Error approving special price:', error);
      toast.error('Failed to approve special price');
    }
  };
  const handleRejectSpecialPrice = async (specialPriceId: number) => {
    try {
      const response = await customerSpecialPricesApi.reject(specialPriceId.toString());
      if (response.status === 'success') {
        toast.success('Special price rejected');
        fetchSpecialPrices();
      } else {
        toast.error(response.message || 'Failed to reject special price');
      }
    } catch (error) {
      console.error('Error rejecting special price:', error);
      toast.error('Failed to reject special price');
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
      'SRP': 'bg-red-100 text-red-800',
      'Distributor': 'bg-blue-100 text-blue-800',
      'Dealer': 'bg-green-100 text-green-800',
      'VIP': 'bg-purple-100 text-purple-800'
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
  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className="flex-1 overflow-auto">
          <div className="p-8">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded mb-4"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }
  if (!customer) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className="flex-1 overflow-auto">
          <div className="p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Customer Not Found</h2>
              <button
                onClick={() => navigate('/customers')}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Back to Customers
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-white shadow-sm">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button 
                  className="md:hidden p-2 rounded-lg hover:bg-gray-100"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                >
                  <Menu className="w-6 h-6" />
                </button>
                
                <button
                  onClick={() => navigate('/customers')}
                  className="flex items-center text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Back to Customers
                </button>
                
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{customer.company_name}</h1>
                  <p className="text-gray-600">{customer.contact_person}</p>
                </div>              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => navigate(`/customers/${customer.customer_id}/edit`)}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit
                </button>
                
                <button
                  onClick={handleDeleteCustomer}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </button>
              </div>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="border-t border-gray-200">
            <nav className="px-6">
              <div className="flex space-x-8">
                <button
                  onClick={() => setActiveTab('details')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'details'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Customer Details
                </button>
                
                <button
                  onClick={() => setActiveTab('special-pricing')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'special-pricing'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}                >
                  Special Pricing
                  {Array.isArray(specialPrices) && specialPrices.filter(sp => sp.approval_status === 'Pending').length > 0 && (
                    <span className="ml-2 bg-red-100 text-red-600 text-xs px-2 py-1 rounded-full">
                      {specialPrices.filter(sp => sp.approval_status === 'Pending').length}
                    </span>
                  )}
                </button>
              </div>
            </nav>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'details' && (
            <div className="max-w-4xl mx-auto">
              {/* Customer Information Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {/* Basic Info Card */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center mb-4">
                    <Building2 className="w-5 h-5 text-gray-400 mr-2" />
                    <h3 className="font-semibold text-gray-900">Company Information</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-500">Company Name</span>
                      <p className="font-medium">{customer.company_name}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">TIN ID</span>
                      <p className="font-medium">{customer.tin_id || 'Not provided'}</p>
                    </div>
                  </div>
                </div>

                {/* Contact Info Card */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center mb-4">
                    <User className="w-5 h-5 text-gray-400 mr-2" />
                    <h3 className="font-semibold text-gray-900">Contact Information</h3>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <span className="text-sm text-gray-500">Contact Person</span>
                      <p className="font-medium">{customer.contact_person}</p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Phone Number</span>
                      <p className="font-medium">{customer.contact_number}</p>
                    </div>
                  </div>
                </div>

                {/* Address Card */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center mb-4">
                    <MapPin className="w-5 h-5 text-gray-400 mr-2" />
                    <h3 className="font-semibold text-gray-900">Address</h3>
                  </div>
                  <p className="text-gray-700">{customer.address}</p>
                </div>
              </div>

              {/* Status and Type Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center mb-4">
                    <FileText className="w-5 h-5 text-gray-400 mr-2" />
                    <h3 className="font-semibold text-gray-900">Customer Type</h3>
                  </div>
                  <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getCustomerTypeColor(customer.customer_type)}`}>
                    {customer.customer_type}
                  </span>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center mb-4">
                    <DollarSign className="w-5 h-5 text-gray-400 mr-2" />
                    <h3 className="font-semibold text-gray-900">Pricing Tier</h3>
                  </div>
                  <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getPricingTierColor(customer.pricing_tier)}`}>
                    {customer.pricing_tier}
                  </span>
                </div>

                <div className="bg-white rounded-lg shadow-sm p-6">
                  <div className="flex items-center mb-4">
                    <AlertCircle className="w-5 h-5 text-gray-400 mr-2" />
                    <h3 className="font-semibold text-gray-900">Status</h3>
                  </div>
                  <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(customer.status)}`}>
                    {customer.status}
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'special-pricing' && (
            <div className="max-w-6xl mx-auto">
              <div className="bg-white rounded-lg shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200">                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Special Pricing</h3>
                    <button
                      onClick={() => navigate(`/customers/${customer.customer_id}/special-pricing/add`)}
                      className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Special Price
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  {specialPricesLoading ? (
                    <div className="p-8 text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600">Loading special prices...</p>
                    </div>                  ) : !Array.isArray(specialPrices) || specialPrices.length === 0 ? (
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
                            Special Price
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Standard Price
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Discount
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Requested By
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>                      <tbody className="bg-white divide-y divide-gray-200">
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
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">
                                  ₱{specialPrice.special_price.toFixed(2)}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  ₱{specialPrice.standard_price.toFixed(2)}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-green-600 font-medium">
                                  {discount}% off
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  {getApprovalStatusIcon(specialPrice.approval_status)}
                                  <span className="ml-2 text-sm text-gray-900">
                                    {specialPrice.approval_status}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {specialPrice.requested_by_name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {new Date(specialPrice.created_at).toLocaleDateString()}
                                </div>
                              </td>                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                {specialPrice.approval_status === 'Pending' && (
                                  <div className="flex space-x-2">
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
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CustomerDetailsPage;
