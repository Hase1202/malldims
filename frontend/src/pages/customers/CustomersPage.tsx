import { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { customersApi } from '../../lib/api';
import { Customer } from '../../types/inventory';
import Sidebar from '../../components/common/Sidebar';
import CustomerDetailsModal from '../../components/features/Customers/CustomerDetailsModal';
import AddCustomerModal from '../../components/features/Customers/AddCustomerModal';
import { Menu, Plus, Search } from 'lucide-react';
import { useAuthContext } from '../../context/AuthContext';
import { canManageCustomers } from '../../utils/permissions';

const CustomersPage = () => {
  const { user } = useAuthContext();const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [customerTypeFilter, setCustomerTypeFilter] = useState<string>('');  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, [currentPage, searchTerm, customerTypeFilter, statusFilter]);

  const fetchCustomers = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        search: searchTerm
      });

      if (customerTypeFilter) {
        params.append('customer_type', customerTypeFilter);
      }

      if (statusFilter) {
        params.append('status', statusFilter);
      }

      const response = await customersApi.getAll(params);
      
      if (response.status === 'success' && response.data) {
        let customersData: Customer[] = [];
        let pagination = { count: 0, next: null as string | null, previous: null as string | null };

        if (typeof response.data === 'object' && 'results' in response.data) {
          const paginatedData = response.data as { results: Customer[], count: number, next: string | null, previous: string | null };
          customersData = paginatedData.results;
          pagination = {
            count: paginatedData.count,
            next: paginatedData.next,
            previous: paginatedData.previous
          };
        } else if (Array.isArray(response.data)) {
          customersData = response.data;
        }

        setCustomers(customersData);
        
        if (pagination.count > 0) {
          setTotalPages(Math.ceil(pagination.count / 10));
        }
      } else {
        console.error('Failed to fetch customers:', response.message);
        toast.error('Failed to load customers');
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }  };

  const getCustomerTypeColor = (type: string) => {
    switch (type) {
      case 'International':
        return 'bg-purple-50 text-purple-800';
      case 'Distributor':
        return 'bg-blue-50 text-blue-800';
      case 'Physical Store':
        return 'bg-green-50 text-green-800';
      case 'Reseller':
        return 'bg-orange-50 text-orange-800';
      case 'Direct Customer':
        return 'bg-gray-50 text-gray-800';
      default:
        return 'bg-gray-50 text-gray-800';
    }
  };

  const handleCustomerModalClose = () => {
    setShowCustomerModal(false);
    setSelectedCustomerId(null);
  };
  const handleCustomerUpdate = (message: string) => {
    toast.success(message);
    fetchCustomers(); // Refresh the list
  };

  const handleAddCustomerSuccess = (message: string) => {
    toast.success(message);
    fetchCustomers(); // Refresh the list
    setShowAddCustomerModal(false);
  };

  if (loading && customers.length === 0) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <div className="flex-1 lg:ml-64 p-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="w-full h-full overflow-y-auto p-4 lg:p-8 lg:ml-64">
        {/* Mobile Header with Menu Button */}
        <div className="flex lg:hidden items-center mb-4">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-1 hover:bg-gray-100 rounded-lg"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#2C2C2C] mb-2">Customer Management</h1>
            <p className="text-[#646464]">Manage your customer database and special pricing</p>
          </div>          {canManageCustomers(user) && (
            <button
              onClick={() => setShowAddCustomerModal(true)}
              className="mt-4 lg:mt-0 bg-[#0504AA] text-white px-4 py-2 rounded-lg hover:bg-[#0504AA]/90 flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Customer
            </button>
          )}
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-[#0504AA]"
            />
          </div>
          
          <select
            value={customerTypeFilter}
            onChange={(e) => setCustomerTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0504AA]"
          >
            <option value="">All Types</option>
            <option value="International">International</option>
            <option value="Distributor">Distributor</option>
            <option value="Physical Store">Physical Store</option>
            <option value="Reseller">Reseller</option>
            <option value="Direct Customer">Direct Customer</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0504AA]"
          >
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Archived">Archived</option>
          </select>
        </div>

        {/* Customers Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left p-4 font-medium text-gray-700">Company</th>
                  <th className="text-left p-4 font-medium text-gray-700">Contact Person</th>
                  <th className="text-left p-4 font-medium text-gray-700">Type</th>
                  <th className="text-left p-4 font-medium text-gray-700">Platform</th>
                  <th className="text-left p-4 font-medium text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr 
                    key={customer.customer_id} 
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedCustomerId(customer.customer_id);
                      setShowCustomerModal(true);
                    }}
                  >
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-gray-900">{customer.company_name}</p>
                        <p className="text-sm text-gray-500">{customer.tin_id || 'No TIN'}</p>
                      </div>
                    </td>
                    <td className="p-4 text-gray-700">{customer.contact_person}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCustomerTypeColor(customer.customer_type)}`}>
                        {customer.customer_type}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="capitalize px-2 py-1 bg-blue-50 text-blue-800 rounded-full text-xs font-medium">
                        {customer.platform?.replace('_', ' ') || 'Not set'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        customer.status === 'Active' ? 'bg-green-50 text-green-800' : 'bg-gray-50 text-gray-800'
                      }`}>
                        {customer.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {customers.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-gray-500">No customers found</p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-6">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>          </div>        )}
      </div>      {/* Customer Details Modal */}
      <CustomerDetailsModal
        isOpen={showCustomerModal}
        onClose={handleCustomerModalClose}
        customerId={selectedCustomerId}
        onCustomerUpdate={handleCustomerUpdate}
      />

      {/* Add Customer Modal */}
      <AddCustomerModal
        isOpen={showAddCustomerModal}
        onClose={() => setShowAddCustomerModal(false)}
        onCustomerAdded={handleAddCustomerSuccess}
      />
    </div>
  );
};

export default CustomersPage;
