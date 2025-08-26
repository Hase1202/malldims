import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { customersApi } from '../../lib/api';
import Sidebar from '../../components/common/Sidebar';
import { ArrowLeft, Menu, AlertCircle } from 'lucide-react';
import { useAuthContext } from '../../context/AuthContext';
import { isInventoryManager } from '../../utils/permissions';

interface FormData {
  company_name: string;
  contact_person: string;
  address: string;
  contact_number: string;
  tin_id: string;
  customer_type: string;
  pricing_tier: string;
  status: string;
}

interface FormErrors {
  company_name?: string;
  contact_person?: string;
  address?: string;
  contact_number?: string;
  customer_type?: string;
  pricing_tier?: string;
}

const AddCustomerPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const [formData, setFormData] = useState<FormData>({
    company_name: '',
    contact_person: '',
    address: '',
    contact_number: '',
    tin_id: '',
    customer_type: 'Direct Customer',
    pricing_tier: 'SRP',
    status: 'Active'
  });
  // Redirect if not inventory manager
  if (!isInventoryManager(user)) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <div className="flex-1 lg:ml-64 p-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to add customers.</p>
            <button
              onClick={() => navigate('/customers')}
              className="mt-4 bg-[#0504AA] text-white px-4 py-2 rounded-lg hover:bg-[#0504AA]/90"
            >
              Back to Customers
            </button>
          </div>
        </div>
      </div>
    );
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

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
    } else if (!/^[\d\s\-\+\(\)]+$/.test(formData.contact_number)) {
      newErrors.contact_number = 'Invalid contact number format';
    }

    if (!formData.customer_type) {
      newErrors.customer_type = 'Customer type is required';
    }

    if (!formData.pricing_tier) {
      newErrors.pricing_tier = 'Pricing tier is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors before submitting');
      return;
    }

    setIsLoading(true);

    try {
      const response = await customersApi.create(formData);

      if (response.status === 'success') {
        toast.success('Customer added successfully!');
        navigate('/customers');
      } else {
        toast.error(response.message || 'Failed to add customer');
      }
    } catch (error) {
      console.error('Error adding customer:', error);
      toast.error('An error occurred while adding the customer');
    } finally {
      setIsLoading(false);
    }
  };

  const renderFieldError = (fieldName: keyof FormErrors) => {
    if (errors[fieldName]) {
      return (
        <div className="flex items-center gap-1 text-[#D3465C] text-sm mt-1">
          <AlertCircle className="h-4 w-4" />
          <span>{errors[fieldName]}</span>
        </div>
      );
    }
    return null;
  };

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

        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center mb-8">
            <button
              onClick={() => navigate('/customers')}
              className="text-[#646464] hover:text-[#2C2C2C] transition-colors mr-3"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-[#2C2C2C]">Add New Customer</h1>
              <p className="text-[#646464] mt-1">Create a new customer profile with contact and pricing information</p>
            </div>
          </div>

          {/* Form */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-lg font-medium text-[#2C2C2C] mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                      Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="company_name"
                      value={formData.company_name}
                      onChange={handleChange}
                      className={`w-full p-3 border-[1.5px] ${
                        errors.company_name ? 'border-[#D3465C]' : 'border-[#D5D7DA]'
                      } rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0504AA] focus:border-transparent`}
                      placeholder="Enter company name"
                    />
                    {renderFieldError('company_name')}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                      Contact Person <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="contact_person"
                      value={formData.contact_person}
                      onChange={handleChange}
                      className={`w-full p-3 border-[1.5px] ${
                        errors.contact_person ? 'border-[#D3465C]' : 'border-[#D5D7DA]'
                      } rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0504AA] focus:border-transparent`}
                      placeholder="Enter contact person name"
                    />
                    {renderFieldError('contact_person')}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    rows={3}
                    className={`w-full p-3 border-[1.5px] ${
                      errors.address ? 'border-[#D3465C]' : 'border-[#D5D7DA]'
                    } rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0504AA] focus:border-transparent`}
                    placeholder="Enter complete address"
                  />
                  {renderFieldError('address')}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                      Contact Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="contact_number"
                      value={formData.contact_number}
                      onChange={handleChange}
                      className={`w-full p-3 border-[1.5px] ${
                        errors.contact_number ? 'border-[#D3465C]' : 'border-[#D5D7DA]'
                      } rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0504AA] focus:border-transparent`}
                      placeholder="Enter contact number"
                    />
                    {renderFieldError('contact_number')}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                      TIN ID
                    </label>
                    <input
                      type="text"
                      name="tin_id"
                      value={formData.tin_id}
                      onChange={handleChange}
                      className="w-full p-3 border-[1.5px] border-[#D5D7DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0504AA] focus:border-transparent"
                      placeholder="Enter TIN ID (optional)"
                    />
                  </div>
                </div>
              </div>

              {/* Business Information */}
              <div>
                <h3 className="text-lg font-medium text-[#2C2C2C] mb-4">Business Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                      Customer Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="customer_type"
                      value={formData.customer_type}
                      onChange={handleChange}
                      className={`w-full p-3 border-[1.5px] ${
                        errors.customer_type ? 'border-[#D3465C]' : 'border-[#D5D7DA]'
                      } rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0504AA] focus:border-transparent`}
                    >
                      <option value="International">International</option>
                      <option value="Distributor">Distributor</option>
                      <option value="Physical Store">Physical Store</option>
                      <option value="Reseller">Reseller</option>
                      <option value="Direct Customer">Direct Customer</option>
                    </select>
                    {renderFieldError('customer_type')}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                      Pricing Tier <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="pricing_tier"
                      value={formData.pricing_tier}
                      onChange={handleChange}
                      className={`w-full p-3 border-[1.5px] ${
                        errors.pricing_tier ? 'border-[#D3465C]' : 'border-[#D5D7DA]'
                      } rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0504AA] focus:border-transparent`}
                    >
                      <option value="RD">Regional Distributor (RD)</option>
                      <option value="PD">Provincial Distributor (PD)</option>
                      <option value="DD">District Distributor (DD)</option>
                      <option value="CD">City Distributor (CD)</option>
                      <option value="RS">Reseller (RS)</option>
                      <option value="SUB">Sub-Reseller (SUB)</option>
                      <option value="SRP">Suggested Retail Price (SRP)</option>
                    </select>
                    {renderFieldError('pricing_tier')}
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                    Status
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="w-full p-3 border-[1.5px] border-[#D5D7DA] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0504AA] focus:border-transparent"
                  >
                    <option value="Active">Active</option>
                    <option value="Archived">Archived</option>
                  </select>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => navigate('/customers')}
                  className="w-full sm:w-auto px-6 py-3 text-[#646464] border border-[#D5D7DA] rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full sm:w-auto px-6 py-3 bg-[#0504AA] text-white rounded-lg hover:bg-[#0504AA]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Adding Customer...' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddCustomerPage;