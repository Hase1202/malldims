import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { customersApi } from '../../lib/api';
import Sidebar from '../../components/common/Sidebar';
import { Menu, ArrowLeft, Save } from 'lucide-react';
import { useAuthContext } from '../../context/AuthContext';
import { isInventoryManager } from '../../utils/permissions';

const EditCustomerPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    company_name: '',
    contact_person: '',
    address: '',
    contact_number: '',
    tin_id: '',
    customer_type: 'Direct Customer',
    pricing_tier: 'SRP',
    status: 'Active'
  });

  useEffect(() => {
    if (!isInventoryManager(user)) {
      toast.error('You do not have permission to edit customers');
      navigate('/customers');
      return;
    }

    if (id) {
      fetchCustomer();
    }
  }, [id, user, navigate]);

  const fetchCustomer = async () => {
    try {
      const response = await customersApi.getById(id!);
      const customer = response.data;
      setFormData({
        company_name: customer.company_name,
        contact_person: customer.contact_person,
        address: customer.address,
        contact_number: customer.contact_number,
        tin_id: customer.tin_id || '',
        customer_type: customer.customer_type,
        pricing_tier: customer.pricing_tier,
        status: customer.status
      });
    } catch (error) {
      console.error('Error fetching customer:', error);
      toast.error('Failed to fetch customer details');
      navigate('/customers');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.company_name.trim()) {
      newErrors.company_name = 'Company name is required';
    }

    if (!formData.contact_person.trim()) {
      newErrors.contact_person = 'Contact person is required';
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }

    if (!formData.contact_number.trim()) {
      newErrors.contact_number = 'Contact number is required';
    }

    // Validate phone number format (Philippine format)
    const phoneRegex = /^(\+63|0)?[0-9]{10,11}$/;
    if (formData.contact_number && !phoneRegex.test(formData.contact_number.replace(/\s|-/g, ''))) {
      newErrors.contact_number = 'Please enter a valid Philippine phone number';
    }

    // Validate TIN ID format if provided (XXX-XXX-XXX-XXX)
    if (formData.tin_id && !/^\d{3}-\d{3}-\d{3}-\d{3}$/.test(formData.tin_id)) {
      newErrors.tin_id = 'TIN ID must be in format XXX-XXX-XXX-XXX';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setSaving(true);
    try {
      await customersApi.update(id!, formData);
      toast.success('Customer updated successfully');
      navigate(`/customers/${id}`);
    } catch (error: any) {
      console.error('Error updating customer:', error);
      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Failed to update customer');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
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
                  onClick={() => navigate(`/customers/${id}`)}
                  className="flex items-center text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Back to Customer Details
                </button>
                
                <h1 className="text-2xl font-bold text-gray-900">Edit Customer</h1>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Company Name */}
                <div className="md:col-span-2">
                  <label htmlFor="company_name" className="block text-sm font-medium text-gray-700 mb-2">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    id="company_name"
                    name="company_name"
                    value={formData.company_name}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.company_name ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter company name"
                  />
                  {errors.company_name && (
                    <p className="text-red-500 text-sm mt-1">{errors.company_name}</p>
                  )}
                </div>

                {/* Contact Person */}
                <div>
                  <label htmlFor="contact_person" className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Person *
                  </label>
                  <input
                    type="text"
                    id="contact_person"
                    name="contact_person"
                    value={formData.contact_person}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.contact_person ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter contact person name"
                  />
                  {errors.contact_person && (
                    <p className="text-red-500 text-sm mt-1">{errors.contact_person}</p>
                  )}
                </div>

                {/* Contact Number */}
                <div>
                  <label htmlFor="contact_number" className="block text-sm font-medium text-gray-700 mb-2">
                    Contact Number *
                  </label>
                  <input
                    type="tel"
                    id="contact_number"
                    name="contact_number"
                    value={formData.contact_number}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.contact_number ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="e.g., +63 912 345 6789"
                  />
                  {errors.contact_number && (
                    <p className="text-red-500 text-sm mt-1">{errors.contact_number}</p>
                  )}
                </div>

                {/* Address */}
                <div className="md:col-span-2">
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                    Address *
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    rows={3}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.address ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter complete address"
                  />
                  {errors.address && (
                    <p className="text-red-500 text-sm mt-1">{errors.address}</p>
                  )}
                </div>

                {/* TIN ID */}
                <div>
                  <label htmlFor="tin_id" className="block text-sm font-medium text-gray-700 mb-2">
                    TIN ID
                  </label>
                  <input
                    type="text"
                    id="tin_id"
                    name="tin_id"
                    value={formData.tin_id}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.tin_id ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="XXX-XXX-XXX-XXX"
                  />
                  {errors.tin_id && (
                    <p className="text-red-500 text-sm mt-1">{errors.tin_id}</p>
                  )}
                </div>

                {/* Customer Type */}
                <div>
                  <label htmlFor="customer_type" className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Type *
                  </label>
                  <select
                    id="customer_type"
                    name="customer_type"
                    value={formData.customer_type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="International">International</option>
                    <option value="Distributor">Distributor</option>
                    <option value="Physical Store">Physical Store</option>
                    <option value="Reseller">Reseller</option>
                    <option value="Direct Customer">Direct Customer</option>
                  </select>
                </div>

                {/* Pricing Tier */}
                <div>
                  <label htmlFor="pricing_tier" className="block text-sm font-medium text-gray-700 mb-2">
                    Pricing Tier *
                  </label>
                  <select
                    id="pricing_tier"
                    name="pricing_tier"
                    value={formData.pricing_tier}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="SRP">SRP</option>
                    <option value="Distributor">Distributor</option>
                    <option value="Dealer">Dealer</option>
                    <option value="VIP">VIP</option>
                  </select>
                </div>

                {/* Status */}
                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-2">
                    Status *
                  </label>
                  <select
                    id="status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-4 mt-8 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => navigate(`/customers/${id}`)}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EditCustomerPage;
