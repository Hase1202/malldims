import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Search, ChevronDown, ChevronUp, X, Menu } from 'lucide-react';
import Sidebar from '../../components/common/Sidebar';
import { 
  customersApi, 
  brandsApi, 
  itemsApi, 
  customerSpecialPricesApi,
  customerBrandPricingApi 
} from '../../lib/api';

type PricingTier = 'SRP' | 'RD' | 'PD' | 'DD' | 'CD' | 'RS' | 'SUB-RS';

interface Customer {
  customer_id: number;
  name: string;
  // Add other customer properties as needed
}

interface Brand {
  brand_id: number;
  brand_name: string;
}

interface Item {
  item_id: number;
  name: string;
  item_number: string;
  brand_name?: string;
  total_quantity?: number;
  cost_price?: number;
  batches_available?: number;
  tier_pricing?: Array<{
    pricing_tier: PricingTier;
    price: number;
  }>;
}

interface BrandPricing {
  id?: number; // Optional since newly assigned brands won't have an ID yet
  // Backend returns foreign key as 'brand'; UI was expecting 'brand_id'. Keep both for safety.
  brand_id: number; // normalized id used throughout UI
  brand?: number;   // raw backend field (optional)
  brand_name: string;
  pricing_tier?: PricingTier; // Optional since brands can be assigned without tiers
}

interface SpecialPricing {
  id: number;
  item_id: number;
  customer_id: number;
  discount: number;
}

const ManagePricingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState<'brand-pricing' | 'special-pricing'>('brand-pricing');
  
  // Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Brand table sorting and filtering
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandPricingList, setBrandPricingList] = useState<BrandPricing[]>([]);
  const [assignedBrandIds, setAssignedBrandIds] = useState<Set<number>>(new Set()); // Track brands assigned to show in table
  const [brandSearchQuery, setBrandSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<'brand_name' | 'pricing_tier'>('brand_name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showAddBrandModal, setShowAddBrandModal] = useState(false);
  const [addBrandSearchQuery, setAddBrandSearchQuery] = useState('');
  const [showBrandDropdown, setShowBrandDropdown] = useState(false);

  // Special pricing modal states
  const [specialPricing, setSpecialPricing] = useState<SpecialPricing[]>([]);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [showSpecialPricingBrandDropdown, setShowSpecialPricingBrandDropdown] = useState(false);
  const [showItemDropdown, setShowItemDropdown] = useState(false);

  const pricingTierOptions: PricingTier[] = ['RD', 'PD', 'DD', 'CD', 'RS', 'SUB-RS', 'SRP'];

  useEffect(() => {
    if (id) {
      fetchCustomer();
      fetchBrands();
      fetchBrandPricing();
      fetchSpecialPricing();
      fetchItems();
    }
  }, [id]);

  // Handle clicks outside dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      
      // Close brand dropdown if clicked outside
      if (!target.closest('.brand-dropdown-container')) {
        setShowBrandDropdown(false);
      }
      
      // Close special pricing brand dropdown if clicked outside
      if (!target.closest('.special-pricing-brand-dropdown-container')) {
        setShowSpecialPricingBrandDropdown(false);
      }
      
      // Close item dropdown if clicked outside
      if (!target.closest('.item-dropdown-container')) {
        setShowItemDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchCustomer = async () => {
    try {
      const response = await customersApi.getById(id!);
      if (response.status === 'success' && response.data) {
        setCustomer(response.data);
      }
    } catch (error) {
      console.error('Error fetching customer:', error);
    }
  };

  const fetchBrands = async () => {
    try {
      const response = await brandsApi.getAll();
      if (response.status === 'success' && response.data) {
        setBrands(Array.isArray(response.data) ? response.data : response.data.results || []);
      }
    } catch (error) {
      console.error('Error fetching brands:', error);
    }
  };

  const fetchBrandPricing = async () => {
    try {
      console.log('Fetching brand pricing for customer ID:', id);
      // helper to normalize any raw record shape
      const normalize = (raw: any): BrandPricing => ({
        id: raw.id,
        brand_id: raw.brand_id ?? raw.brand, // unify
        brand: raw.brand, // keep original if present
        brand_name: raw.brand_name,
        pricing_tier: raw.pricing_tier,
      });
      // Try filtered endpoint first
      let response = await customerBrandPricingApi.getByCustomerId(parseInt(id!));
      console.log('Brand pricing API response (by customer):', response);
      const useAllFallback = (response.status === 'error' || !response.data || (Array.isArray(response.data) && response.data.length === 0));
      if (useAllFallback) {
        console.log('Trying to fetch all brand pricing and filter...');
        const allResponse = await customerBrandPricingApi.getAll();
        console.log('All brand pricing response:', allResponse);
        if (allResponse.status === 'success' && allResponse.data) {
          const allData = Array.isArray(allResponse.data) ? allResponse.data : allResponse.data.results || [];
            const customerData = allData
              .filter((item: any) => (item.customer ?? item.customer_id) === parseInt(id!))
              .map(normalize);
          console.log('Filtered & normalized customer data:', customerData);
          setBrandPricingList(customerData);
          // Update assigned brand IDs from pricing data
          const assignedIds = new Set<number>(customerData.map((bp: BrandPricing) => bp.brand_id));
          setAssignedBrandIds(assignedIds);
          return;
        }
      }
      if (response.status === 'success' && response.data) {
        const raw = Array.isArray(response.data) ? response.data : response.data.results || [];
        const normalized = raw.map(normalize);
        console.log('Setting normalized brandPricingList to:', normalized);
        setBrandPricingList(normalized);
        // Update assigned brand IDs from pricing data
        const assignedIds = new Set<number>(normalized.map((bp: BrandPricing) => bp.brand_id));
        setAssignedBrandIds(assignedIds);
      } else {
        console.log('No brand pricing data found, setting empty array');
        setBrandPricingList([]);
        setAssignedBrandIds(new Set());
      }
    } catch (error) {
      console.error('Error fetching brand pricing:', error);
      setBrandPricingList([]);
      setAssignedBrandIds(new Set());
    }
  };

  const fetchSpecialPricing = async () => {
    try {
      const response = await customerSpecialPricesApi.getByCustomerId(parseInt(id!));
      if (response.status === 'success' && response.data) {
        setSpecialPricing(Array.isArray(response.data) ? response.data : response.data.results || []);
      } else {
        setSpecialPricing([]);
      }
    } catch (error) {
      console.error('Error fetching special pricing:', error);
      setSpecialPricing([]);
    }
  };

  const fetchItems = async () => {
    try {
      const response = await itemsApi.getAll();
      if (response.status === 'success' && response.data) {
        setItems(Array.isArray(response.data) ? response.data : response.data.results || []);
      }
    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  const calculateTieredPrice = (item: Item): number => {
    if (!item.brand_name || !brands || brands.length === 0) return 0;
    
    // Find the brand pricing tier for this item's brand
    const brand = brands.find(b => b.brand_name === item.brand_name);
    if (!brand) return 0;
    
    const brandPricingTier = getBrandPricingTier(brand.brand_id);
    if (!brandPricingTier) return 0;
    
    // Find the tier pricing for this item
    const tierPricing = item.tier_pricing?.find(tp => tp.pricing_tier === brandPricingTier);
    return tierPricing?.price || 0;
  };

  const getItemDetails = (itemId: number) => {
    return (items || []).find(item => item.item_id === itemId);
  };

  const getBrandDetails = (itemId: number) => {
    const item = getItemDetails(itemId);
    if (!item?.brand_name || !brands || brands.length === 0) return null;
    return brands.find(brand => brand.brand_name === item.brand_name);
  };

  const handleBrandPricingUpdate = async (brandId: number, tier: PricingTier) => {
    try {
      console.log('Updating brand pricing - Customer ID:', id, 'Brand ID:', brandId, 'Tier:', tier);
      console.log('Current brandPricingList:', brandPricingList);
      // Match either normalized brand_id or raw brand field
      const existingAssignment = (brandPricingList || []).find(bp => bp.brand_id === brandId || (bp as any).brand === brandId);
      console.log('Existing assignment found:', existingAssignment);
      
      if (existingAssignment && existingAssignment.id) {
        console.log('Updating existing assignment with ID:', existingAssignment.id);
        const response = await customerBrandPricingApi.update(existingAssignment.id.toString(), {
          customer: parseInt(id!),
          brand: brandId,
          pricing_tier: tier,
        });
        if (response.status === 'success') {
          console.log('Brand pricing updated successfully');
          fetchBrandPricing();
        } else {
          console.error('Failed to update brand pricing:', response.message);
          console.error('Full error response:', response);
          alert('Failed to update brand pricing: ' + response.message);
        }
      } else {
        // Create new assignment - this is when the actual pricing relationship is created
        const requestData = {
          customer: parseInt(id!),
          brand: brandId,
          pricing_tier: tier
        };
        console.log('Creating brand pricing with data:', requestData);
        
        const response = await customerBrandPricingApi.create(requestData);

        if (response.status === 'success') {
          console.log('Brand pricing assigned successfully');
          fetchBrandPricing();
        } else {
          console.error('Failed to assign brand pricing:', response.message);
          console.error('Full error response:', response);
          alert('Failed to assign brand pricing: ' + response.message);
        }
      }
    } catch (error) {
      console.error('Error updating brand pricing:', error);
      alert('Error updating brand pricing. Please try again.');
    }
  };

  const handleRemoveBrandPricing = async (brandId: number) => {
    try {
      const existingAssignment = brandPricingList.find(bp => bp.brand_id === brandId);
      
      if (existingAssignment && existingAssignment.id) {
        // Remove from backend if it exists
        const response = await customerBrandPricingApi.delete(existingAssignment.id.toString());

        if (response.status === 'success') {
          console.log('Brand pricing removed successfully');
          fetchBrandPricing();
        } else {
          console.error('Failed to remove brand pricing:', response.message);
          alert('Failed to remove brand pricing: ' + response.message);
        }
      }
      
      // Always remove from assigned brands list
      setAssignedBrandIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(brandId);
        return newSet;
      });
    } catch (error) {
      console.error('Error removing brand pricing:', error);
      alert('Error removing brand pricing. Please try again.');
    }
  };

  const handleAssignAllBrands = async () => {
    try {
      // Get all brands that aren't already assigned
      const unassignedBrands = (brands || []).filter(brand => 
        !assignedBrandIds.has(brand.brand_id)
      );

      if (unassignedBrands.length === 0) {
        alert('All brands are already assigned to this customer.');
        return;
      }

      // Add all unassigned brands to the assigned list
      const newAssignedIds = new Set([...assignedBrandIds, ...unassignedBrands.map(b => b.brand_id)]);
      setAssignedBrandIds(newAssignedIds);
      
      console.log(`Assigned ${unassignedBrands.length} brands to table`);
    } catch (error) {
      console.error('Error assigning brands:', error);
      alert('Error assigning brands. Please try again.');
    }
  };

  const handleAddBrand = async (brandId: number) => {
    try {
      // Just add the brand to the assigned list - no API call needed
      setAssignedBrandIds(prev => new Set([...prev, brandId]));
      console.log('Brand assigned to table successfully');
      setShowAddBrandModal(false);
      setAddBrandSearchQuery('');
    } catch (error) {
      console.error('Error assigning brand:', error);
      alert('Error assigning brand. Please try again.');
    }
  };

  const handleAddSpecialPricing = async () => {
    if (!selectedItem || discountAmount >= 0) {
      console.error('Please select an item and enter a negative discount amount');
      return;
    }

    try {
      const response = await customerSpecialPricesApi.create({
        customer: parseInt(id!),
        item: selectedItem.item_id,
        special_price: selectedItem.tier_pricing?.[0]?.price ? 
          selectedItem.tier_pricing[0].price + discountAmount : 
          Math.abs(discountAmount), // If no base price, use absolute discount as price
        reason: `Customer-specific pricing - ${Math.abs(discountAmount)} discount`
      });

      if (response.status === 'success') {
        console.log('Special pricing added successfully');
        fetchSpecialPricing();
        setShowAddItemModal(false);
        setSelectedBrand(null);
        setSelectedItem(null);
        setDiscountAmount(0);
        setItemSearchQuery('');
      } else {
        console.error('Failed to add special pricing:', response.message);
        alert('Failed to add special pricing: ' + response.message);
      }
    } catch (error) {
      console.error('Error adding special pricing:', error);
      alert('Error adding special pricing. Please try again.');
    }
  };

  const handleRemoveSpecialPricing = async (itemId: number) => {
    try {
      // Find the special pricing entry to get its ID
      if (!Array.isArray(specialPricing)) {
        console.error('Special pricing is not an array');
        return;
      }
      const specialPricingEntry = specialPricing.find(sp => sp.item_id === itemId);
      if (!specialPricingEntry) {
        console.error('Special pricing entry not found');
        return;
      }

      const response = await customerSpecialPricesApi.delete(specialPricingEntry.id.toString());

      if (response.status === 'success') {
        console.log('Special pricing removed successfully');
        fetchSpecialPricing();
      } else {
        console.error('Failed to remove special pricing:', response.message);
        alert('Failed to remove special pricing: ' + response.message);
      }
    } catch (error) {
      console.error('Error removing special pricing:', error);
      alert('Error removing special pricing. Please try again.');
    }
  };

  const getBrandPricingTier = (brandId: number): PricingTier | null => {
    if (!Array.isArray(brandPricingList)) return null;
    const brandPricingItem = brandPricingList.find((bp: BrandPricing) => bp.brand_id === brandId || (bp as any).brand === brandId);
    return brandPricingItem?.pricing_tier || null;
  };

  const handleSort = (column: 'brand_name' | 'pricing_tier') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedBrands = (brands || [])
    .filter(brand => 
      // Only show brands that are assigned to this customer (either in assignedBrandIds or have pricing)
      (assignedBrandIds.has(brand.brand_id) || (brandPricingList || []).some(bp => bp.brand_id === brand.brand_id)) &&
      (brand.brand_name?.toLowerCase().includes(brandSearchQuery.toLowerCase()) || false)
    )
    .sort((a, b) => {
      let aValue, bValue;
      
      if (sortColumn === 'brand_name') {
        aValue = (a.brand_name || '').toLowerCase();
        bValue = (b.brand_name || '').toLowerCase();
      } else {
        const aTier = getBrandPricingTier(a.brand_id) || '';
        const bTier = getBrandPricingTier(b.brand_id) || '';
        aValue = aTier;
        bValue = bTier;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  const availableBrandsForAdding = (brands || [])
    .filter(brand => 
      // Only show brands that are NOT assigned to this customer
      !assignedBrandIds.has(brand.brand_id) && !(brandPricingList || []).some(bp => bp.brand_id === brand.brand_id)
    )
    .sort((a, b) => (a.brand_name || '').localeCompare(b.brand_name || ''));

  const filteredBrandsForAdding = availableBrandsForAdding
    .filter(brand => 
      !addBrandSearchQuery || brand.brand_name?.toLowerCase().includes(addBrandSearchQuery.toLowerCase()) || false
    );

  const brandsToShow = addBrandSearchQuery ? filteredBrandsForAdding : availableBrandsForAdding.slice(0, 6);

  const filteredItems = selectedBrand 
    ? (items || []).filter(item =>
        item.brand_name === selectedBrand.brand_name &&
        (!itemSearchQuery || 
         (item.name || '').toLowerCase().includes(itemSearchQuery.toLowerCase()) ||
         (item.item_number || '').toLowerCase().includes(itemSearchQuery.toLowerCase()))
      )
    : [];

  if (!customer) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <div className="flex-1 lg:ml-64 p-6">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className="flex-1 lg:ml-64 p-6">
        {/* Mobile Header with Menu Button */}
        <div className="flex lg:hidden items-center mb-4">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-1 hover:bg-gray-100 rounded-lg"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        <div className="container mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => navigate('/customers')}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">Manage Pricing - {customer.name}</h1>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab('brand-pricing')}
              className={`py-2 px-4 border-b-2 font-medium text-sm ${
                activeTab === 'brand-pricing'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Brand Pricing Tiers
            </button>
            <button
              onClick={() => setActiveTab('special-pricing')}
              className={`py-2 px-4 border-b-2 font-medium text-sm ${
                activeTab === 'special-pricing'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Special Pricing
            </button>
          </nav>
        </div>
      </div>

      {/* Brand Pricing Tier Table */}
      {activeTab === 'brand-pricing' && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-semibold">Brand Pricing Tiers</h2>
                <p className="text-gray-600 text-sm">Set the pricing tier for each brand. Only one tier can be selected per brand.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddBrandModal(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Brand
                </button>
                <button
                  onClick={handleAssignAllBrands}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Assign All Brands
                </button>
              </div>
            </div>
            
            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    value={brandSearchQuery}
                    onChange={(e) => setBrandSearchQuery(e.target.value)}
                    placeholder="Search assigned brands..."
                    className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="text-left py-3 px-6 font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('brand_name')}
                  >
                    <div className="flex items-center gap-2">
                      Brand Name
                      {sortColumn === 'brand_name' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="text-left py-3 px-6 font-medium text-gray-700 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('pricing_tier')}
                  >
                    <div className="flex items-center gap-2">
                      Pricing Tier
                      {sortColumn === 'pricing_tier' && (
                        sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </th>
                  <th className="text-left py-3 px-6 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredAndSortedBrands.map((brand) => {
                  const currentTier = getBrandPricingTier(brand.brand_id);
                  return (
                    <tr key={brand.brand_id} className="bg-white">
                      <td className="py-4 px-6 font-medium">{brand.brand_name || 'Unknown Brand'}</td>
                      <td className="py-4 px-6">
                        <select
                          value={currentTier || ''}
                          onChange={(e) => {
                            if (e.target.value) {
                              handleBrandPricingUpdate(brand.brand_id, e.target.value as PricingTier);
                            }
                          }}
                          className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select Tier</option>
                          {pricingTierOptions.map((tier) => (
                            <option key={tier} value={tier}>{tier}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-4 px-6">
                        <button
                          onClick={() => handleRemoveBrandPricing(brand.brand_id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Special Pricing Table */}
      {activeTab === 'special-pricing' && (
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-semibold">Special Pricing</h2>
                <p className="text-gray-600 text-sm">Add special pricing discounts for specific items</p>
              </div>
              <button
                onClick={() => setShowAddItemModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Item
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-3 px-6 font-medium text-gray-700">Item Number</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-700">Item Name</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-700">Brand</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-700">Tier Price</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-700">Discount</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-700">Final Price</th>
                  <th className="text-left py-3 px-6 font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {Array.isArray(specialPricing) && specialPricing.map((sp) => {
                  const item = getItemDetails(sp.item_id);
                  const brand = getBrandDetails(sp.item_id);
                  const tierPrice = item ? calculateTieredPrice(item) : 0;
                  const finalPrice = tierPrice + sp.discount;
                  
                  return (
                    <tr key={`${sp.customer_id}-${sp.item_id}`} className="hover:bg-gray-50">
                      <td className="py-4 px-6 font-medium">{item?.item_number || 'N/A'}</td>
                      <td className="py-4 px-6">{item?.name || 'Unknown Item'}</td>
                      <td className="py-4 px-6">{brand?.brand_name || 'Unknown Brand'}</td>
                      <td className="py-4 px-6">${tierPrice.toFixed(2)}</td>
                      <td className="py-4 px-6 text-red-600">${sp.discount.toFixed(2)}</td>
                      <td className="py-4 px-6 font-semibold">${finalPrice.toFixed(2)}</td>
                      <td className="py-4 px-6">
                        <button
                          onClick={() => handleRemoveSpecialPricing(sp.item_id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddItemModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add Special Pricing</h3>
              <button
                onClick={() => {
                  setShowAddItemModal(false);
                  setSelectedBrand(null);
                  setSelectedItem(null);
                  setDiscountAmount(0);
                  setItemSearchQuery('');
                  setShowSpecialPricingBrandDropdown(false);
                  setShowItemDropdown(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="relative special-pricing-brand-dropdown-container">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Brand
                </label>
                <input
                  type="text"
                  value={selectedBrand?.brand_name || ''}
                  onChange={(e) => {
                    if (!e.target.value) {
                      setSelectedBrand(null);
                      setSelectedItem(null);
                      setItemSearchQuery('');
                    }
                    setShowSpecialPricingBrandDropdown(true);
                  }}
                  onFocus={() => setShowSpecialPricingBrandDropdown(true)}
                  placeholder="Type to search for brands..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                
                {showSpecialPricingBrandDropdown && !selectedBrand && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {brands.map((brand) => (
                      <div
                        key={brand.brand_id}
                        onClick={() => {
                          setSelectedBrand(brand);
                          setSelectedItem(null);
                          setItemSearchQuery('');
                          setShowSpecialPricingBrandDropdown(false);
                        }}
                        className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                      >
                        <div className="font-medium">{brand.brand_name}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedBrand && (
                <div className="relative item-dropdown-container">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Items in {selectedBrand.brand_name}
                  </label>
                  <input
                    type="text"
                    value={selectedItem?.name || itemSearchQuery}
                    onChange={(e) => {
                      if (!selectedItem) {
                        setItemSearchQuery(e.target.value);
                      }
                      setShowItemDropdown(true);
                    }}
                    onFocus={() => setShowItemDropdown(true)}
                    placeholder="Type to search for items..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  
                  {showItemDropdown && !selectedItem && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredItems.map((item) => (
                        <div
                          key={item.item_id}
                          onClick={() => {
                            setSelectedItem(item);
                            setItemSearchQuery(item.name);
                            setShowItemDropdown(false);
                          }}
                          className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                        >
                          <div className="font-medium">{item.name}</div>
                          <div className="text-sm text-gray-600">{item.item_number}</div>
                          <div className="text-sm text-gray-600 mt-1 grid grid-cols-2 gap-2">
                            <div>Qty: {item.total_quantity || 0}</div>
                            <div>Cost: ${(item.cost_price || 0).toFixed(2)}</div>
                            <div>Batches: {item.batches_available || 0}</div>
                            <div>Tier Price: ${calculateTieredPrice(item).toFixed(2)}</div>
                          </div>
                        </div>
                      ))}
                      {filteredItems.length === 0 && (
                        <div className="p-3 text-gray-500 text-center">
                          No items found in this brand
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {selectedItem && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <div className="font-medium">{selectedItem.name}</div>
                  <div className="text-sm text-gray-600">{selectedItem.item_number}</div>
                  <div className="text-sm text-gray-600">Brand: {selectedBrand?.brand_name}</div>
                  <div className="text-sm text-gray-600 mt-2 grid grid-cols-2 gap-2">
                    <div><strong>Available Qty:</strong> {selectedItem.total_quantity || 0}</div>
                    <div><strong>Cost Price:</strong> ${(selectedItem.cost_price || 0).toFixed(2)}</div>
                    <div><strong>Batches Available:</strong> {selectedItem.batches_available || 0}</div>
                    <div><strong>Current Tier Price:</strong> ${calculateTieredPrice(selectedItem).toFixed(2)}</div>
                  </div>
                  {selectedItem.tier_pricing && (
                    <div className="text-sm text-gray-600 mt-2">
                      <strong>Available Tiers:</strong>
                      <div className="grid grid-cols-2 gap-1 mt-1">
                        {selectedItem.tier_pricing.map((tp) => (
                          <div key={tp.pricing_tier} className="text-xs">
                            {tp.pricing_tier}: ${tp.price.toFixed(2)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      setSelectedItem(null);
                      setItemSearchQuery('');
                    }}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-800"
                  >
                    Change Item
                  </button>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Discount Amount (negative value)
                </label>
                <input
                  type="number"
                  step="1"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  placeholder="-10"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {selectedItem && discountAmount < 0 && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="text-sm">
                    <strong>Final Price:</strong> ${(calculateTieredPrice(selectedItem) + discountAmount).toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddItemModal(false);
                  setSelectedBrand(null);
                  setSelectedItem(null);
                  setDiscountAmount(0);
                  setItemSearchQuery('');
                  setShowSpecialPricingBrandDropdown(false);
                  setShowItemDropdown(false);
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSpecialPricing}
                disabled={!selectedItem || discountAmount >= 0}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Special Pricing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Brand Modal */}
      {showAddBrandModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Add Brand</h3>
              <button
                onClick={() => {
                  setShowAddBrandModal(false);
                  setAddBrandSearchQuery('');
                  setShowBrandDropdown(false);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="relative brand-dropdown-container">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Brands
                </label>
                <input
                  type="text"
                  value={addBrandSearchQuery}
                  onChange={(e) => {
                    setAddBrandSearchQuery(e.target.value);
                    setShowBrandDropdown(true);
                  }}
                  onFocus={() => setShowBrandDropdown(true)}
                  placeholder="Type to search for brands..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                
                {showBrandDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {brandsToShow.map((brand) => (
                      <div
                        key={brand.brand_id}
                        onClick={() => {
                          handleAddBrand(brand.brand_id);
                          setShowBrandDropdown(false);
                        }}
                        className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-b-0 flex justify-between items-center"
                      >
                        <div>
                          <div className="font-medium">{brand.brand_name}</div>
                        </div>
                        <button className="text-green-600 hover:text-green-800 text-sm font-medium">
                          Add
                        </button>
                      </div>
                    ))}
                    {brandsToShow.length === 0 && (
                      <div className="p-3 text-gray-500 text-center">
                        {addBrandSearchQuery ? 'No brands found matching your search' : 'No brands available to add'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddBrandModal(false);
                  setAddBrandSearchQuery('');
                  setShowBrandDropdown(false);
                }}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};

export default ManagePricingPage;
