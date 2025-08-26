import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle, DollarSign } from 'lucide-react';
import api from '../../lib/api';
import Toast from '../../components/common/Toast';
import Sidebar from '../../components/common/Sidebar';

interface PricingTier {
  code: string;
  name: string;
  price: number;
}

interface ItemPricing {
  item: number;
  regional_distributor: number;
  provincial_distributor: number;
  district_distributor: number;
  city_distributor: number;
  reseller: number;
  sub_reseller: number;
  srp: number;
  is_active: boolean;
}

interface Item {
  item_id: number;
  item_name: string;
  model_number: string;
  brand_name: string;
}

const PRICING_TIERS: PricingTier[] = [
  { code: 'RD', name: 'Regional Distributor', price: 0 },
  { code: 'PD', name: 'Provincial Distributor', price: 0 },
  { code: 'DD', name: 'District Distributor', price: 0 },
  { code: 'CD', name: 'City Distributor', price: 0 },
  { code: 'RS', name: 'Reseller', price: 0 },
  { code: 'SUB', name: 'Sub-Reseller', price: 0 },
  { code: 'SRP', name: 'Suggested Retail Price', price: 0 },
];

export default function ItemPricingPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  
  const [item, setItem] = useState<Item | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [pricing, setPricing] = useState<ItemPricing>({
    item: parseInt(itemId || '0'),
    regional_distributor: 0,
    provincial_distributor: 0,
    district_distributor: 0,
    city_distributor: 0,
    reseller: 0,
    sub_reseller: 0,
    srp: 0,
    is_active: true,
  });
  const [existingPricingId, setExistingPricingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'loading';
  }>({ show: false, message: '', type: 'success' });
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (itemId) {
      fetchItemAndPricing();
    }
  }, [itemId]);

  const fetchItemAndPricing = async () => {
    try {
      setLoading(true);
      
      // Fetch item details
      const itemResponse = await api.get(`/items/${itemId}/`);
      setItem(itemResponse.data);

      // Try to fetch existing pricing
      try {
        const pricingResponse = await api.get(`/item-pricing/?item_id=${itemId}`);
        if (pricingResponse.data.results && pricingResponse.data.results.length > 0) {
          const existingPricing = pricingResponse.data.results[0];
          setPricing(existingPricing);
          setExistingPricingId(existingPricing.id);
        }
      } catch (pricingError) {
        // No existing pricing found, use default values
        console.log('No existing pricing found, using defaults');
      }
    } catch (error) {
      console.error('Error fetching item and pricing:', error);
      setToast({
        show: true,
        message: 'Failed to load item information',
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (tierField: string, value: string) => {
    const numericValue = parseFloat(value) || 0;
    setPricing(prev => ({
      ...prev,
      [tierField]: numericValue
    }));
    
    // Clear validation errors when user makes changes
    setValidationErrors([]);
  };

  const validatePricingHierarchy = (): string[] => {
    const errors: string[] = [];
    const prices = [
      { name: 'Regional Distributor', value: pricing.regional_distributor },
      { name: 'Provincial Distributor', value: pricing.provincial_distributor },
      { name: 'District Distributor', value: pricing.district_distributor },
      { name: 'City Distributor', value: pricing.city_distributor },
      { name: 'Reseller', value: pricing.reseller },
      { name: 'Sub-Reseller', value: pricing.sub_reseller },
      { name: 'SRP', value: pricing.srp },
    ];

    // Check if any prices are negative
    prices.forEach(price => {
      if (price.value < 0) {
        errors.push(`${price.name} price cannot be negative`);
      }
    });

    // Check hierarchy: each tier should be >= the next tier
    for (let i = 0; i < prices.length - 1; i++) {
      if (prices[i].value > 0 && prices[i + 1].value > 0 && prices[i].value < prices[i + 1].value) {
        errors.push(`${prices[i].name} price should be greater than or equal to ${prices[i + 1].name} price`);
      }
    }

    return errors;
  };

  const handleSave = async () => {
    const errors = validatePricingHierarchy();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    try {
      setSaving(true);
      setToast({ show: true, message: 'Saving pricing...', type: 'loading' });

      if (existingPricingId) {
        // Update existing pricing
        await api.put(`/item-pricing/${existingPricingId}/`, pricing);
      } else {
        // Create new pricing
        const response = await api.post('/item-pricing/', pricing);
        setExistingPricingId(response.data.id);
      }

      setToast({
        show: true,
        message: 'Pricing saved successfully!',
        type: 'success'
      });

      // Auto-hide success toast after 2 seconds
      setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, 2000);
    } catch (error: any) {
      console.error('Error saving pricing:', error);
      let errorMessage = 'Failed to save pricing';
      
      if (error.response?.data?.pricing_hierarchy) {
        errorMessage = error.response.data.pricing_hierarchy;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      setToast({
        show: true,
        message: errorMessage,
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const getTierFieldName = (tierCode: string): keyof ItemPricing => {
    const fieldMap: Record<string, keyof ItemPricing> = {
      'RD': 'regional_distributor',
      'PD': 'provincial_distributor',
      'DD': 'district_distributor',
      'CD': 'city_distributor',
      'RS': 'reseller',
      'SUB': 'sub_reseller',
      'SRP': 'srp',
    };
    return fieldMap[tierCode] || 'srp';
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
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
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
            </button>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Item Pricing Management</h1>
              <div className="text-gray-600">
                <p className="font-medium">{item.item_name}</p>
                <p className="text-sm">Model: {item.model_number} | Brand: {item.brand_name}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <DollarSign className="h-8 w-8 text-[#0504AA]" />
            </div>
          </div>
        </div>
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-red-500 mr-3 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800 mb-1">Pricing Validation Errors</h3>
              <ul className="text-sm text-red-600 space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Pricing Tiers */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Pricing Tiers</h2>
          <p className="text-gray-600 text-sm">
            Set prices for each distributor tier. Higher tiers should have higher or equal prices.
          </p>
        </div>

        <div className="p-6">          <div className="grid gap-6">
            {PRICING_TIERS.map((tier, index) => {
              const fieldName = getTierFieldName(tier.code);
              const currentPrice = pricing[fieldName] as number;
              
              return (
                <div
                  key={tier.code}
                  className="p-4 border border-gray-200 bg-white rounded-lg"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center bg-gray-100 text-gray-700 font-semibold border">
                        {tier.code}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{tier.name}</h3>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span className="text-gray-500">₱</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={currentPrice}
                        onChange={(e) => handlePriceChange(fieldName, e.target.value)}
                        className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0504AA] focus:border-transparent"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                checked={pricing.is_active}
                onChange={(e) => setPricing(prev => ({ ...prev, is_active: e.target.checked }))}
                className="h-4 w-4 text-[#0504AA] focus:ring-[#0504AA] border-gray-300 rounded"
              />
              <label htmlFor="is_active" className="text-sm text-gray-700">
                Active pricing (uncheck to disable this pricing)
              </label>
            </div>
            
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center space-x-2 bg-[#0504AA] text-white px-6 py-2 rounded-lg hover:bg-opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving...' : 'Save Pricing'}</span>
            </button>
          </div>
        </div>
      </div>      {/* Toast Notification */}
      <Toast
        title={
          toast.type === 'loading' ? 'Saving...' : 
          toast.type === 'success' ? 'Success' : 'Error'
        }
        message={toast.message}
        type={toast.type}
        duration={toast.type === 'loading' ? null : 3000}
        isVisible={toast.show}
        onClose={() => setToast(prev => ({ ...prev, show: false }))}
      />
        </div>
      </div>
    </div>
  );
}
