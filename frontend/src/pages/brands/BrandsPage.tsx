import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { brandsApi } from '../../lib/api';
import { Brand } from '../../types/inventory';
import Sidebar from '../../components/common/Sidebar';
import { Menu } from 'lucide-react';
import { refreshBrandsGlobally } from '../../hooks/useBrands';

const BrandsPage = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showItemsModal, setShowItemsModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [viewingBrandItems, setViewingBrandItems] = useState<Brand | null>(null);
  const [brandItems, setBrandItems] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [expandedItem, setExpandedItem] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    brand_name: '',
    contact_person: '',
    mobile_number: '',
    email: '',
    street_name: '',
    city: '',
    region: '',
    tin: '',
    vat_classification: 'VAT',
    status: 'Active'
  });

  useEffect(() => {
    fetchBrands();
  }, [currentPage, searchTerm]);

  const fetchBrands = async () => {
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        search: searchTerm
      });

      console.log('Fetching brands with params:', params.toString());

      const response = await brandsApi.getAll(params);
      
      console.log('Full API response:', response);
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);

      if (response.status === 'success' && response.data) {
        if (Array.isArray(response.data)) {
          console.log('Array response, brands count:', response.data.length);
          setBrands(response.data);
          setTotalPages(1);
        } else {
          const paginatedData = response.data as { results: Brand[]; count: number };
          console.log('Paginated response, brands count:', paginatedData.results?.length, 'total:', paginatedData.count);
          setBrands(paginatedData.results || []);
          setTotalPages(Math.ceil((paginatedData.count || 0) / 10));
        }
      } else {
        console.log('API response failed:', response.message);
        toast.error(response.message || 'Failed to fetch brands');
        setBrands([]);
      }
    } catch (error) {
      console.error('Error fetching brands:', error);
      toast.error('Error loading brands');
      setBrands([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let response;
      
      console.log('Submitting form data:', formData);
      
      if (editingBrand) {
        response = await brandsApi.update(editingBrand.brand_id.toString(), formData);
      } else {
        response = await brandsApi.create(formData);
      }

      console.log('Create/Update response:', response);

      if (response.status === 'success') {
        toast.success(`Brand ${editingBrand ? 'updated' : 'created'} successfully!`);
        setShowModal(false);
        resetForm();
        
        console.log('Fetching brands after creation...');
        await fetchBrands();
        // Also refresh global brands state
        await refreshBrandsGlobally();
      } else {
        toast.error(response.message || 'Failed to save brand');
      }
    } catch (error) {
      console.error('Error saving brand:', error);
      toast.error('Error saving brand');
    }
  };

  const handleEdit = (brand: Brand) => {
    setEditingBrand(brand);
    setFormData({
      brand_name: brand.brand_name || '',
      contact_person: brand.contact_person || '',
      mobile_number: brand.mobile_number || '',
      email: brand.email || '',
      street_name: brand.street_name || '',
      city: brand.city || '',
      region: brand.region || '',
      tin: brand.tin || '',
      vat_classification: brand.vat_classification || 'VAT',
      status: brand.status || 'Active'
    });
    setShowModal(true);
  };

  const handleViewItems = async (brand: Brand) => {
    setViewingBrandItems(brand);
    setShowItemsModal(true);
    
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/items/?brand=${brand.brand_id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setBrandItems(data.results || data);
      } else {
        console.error('Failed to fetch brand items');
        setBrandItems([]);
      }
    } catch (error) {
      console.error('Error fetching brand items:', error);
      setBrandItems([]);
    }
  };

  const handleDelete = async () => {
    if (!editingBrand) return;
    
    if (window.confirm(`Are you sure you want to delete the brand "${editingBrand.brand_name}"?`)) {
      try {
        const response = await brandsApi.delete(editingBrand.brand_id.toString());
        
        if (response.status === 'success') {
          toast.success('Brand deleted successfully!');
          setShowModal(false);
          resetForm();
          // Refresh local brands
          await fetchBrands();
          // Also refresh global brands state to update other components
          await refreshBrandsGlobally();
        } else {
          toast.error(response.message || 'Failed to delete brand');
        }
      } catch (error) {
        console.error('Error deleting brand:', error);
        toast.error('Error deleting brand');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      brand_name: '',
      contact_person: '',
      mobile_number: '',
      email: '',
      street_name: '',
      city: '',
      region: '',
      tin: '',
      vat_classification: 'VAT',
      status: 'Active'
    });
    setEditingBrand(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen overflow-hidden">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <div className="flex-1 bg-[#F9F9F9] overflow-y-auto lg:ml-64">
          <div className="flex flex-col items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-16 w-16 border-[3px] border-[#DADAF3] border-t-[#0504AA]"></div>
            <p className="mt-4 text-[#2C2C2C] font-medium">Loading brands...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex-1 space-y-6 lg:space-y-10 p-4 lg:p-8 overflow-y-auto pb-12 lg:ml-64">
        <div className="flex lg:hidden items-center mb-4">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-1 hover:bg-gray-100 rounded-lg"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#2C2C2C] flex items-center">
                <div className="w-8 h-8 bg-gradient-to-r from-pink-400 to-purple-500 rounded-lg flex items-center justify-center mr-3">
                  <span className="text-white font-bold text-sm">🏷️</span>
                </div>
                Beauty Brands Management
              </h1>
              <p className="text-[#646464] mt-1">Manage your beauty product brands</p>
            </div>
            <button 
              className="bg-[#0504AA] hover:bg-[#0504AA]/90 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
            >
              Add New Brand
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="max-w-md">
            <input
              type="text"
              placeholder="Search brands..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-[#EBEAEA] rounded-lg focus:ring-2 focus:ring-[#0504AA] focus:border-transparent bg-white"
            />
          </div>
        </section>

        <section className="space-y-6">
          {brands.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🏷️</span>
              </div>
              <h3 className="text-lg font-medium text-[#2C2C2C] mb-2">No brands found</h3>
              <p className="text-[#646464] mb-6">
                {searchTerm ? 'No brands match your search criteria.' : 'Get started by adding your first brand.'}
              </p>
              {!searchTerm && (
                <button 
                  className="bg-[#0504AA] hover:bg-[#0504AA]/90 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                  onClick={() => {
                    resetForm();
                    setShowModal(true);
                  }}
                >
                  Add Your First Brand
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {brands.map((brand: Brand) => (
                <div key={brand.brand_id} className="bg-[#FCFBFC] border border-[#EBEAEA] rounded-xl p-6 hover:border-[#DADAF3] transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-semibold text-[#2C2C2C] truncate flex-1 mr-2">
                      {brand.brand_name}
                    </h3>
                    <div className="flex flex-col space-y-1">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full text-center ${
                        brand.status === 'Active' 
                          ? 'bg-[#DCFCE7] text-[#166534]' 
                          : 'bg-[#F3F4F6] text-[#6B7280]'
                      }`}>
                        {brand.status}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full text-center ${
                        brand.vat_classification === 'VAT' 
                          ? 'bg-[#DBEAFE] text-[#1E40AF]' 
                          : 'bg-[#FEF3C7] text-[#92400E]'
                      }`}>
                        {brand.vat_classification}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-[#646464] mb-6">
                    <div className="flex items-center">
                      <span className="font-medium w-20">Contact:</span>
                      <span className="truncate">{brand.contact_person || 'N/A'}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium w-20">Location:</span>
                      <span className="truncate">{brand.city || 'N/A'}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium w-20">Mobile:</span>
                      <span className="truncate">{brand.mobile_number || 'N/A'}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium w-20">Email:</span>
                      <span className="truncate">{brand.email || 'N/A'}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium w-20">TIN ID:</span>
                      <span className="truncate">{brand.tin || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      className="flex-1 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] px-3 py-2 rounded-lg font-medium transition-colors text-sm"
                      onClick={() => handleEdit(brand)}
                    >
                      Edit
                    </button>
                    <button 
                      className="flex-1 bg-[#E6E6FE] hover:bg-[#DADAF3] text-[#0504AA] px-3 py-2 rounded-lg font-medium transition-colors text-sm"
                      onClick={() => handleViewItems(brand)}
                    >
                      View Items
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center space-x-4 mt-8">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-[#FCFBFC] border border-[#EBEAEA] rounded-lg hover:bg-[#F9F9F9] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Previous
              </button>
              <span className="text-[#646464] text-sm">
                Page {currentPage} of {totalPages}
              </span>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-[#FCFBFC] border border-[#EBEAEA] rounded-lg hover:bg-[#F9F9F9] disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Next
              </button>
            </div>
          )}
        </section>

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-[#2C2C2C] mb-6">
                  {editingBrand ? 'Edit Brand' : 'Add New Brand'}
                </h2>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                        Brand Name *
                      </label>
                      <input
                        type="text"
                        name="brand_name"
                        value={formData.brand_name}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-[#EBEAEA] rounded-lg focus:ring-2 focus:ring-[#0504AA] focus:border-transparent"
                        placeholder="Enter brand name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                        Contact Person
                      </label>
                      <input
                        type="text"
                        name="contact_person"
                        value={formData.contact_person}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-[#EBEAEA] rounded-lg focus:ring-2 focus:ring-[#0504AA] focus:border-transparent"
                        placeholder="Enter contact person"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                        Mobile Number
                      </label>
                      <input
                        type="text"
                        name="mobile_number"
                        value={formData.mobile_number}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-[#EBEAEA] rounded-lg focus:ring-2 focus:ring-[#0504AA] focus:border-transparent"
                        placeholder="Enter mobile number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-[#EBEAEA] rounded-lg focus:ring-2 focus:ring-[#0504AA] focus:border-transparent"
                        placeholder="Enter email address"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                      Street Address
                    </label>
                    <input
                      type="text"
                      name="street_name"
                      value={formData.street_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-[#EBEAEA] rounded-lg focus:ring-2 focus:ring-[#0504AA] focus:border-transparent"
                      placeholder="Enter street address"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                        City
                      </label>
                      <input
                        type="text"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-[#EBEAEA] rounded-lg focus:ring-2 focus:ring-[#0504AA] focus:border-transparent"
                        placeholder="Enter city"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                        Region
                      </label>
                      <input
                        type="text"
                        name="region"
                        value={formData.region}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-[#EBEAEA] rounded-lg focus:ring-2 focus:ring-[#0504AA] focus:border-transparent"
                        placeholder="Enter region"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                      TIN ID
                    </label>
                    <input
                      type="text"
                      name="tin"
                      value={formData.tin}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-[#EBEAEA] rounded-lg focus:ring2 focus:ring-[#0504AA] focus:border-transparent"
                      placeholder="Enter TIN ID"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                        VAT Classification
                      </label>
                      <select
                        name="vat_classification"
                        value={formData.vat_classification}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-[#EBEAEA] rounded-lg focus:ring-2 focus:ring-[#0504AA] focus:border-transparent"
                      >
                        <option value="VAT">VAT-inclusive</option>
                        <option value="NON_VAT">NON-VAT</option>
                        <option value="BOTH">Both VAT and NON-VAT</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[#2C2C2C] mb-2">
                        Status
                      </label>
                      <select
                        name="status"
                        value={formData.status}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-[#EBEAEA] rounded-lg focus:ring-2 focus:ring-[#0504AA] focus:border-transparent"
                      >
                        <option value="Active">Active</option>
                        <option value="Archived">Archived</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-4 pt-6 border-t border-[#EBEAEA]">
                    <button 
                      type="button" 
                      className="px-4 py-2 border border-[#EBEAEA] rounded-lg hover:bg-[#F9F9F9] text-[#646464] font-medium text-sm"
                      onClick={() => {
                        setShowModal(false);
                        resetForm();
                      }}
                    >
                      Cancel
                    </button>
                    {editingBrand && (
                      <button 
                        type="button" 
                        className="px-4 py-2 bg-[#DC2626] hover:bg-[#DC2626]/90 text-white rounded-lg font-medium text-sm"
                        onClick={handleDelete}
                      >
                        Delete Brand
                      </button>
                    )}
                    <button 
                      type="submit" 
                      className="px-4 py-2 bg-[#0504AA] hover:bg-[#0504AA]/90 text-white rounded-lg font-medium text-sm"
                    >
                      {editingBrand ? 'Update Brand' : 'Create Brand'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {showItemsModal && viewingBrandItems && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold text-[#2C2C2C]">
                    Items for {viewingBrandItems.brand_name}
                  </h2>
                  <button 
                    className="text-[#646464] hover:text-[#2C2C2C] text-2xl"
                    onClick={() => {
                      setShowItemsModal(false);
                      setViewingBrandItems(null);
                      setBrandItems([]);
                    }}
                  >
                    ×
                  </button>
                </div>
                  {brandItems.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-[#F3F4F6] rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="text-xl">📦</span>
                    </div>
                    <h3 className="text-base font-medium text-[#2C2C2C] mb-1">No items found</h3>
                    <p className="text-sm text-[#646464]">
                      This brand doesn't have any items associated with it yet.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-sm text-[#646464] mb-3">
                      Showing {brandItems.length} item{brandItems.length !== 1 ? 's' : ''}
                    </div>
                      {brandItems.map((item: any, index: number) => (
                      <div key={item.item_id} className="bg-white border border-[#EBEAEA] rounded-lg overflow-hidden">
                          {/* Main item row - always visible */}
                          <div className="flex items-center p-4 hover:bg-[#F9F9F9] transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0 mr-4">
                                  <h4 className="font-medium text-[#2C2C2C] text-base mb-1 truncate">
                                    {item.item_name}
                                  </h4>
                                  <div className="flex items-center space-x-4 text-sm text-[#646464]">
                                    <span>Model: {item.model_number}</span>
                                    <span>•</span>
                                    <span>{item.item_type}</span>
                                    <span>•</span>
                                    <span>{item.category}</span>
                                    <span>•</span>
                                    <span>ID: #{item.item_id}</span>
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-4">
                                  {/* Stock Info */}
                                  <div className="text-right">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-sm font-medium text-[#2C2C2C]">
                                        {item.quantity} units
                                      </span>
                                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                                        item.availability_status === 'In Stock' 
                                          ? 'bg-[#DCFCE7] text-[#166534]'
                                          : item.availability_status === 'Low Stock'
                                          ? 'bg-[#FEF3C7] text-[#92400E]'
                                          : 'bg-[#FEF2F2] text-[#DC2626]'
                                      }`}>
                                        {item.availability_status}
                                      </span>
                                    </div>
                                    <div className="text-xs text-[#646464] mt-1">
                                      Min: {item.threshold_value} • {item.active_batches || 0} batches
                                    </div>
                                  </div>
                                  
                                  {/* Quick Pricing Preview */}
                                  {item.pricing && item.pricing.srp && (
                                    <div className="text-right">
                                      <div className="text-sm font-medium text-[#0504AA]">
                                        ₱{item.pricing.srp}
                                      </div>
                                      <div className="text-xs text-[#646464]">SRP</div>
                                    </div>
                                  )}
                                  
                                  {/* Expand/Collapse Button */}
                                  <button
                                    onClick={() => setExpandedItem(expandedItem === index ? null : index)}
                                    className="p-1 text-[#646464] hover:text-[#2C2C2C] hover:bg-[#F3F4F6] rounded transition-colors"
                                  >
                                    <svg 
                                      className={`w-4 h-4 transition-transform ${expandedItem === index ? 'rotate-180' : ''}`}
                                      fill="none" 
                                      viewBox="0 0 24 24" 
                                      stroke="currentColor"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Expanded details */}
                          {expandedItem === index && (
                            <div className="border-t border-[#EBEAEA] bg-[#FBFBFB] p-4">
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* Left Column - Basic Info & Dates */}
                                <div className="space-y-3">
                                  <div className="bg-white rounded-lg p-3 border border-[#EBEAEA]">
                                    <h5 className="text-xs font-medium text-[#646464] mb-2">Item Details</h5>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                      <div>
                                        <span className="text-[#646464]">Type:</span>
                                        <span className="ml-2 text-[#2C2C2C]">{item.item_type}</span>
                                      </div>
                                      <div>
                                        <span className="text-[#646464]">Category:</span>
                                        <span className="ml-2 text-[#2C2C2C]">{item.category}</span>
                                      </div>
                                      <div>
                                        <span className="text-[#646464]">Min Stock:</span>
                                        <span className="ml-2 text-[#2C2C2C]">{item.threshold_value}</span>
                                      </div>
                                      <div>
                                        <span className="text-[#646464]">Current:</span>
                                        <span className="ml-2 text-[#2C2C2C]">{item.quantity} units</span>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {(item.created_at || item.updated_at) && (
                                    <div className="bg-white rounded-lg p-3 border border-[#EBEAEA]">
                                      <h5 className="text-xs font-medium text-[#646464] mb-2">Dates</h5>
                                      <div className="space-y-1 text-sm">
                                        {item.created_at && (
                                          <div>
                                            <span className="text-[#646464]">Added:</span>
                                            <span className="ml-2 text-[#2C2C2C]">
                                              {new Date(item.created_at).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                              })}
                                            </span>
                                          </div>
                                        )}
                                        {item.updated_at && (
                                          <div>
                                            <span className="text-[#646464]">Updated:</span>
                                            <span className="ml-2 text-[#2C2C2C]">
                                              {new Date(item.updated_at).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric'
                                              })}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                  
                                  {/* Batch Information */}
                                  {item.active_batches && item.active_batches > 0 && (
                                    <div className="bg-white rounded-lg p-3 border border-[#EBEAEA]">
                                      <h5 className="text-xs font-medium text-[#646464] mb-2">Inventory Batches</h5>
                                      <div className="flex items-center justify-between">
                                        <div className="text-sm">
                                          <div className="text-[#2C2C2C] font-medium">{item.active_batches} Active Batches</div>
                                          <div className="text-[#646464]">Available: {item.total_available_quantity || item.quantity}</div>
                                        </div>
                                        <button
                                          onClick={(e) => {
                                            e.preventDefault();
                                            window.open(`/inventory/${item.item_id}/batches`, '_blank');
                                          }}
                                          className="text-[#0504AA] text-xs hover:underline"
                                        >
                                          View Batches →
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                
                                {/* Right Column - Pricing */}
                                {item.pricing && (
                                  <div className="bg-white rounded-lg p-3 border border-[#EBEAEA]">
                                    <h5 className="text-xs font-medium text-[#646464] mb-2">Pricing Tiers</h5>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                      {item.pricing.regional_distributor && (
                                        <div className="flex justify-between">
                                          <span className="text-[#646464]">RD:</span>
                                          <span className="text-[#2C2C2C] font-medium">₱{item.pricing.regional_distributor}</span>
                                        </div>
                                      )}
                                      {item.pricing.provincial_distributor && (
                                        <div className="flex justify-between">
                                          <span className="text-[#646464]">PD:</span>
                                          <span className="text-[#2C2C2C] font-medium">₱{item.pricing.provincial_distributor}</span>
                                        </div>
                                      )}
                                      {item.pricing.district_distributor && (
                                        <div className="flex justify-between">
                                          <span className="text-[#646464]">DD:</span>
                                          <span className="text-[#2C2C2C] font-medium">₱{item.pricing.district_distributor}</span>
                                        </div>
                                      )}
                                      {item.pricing.city_distributor && (
                                        <div className="flex justify-between">
                                          <span className="text-[#646464]">CD:</span>
                                          <span className="text-[#2C2C2C] font-medium">₱{item.pricing.city_distributor}</span>
                                        </div>
                                      )}
                                      {item.pricing.reseller && (
                                        <div className="flex justify-between">
                                          <span className="text-[#646464]">RS:</span>
                                          <span className="text-[#2C2C2C] font-medium">₱{item.pricing.reseller}</span>
                                        </div>
                                      )}
                                      {item.pricing.sub_reseller && (
                                        <div className="flex justify-between">
                                          <span className="text-[#646464]">Sub-RS:</span>
                                          <span className="text-[#2C2C2C] font-medium">₱{item.pricing.sub_reseller}</span>
                                        </div>
                                      )}
                                      {item.pricing.srp && (
                                        <div className="flex justify-between col-span-2 pt-2 border-t border-[#EBEAEA]">
                                          <span className="text-[#646464]">SRP:</span>
                                          <span className="text-[#0504AA] font-semibold">₱{item.pricing.srp}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
                
                <div className="flex justify-end pt-6 border-t border-[#EBEAEA] mt-6">
                  <button 
                    className="px-4 py-2 bg-[#0504AA] hover:bg-[#0504AA]/90 text-white rounded-lg font-medium text-sm"
                    onClick={() => {
                      setShowItemsModal(false);
                      setViewingBrandItems(null);
                      setBrandItems([]);
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>  );
};

export default BrandsPage;