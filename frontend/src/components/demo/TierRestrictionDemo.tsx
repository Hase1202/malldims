import React, { useState, useEffect } from 'react';
import { pricingApi } from '../../lib/api';
import { PricingTierOption, UserTierRestrictions } from '../../types/inventory';

const TierRestrictionDemo: React.FC = () => {
  const [userTierRestrictions, setUserTierRestrictions] = useState<UserTierRestrictions | null>(null);
  const [allTiers, setAllTiers] = useState<PricingTierOption[]>([]);
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [simulatedUserTier, setSimulatedUserTier] = useState<string>('PD');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTierData();
  }, []);

  const loadTierData = async () => {
    try {
      setLoading(true);

      // Get all available tiers
      const allTiersResponse = await pricingApi.getAllTiers();
      if (allTiersResponse.status === 'success' && allTiersResponse.data.pricing_tiers) {
        setAllTiers(allTiersResponse.data.pricing_tiers);
      }

      // Get user's allowed tiers (this will be based on actual logged-in user)
      const userTiersResponse = await pricingApi.getUserAllowedTiers();
      if (userTiersResponse.status === 'success') {
        setUserTierRestrictions(userTiersResponse.data);
      }
    } catch (error) {
      console.error('Error loading tier data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTierHierarchy = () => {
    return {
      'RD': { level: 0, label: 'Regional Distributor', color: 'bg-red-500' },
      'PD': { level: 1, label: 'Provincial Distributor', color: 'bg-orange-500' },
      'DD': { level: 2, label: 'District Distributor', color: 'bg-yellow-500' },
      'CD': { level: 3, label: 'City Distributor', color: 'bg-green-500' },
      'RS': { level: 4, label: 'Reseller', color: 'bg-blue-500' },
      'SUB-RS': { level: 5, label: 'Sub-Reseller', color: 'bg-indigo-500' },
      'SRP': { level: 6, label: 'Suggested Retail Price', color: 'bg-purple-500' }
    };
  };

  const simulateUserTierChange = (newTier: string) => {
    setSimulatedUserTier(newTier);
    setSelectedTier('');
  };

  const getSimulatedAllowedTiers = (userTier: string) => {
    if (!userTier) return allTiers.map(t => t.value);

    const hierarchy = getTierHierarchy();
    const userLevel = hierarchy[userTier as keyof typeof hierarchy]?.level;

    if (userLevel === undefined) return allTiers.map(t => t.value);

    return Object.keys(hierarchy).filter(tier => {
      const tierLevel = hierarchy[tier as keyof typeof hierarchy]?.level;
      return tierLevel !== undefined && tierLevel > userLevel;
    });
  };

  const isAllowedTier = (tier: string) => {
    return getSimulatedAllowedTiers(simulatedUserTier).includes(tier);
  };

  const getRestrictionMessage = (tier: string) => {
    const hierarchy = getTierHierarchy();
    const userLevel = hierarchy[simulatedUserTier as keyof typeof hierarchy]?.level;
    const tierLevel = hierarchy[tier as keyof typeof hierarchy]?.level;

    if (userLevel === undefined || tierLevel === undefined) return '';

    if (tierLevel <= userLevel) {
      return `❌ Cannot sell at ${tier} - it's at or above your cost tier (${simulatedUserTier})`;
    } else {
      return `✅ Can sell at ${tier} - it's below your cost tier`;
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-center mt-2">Loading tier data...</p>
      </div>
    );
  }

  const hierarchy = getTierHierarchy();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">Pricing Tier Restriction Demo</h1>
          <p className="text-gray-600 mt-2">
            See how dynamic pricing restrictions work based on user cost tiers
          </p>
        </div>

        {/* User Tier Simulation */}
        <div className="p-6 border-b border-gray-200 bg-blue-50">
          <h2 className="text-lg font-semibold mb-4">Simulate User Cost Tier</h2>
          <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
            {allTiers.map((tier) => (
              <button
                key={tier.value}
                onClick={() => simulateUserTierChange(tier.value)}
                className={`p-3 rounded-lg text-center text-sm transition-all ${
                  simulatedUserTier === tier.value
                    ? 'bg-blue-600 text-white shadow-lg transform scale-105'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-blue-100'
                }`}
              >
                <div className="font-medium">{tier.value}</div>
                <div className="text-xs mt-1">{tier.label}</div>
              </button>
            ))}
          </div>
          <div className="mt-3 text-sm text-blue-700">
            Current simulated user cost tier: <strong>{simulatedUserTier}</strong>
          </div>
        </div>

        {/* Tier Hierarchy Visualization */}
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Pricing Tier Hierarchy</h2>
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-red-600">Highest Price</span>
            <span className="text-sm font-medium text-purple-600">Lowest Price</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
            {allTiers.map((tier, index) => {
              const tierInfo = hierarchy[tier.value as keyof typeof hierarchy];
              const isUserTier = tier.value === simulatedUserTier;
              const isAllowed = isAllowedTier(tier.value);

              return (
                <div
                  key={tier.value}
                  className={`p-4 rounded-lg text-center text-white relative ${
                    isUserTier
                      ? 'ring-4 ring-yellow-300 ring-opacity-50'
                      : ''
                  } ${tierInfo?.color || 'bg-gray-500'}`}
                >
                  <div className="font-medium text-lg">{tier.value}</div>
                  <div className="text-xs mt-1 opacity-90">{tier.label}</div>
                  {isUserTier && (
                    <div className="absolute -top-2 -right-2">
                      <span className="bg-yellow-400 text-black text-xs px-2 py-1 rounded-full font-bold">
                        YOU
                      </span>
                    </div>
                  )}
                  <div className="mt-2">
                    {isUserTier ? (
                      <span className="text-xs bg-black bg-opacity-30 px-2 py-1 rounded">
                        Your Tier
                      </span>
                    ) : isAllowed ? (
                      <span className="text-xs bg-green-500 bg-opacity-70 px-2 py-1 rounded">
                        ✅ Can Sell
                      </span>
                    ) : (
                      <span className="text-xs bg-red-500 bg-opacity-70 px-2 py-1 rounded">
                        ❌ Restricted
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pricing Selection Demo */}
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Try Selecting a Pricing Tier</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Pricing Tier for Transaction
              </label>
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Choose a pricing tier...</option>
                {allTiers.map((tier) => (
                  <option
                    key={tier.value}
                    value={tier.value}
                    disabled={!isAllowedTier(tier.value)}
                    className={!isAllowedTier(tier.value) ? 'text-gray-400' : ''}
                  >
                    {tier.label} ({tier.value}) {!isAllowedTier(tier.value) ? '🚫' : '✅'}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Selection Result:</h3>
              {selectedTier ? (
                <div className={`p-3 rounded-lg ${
                  isAllowedTier(selectedTier)
                    ? 'bg-green-100 text-green-800 border border-green-200'
                    : 'bg-red-100 text-red-800 border border-red-200'
                }`}>
                  <div className="font-medium">
                    {isAllowedTier(selectedTier) ? '✅ Success!' : '❌ Restricted!'}
                  </div>
                  <div className="text-sm mt-1">
                    {getRestrictionMessage(selectedTier)}
                  </div>
                </div>
              ) : (
                <div className="text-gray-500 italic">
                  Select a tier above to see the result
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Business Logic Explanation */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">Business Rule</h3>
                <p className="text-blue-800 text-sm">
                  Users can only sell at pricing tiers <strong>below</strong> their own cost tier.
                  This ensures they always make a profit and maintains proper pricing hierarchy.
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-medium text-green-900 mb-2">Example Scenario</h3>
                <p className="text-green-800 text-sm">
                  If you're a <strong>Provincial Distributor (PD)</strong>, you can sell at:
                  DD, CD, RS, SUB-RS, SRP. You cannot sell at PD or RD tiers.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-medium text-yellow-900 mb-2">Current Status</h3>
                <div className="text-yellow-800 text-sm space-y-1">
                  <div>Your simulated cost tier: <strong>{simulatedUserTier}</strong></div>
                  <div>Allowed selling tiers: <strong>{getSimulatedAllowedTiers(simulatedUserTier).join(', ')}</strong></div>
                  <div>Restricted tiers: <strong>
                    {allTiers
                      .filter(t => !getSimulatedAllowedTiers(simulatedUserTier).includes(t.value))
                      .map(t => t.value)
                      .join(', ')}
                  </strong></div>
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="font-medium text-purple-900 mb-2">In Practice</h3>
                <p className="text-purple-800 text-sm">
                  When creating sell transactions, the pricing tier dropdown will only show
                  your allowed tiers. Attempting to select restricted tiers will show an error.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-200">
          <p className="text-center text-sm text-gray-600">
            This demo shows how the dynamic pricing system restricts user options based on their cost tier.
            <br />
            Try different user cost tiers above to see how the restrictions change!
          </p>
        </div>
      </div>
    </div>
  );
};

export default TierRestrictionDemo;
