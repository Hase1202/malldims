import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle, DollarSign } from 'lucide-react';
import api from '../../lib/api';
import Toast from '../../components/common/Toast';
import Sidebar from '../../components/common/Sidebar';
import SpecialPricingByCustomer from '../../components/features/Inventory/SpecialPricingByCustomer';

interface ItemTierPricing {
  id?: number;
  item: number;
  pricing_tier: string;
  price: number;
}

interface Item {
  item_id: number;
  item_name: string;
  model_number: string;
  brand_name: string;
}

interface TierPriceData {
  [key: string]: number;
}

const PRICING_TIERS: { code: string; name: string }[] = [
  { code: 'RD', name: 'Regional Distributor' },
  { code: 'PD', name: 'Provincial Distributor' },
  { code: 'DD', name: 'District Distributor' },
  { code: 'CD', name: 'City Distributor' },
  { code: 'RS', name: 'Reseller' },
  { code: 'SUB-RS', name: 'Sub-Reseller' },
  { code: 'SRP', name: 'Suggested Retail Price' },
];

export default function ItemPricingPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  
  const [item, setItem] = useState<Item | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [tierPrices, setTierPrices] = useState<TierPriceData>({});
  const [existingPricing, setExistingPricing] = useState<ItemTierPricing[]>([]);
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

      // Fetch existing tier pricing
      try {
        const pricingResponse = await api.get(`/item-tier-pricing/?item=${itemId}`);
        const pricingData = pricingResponse.data.results || pricingResponse.data;
        setExistingPricing(pricingData);
        
        // Convert array to object for easier manipulation
        const priceData: TierPriceData = {};
        pricingData.forEach((pricing: ItemTierPricing) => {
          priceData[pricing.pricing_tier] = pricing.price;
        });
        setTierPrices(priceData);
      } catch (pricingError) {
        console.log('No existing pricing found, using defaults');
        setTierPrices({});
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

  const handlePriceChange = (tierCode: string, value: string) => {
    const numericValue = parseFloat(value) || 0;
    setTierPrices(prev => ({
      ...prev,
      [tierCode]: numericValue
    }));
    
    // Clear validation errors when user makes changes
    setValidationErrors([]);
  };

  const validatePricingHierarchy = (): string[] => {
    const errors: string[] = [];
    const tierOrder = ['RD', 'PD', 'DD', 'CD', 'RS', 'SUB-RS', 'SRP'];
    
    // Check if any prices are negative
    tierOrder.forEach(tier => {
      const price = tierPrices[tier] || 0;
      if (price < 0) {
        const tierName = PRICING_TIERS.find(t => t.code === tier)?.name || tier;
        errors.push(`${tierName} price cannot be negative`);
      }
    });

    // Check hierarchy: each tier should be >= the next tier
    for (let i = 0; i < tierOrder.length - 1; i++) {
      const currentTier = tierOrder[i];
      const nextTier = tierOrder[i + 1];
      const currentPrice = tierPrices[currentTier] || 0;
      const nextPrice = tierPrices[nextTier] || 0;
      
      if (currentPrice > 0 && nextPrice > 0 && currentPrice < nextPrice) {
        const currentTierName = PRICING_TIERS.find(t => t.code === currentTier)?.name || currentTier;
        const nextTierName = PRICING_TIERS.find(t => t.code === nextTier)?.name || nextTier;
        errors.push(`${currentTierName} price should be greater than or equal to ${nextTierName} price`);
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

      // Create/update pricing for each tier
      const promises = PRICING_TIERS.map(async (tier) => {
        const price = tierPrices[tier.code] || 0;
        if (price <= 0) return; // Skip tiers with no price set

        // Find existing pricing for this tier
        const existing = existingPricing.find(p => p.pricing_tier === tier.code);
        
        if (existing) {
          // Update existing
          await api.put(`/item-tier-pricing/${existing.id}/`, {
            item: parseInt(itemId!),
            pricing_tier: tier.code,
            price: price
          });
        } else {
          // Create new
          await api.post('/item-tier-pricing/', {
            item: parseInt(itemId!),
            pricing_tier: tier.code,
            price: price
          });
        }
      });

      await Promise.all(promises);

      setToast({
        show: true,
        message: 'Pricing saved successfully!',
        type: 'success'
      });

      // Refresh data
      fetchItemAndPricing();

      // Auto-hide success toast after 2 seconds
      setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, 2000);
    } catch (error: any) {
      console.error('Error saving pricing:', error);
      let errorMessage = 'Failed to save pricing';
      
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
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

  if (loading) {
    return (
      <div className="flex h-screen">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
            <p className="mt-2 text-gray-600">Loading item pricing...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-64">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/inventory')}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Item Pricing</h1>
                <p className="text-gray-600">{item?.item_name || 'Loading...'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
                  <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                    {validationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Pricing Form */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <div className="flex items-center gap-3">
                <DollarSign className="h-6 w-6 text-blue-600" />
                <div>
                  <h2 className="text-lg font-semibold">Tier Pricing</h2>
                  <p className="text-gray-600 text-sm">
                    Set prices for each distributor tier. Higher tiers should have higher or equal prices.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <div className="grid gap-6">
                {PRICING_TIERS.map((tier) => {
                  const currentPrice = tierPrices[tier.code] || 0;
                  
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
                            onChange={(e) => handlePriceChange(tier.code, e.target.value)}
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
              <div className="flex items-center justify-end">
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
          </div>

          {/* Special Pricing by Customer */}
          <div className="bg-white rounded-lg shadow-sm mt-6">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Special Pricing by Customer</h2>
              <p className="text-gray-600 text-sm">
                View customers with special pricing for this item.
              </p>
            </div>
            <SpecialPricingByCustomer itemId={parseInt(itemId || '0')} />
          </div>
        </div>
      </div>

      {/* Toast Notification */}
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
  );
}
