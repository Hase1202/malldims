import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { customersApi, customerSpecialPricesApi, itemsApi } from '../../lib/api';
import { Customer, Item } from '../../types/inventory';
import Sidebar from '../../components/common/Sidebar';
import { Menu, ArrowLeft, Plus, Search } from 'lucide-react';
import { useAuthContext } from '../../context/AuthContext';

const AddSpecialPricingPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [customer, setCustomer] = useState<Customer | null>(null);  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [specialPrice, setSpecialPrice] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    if (id) {
      fetchCustomer();
      fetchItems();
    }
  }, [id, user, navigate]);

  const fetchCustomer = async () => {
    try {
      const response = await customersApi.getById(id!);
      setCustomer(response.data);
    } catch (error) {
      console.error('Error fetching customer:', error);
      toast.error('Failed to fetch customer details');
      navigate('/customers');
    }
  };

  const fetchItems = async () => {    try {
      const response = await itemsApi.getAll();
      setItems(response.data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast.error('Failed to fetch inventory items');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!selectedItem) {
      newErrors.item = 'Please select an item';
    }

    if (!specialPrice || parseFloat(specialPrice) <= 0) {
      newErrors.specialPrice = 'Please enter a valid special price';
    }

    if (selectedItem && specialPrice) {
      const customerPrice = getCustomerPrice(selectedItem);
      if (parseFloat(specialPrice) >= customerPrice) {
        newErrors.specialPrice = `Special price must be less than current customer price (₱${customerPrice.toFixed(2)})`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };  const getCustomerPrice = (item: Item) => {
    // For now, return a default price until the Item interface includes pricing fields
    console.log('Getting price for item:', item.item_name);
    return 100; // Placeholder price
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setSaving(true);
    try {
      const customerPrice = getCustomerPrice(selectedItem!);
        await customerSpecialPricesApi.create({
        customer_id: parseInt(id!),
        item_id: selectedItem!.item_id,
        special_price: parseFloat(specialPrice),
        standard_price: customerPrice,
        requested_by: user!.account_id
      });
      
      toast.success('Special price request submitted for approval');
      navigate(`/customers/${id}`);
    } catch (error: any) {
      console.error('Error creating special price:', error);
      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Failed to create special price request');
      }
    } finally {
      setSaving(false);
    }
  };
  const filteredItems = items.filter(item =>
    item.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.model_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
                
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Add Special Pricing</h1>
                  {customer && (
                    <p className="text-gray-600">{customer.company_name}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm p-6">
              {/* Item Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Item *
                </label>
                
                {/* Search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Search items by name or SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Item List */}
                <div className="border border-gray-300 rounded-lg max-h-60 overflow-y-auto">
                  {filteredItems.length === 0 ? (
                    <div className="p-4 text-center text-gray-500">
                      {searchTerm ? 'No items found matching your search' : 'No items available'}
                    </div>
                  ) : (                    filteredItems.map((item) => {
                      const customerPrice = getCustomerPrice(item);
                      return (
                        <div
                          key={item.item_id}
                          onClick={() => setSelectedItem(item)}
                          className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 ${
                            selectedItem?.item_id === item.item_id ? 'bg-blue-50 border-blue-200' : ''
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900">{item.item_name}</h4>
                              <p className="text-sm text-gray-500">Model: {item.model_number}</p>
                              <p className="text-sm text-gray-500">Brand: {item.brand_name}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium text-gray-900">₱{customerPrice.toFixed(2)}</p>
                              <p className="text-xs text-gray-500">
                                {customer?.pricing_tier} Price
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                
                {errors.item && (
                  <p className="text-red-500 text-sm mt-1">{errors.item}</p>
                )}
              </div>

              {/* Selected Item Details */}
              {selectedItem && (
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">Selected Item</h3>                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Name: <span className="font-medium">{selectedItem.item_name}</span></p>
                      <p className="text-sm text-gray-600">Model: <span className="font-medium">{selectedItem.model_number}</span></p>
                      <p className="text-sm text-gray-600">Brand: <span className="font-medium">{selectedItem.brand_name}</span></p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">
                        Current {customer?.pricing_tier} Price: 
                        <span className="font-medium"> ₱{getCustomerPrice(selectedItem).toFixed(2)}</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Special Price Input */}
              <div className="mb-6">
                <label htmlFor="specialPrice" className="block text-sm font-medium text-gray-700 mb-2">
                  Special Price *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₱</span>
                  <input
                    type="number"
                    id="specialPrice"
                    value={specialPrice}
                    onChange={(e) => {
                      setSpecialPrice(e.target.value);
                      if (errors.specialPrice) {
                        setErrors(prev => ({ ...prev, specialPrice: '' }));
                      }
                    }}
                    step="0.01"
                    min="0"
                    className={`w-full pl-8 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      errors.specialPrice ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="0.00"
                  />
                </div>
                {errors.specialPrice && (
                  <p className="text-red-500 text-sm mt-1">{errors.specialPrice}</p>
                )}
                
                {selectedItem && specialPrice && parseFloat(specialPrice) > 0 && (
                  <div className="mt-2 text-sm">
                    <p className="text-gray-600">
                      Discount: 
                      <span className="font-medium text-green-600 ml-1">
                        ₱{(getCustomerPrice(selectedItem) - parseFloat(specialPrice)).toFixed(2)} 
                        ({(((getCustomerPrice(selectedItem) - parseFloat(specialPrice)) / getCustomerPrice(selectedItem)) * 100).toFixed(1)}% off)
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {/* Information Note */}
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Important Notes:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Special price requests require approval from inventory managers</li>
                  <li>• Special prices must be lower than the customer's current pricing tier</li>
                  <li>• Once approved, the special price will be automatically applied for this customer</li>
                  <li>• You will be notified when the request is approved or rejected</li>
                </ul>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-4 pt-6 border-t border-gray-200">
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
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Submit Request
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

export default AddSpecialPricingPage;
