import React, { useState, useEffect } from "react";
import { User, PricingTierOption } from "../../types/inventory";
import { usersApi, pricingApi } from "../../lib/api";
import { useAuthContext } from "../../context/AuthContext";

interface UserWithTier extends User {
  cost_tier_display?: string;
  allowed_selling_tiers?: string[];
}

const UserTierManagement: React.FC = () => {
  const { user: currentUser } = useAuthContext();
  const [users, setUsers] = useState<UserWithTier[]>([]);
  const [pricingTiers, setPricingTiers] = useState<PricingTierOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load users and pricing tiers
      const [usersResponse, tiersResponse] = await Promise.all([
        usersApi.getAll(),
        pricingApi.getAllTiers(),
      ]);

      if (usersResponse.status === "success") {
        setUsers(usersResponse.data);
      }

      if (
        tiersResponse.status === "success" &&
        tiersResponse.data.pricing_tiers
      ) {
        setPricingTiers(tiersResponse.data.pricing_tiers);
      }
    } catch (err) {
      setError("Failed to load data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateUserTier = async (userId: number, newTier: string) => {
    try {
      const response = await usersApi.update(userId.toString(), {
        cost_tier: newTier,
      });

      if (response.status === "success") {
        setSuccess(`User tier updated successfully`);
        setTimeout(() => setSuccess(null), 3000);

        // Reload data to show updated information
        await loadData();
      } else {
        setError(response.message || "Failed to update user tier");
      }
    } catch (err) {
      setError("Failed to update user tier");
      console.error(err);
    }
  };

  const getTierHierarchy = () => {
    return {
      RD: 0,
      PD: 1,
      DD: 2,
      CD: 3,
      RS: 4,
      "SUB-RS": 5,
      SRP: 6,
    };
  };

  const getAllowedSellingTiers = (userTier: string | null) => {
    if (!userTier) return ["All tiers allowed"];

    const hierarchy = getTierHierarchy();
    const userLevel = hierarchy[userTier as keyof typeof hierarchy];

    if (userLevel === undefined) return ["All tiers allowed"];

    return Object.keys(hierarchy)
      .filter((tier) => hierarchy[tier as keyof typeof hierarchy] > userLevel)
      .map((tier) => {
        const tierOption = pricingTiers.find((pt) => pt.value === tier);
        return tierOption ? tierOption.label : tier;
      });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-center mt-2">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">
            User Tier Management
          </h1>
          <p className="text-gray-600 mt-2">
            Manage user cost tiers to control their selling price restrictions
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mx-6 mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <div className="text-red-600 text-sm">{error}</div>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {success && (
          <div className="mx-6 mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <div className="text-green-600 text-sm">{success}</div>
              <button
                onClick={() => setSuccess(null)}
                className="ml-auto text-green-400 hover:text-green-600"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Explanation Panel */}
        <div className="mx-6 mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium text-blue-900 mb-2">
            How Tier Restrictions Work
          </h3>
          <ul className="text-blue-800 text-sm space-y-1">
            <li>
              • Users can only sell at tiers <strong>below</strong> their own
              cost tier
            </li>
            <li>
              • If a user's cost tier is "PD" (Provincial Distributor), they can
              sell at: DD, CD, RS, SUB-RS, SRP
            </li>
            <li>• They cannot sell at their own tier (PD) or higher (RD)</li>
            <li>
              • This prevents users from selling products at prices equal to or
              lower than what they paid
            </li>
            <li>
              • Users with no cost tier assigned can sell at any tier (typically
              for admins)
            </li>
          </ul>
        </div>

        {/* Users Table */}
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Current Cost Tier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Allowed Selling Tiers
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.account_id} className="hover:bg-gray-50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {user.username}
                        </div>
                        <div className="text-sm text-gray-500">
                          {user.first_name} {user.last_name}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div>
                        {user.cost_tier ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            {user.cost_tier}
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                            Not Set
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">
                        {getAllowedSellingTiers(user.cost_tier).length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {getAllowedSellingTiers(user.cost_tier).map(
                              (tier, index) => (
                                <span
                                  key={index}
                                  className="inline-flex px-1 py-0.5 text-xs rounded bg-orange-100 text-orange-800"
                                >
                                  {tier}
                                </span>
                              ),
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500 text-xs">
                            No restrictions
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <select
                        value={user.cost_tier || ""}
                        onChange={(e) =>
                          updateUserTier(user.account_id, e.target.value)
                        }
                        className="text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={user.account_id === currentUser?.account_id}
                      >
                        <option value="">No Tier (Admin)</option>
                        {pricingTiers.map((tier) => (
                          <option key={tier.value} value={tier.value}>
                            {tier.label}
                          </option>
                        ))}
                      </select>
                      {user.account_id === currentUser?.account_id && (
                        <div className="text-xs text-gray-500 mt-1">
                          Cannot edit own tier
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tier Hierarchy Reference */}
        <div className="p-6 border-t border-gray-200">
          <h3 className="font-medium text-gray-900 mb-3">
            Pricing Tier Hierarchy
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
            {pricingTiers.map((tier, index) => (
              <div
                key={tier.value}
                className={`p-3 rounded-lg text-center text-sm ${
                  index === 0
                    ? "bg-red-100 text-red-800"
                    : index === pricingTiers.length - 1
                      ? "bg-green-100 text-green-800"
                      : "bg-blue-100 text-blue-800"
                }`}
              >
                <div className="font-medium">{tier.value}</div>
                <div className="text-xs mt-1">{tier.label}</div>
                {index === 0 && (
                  <div className="text-xs mt-1 font-medium">Highest</div>
                )}
                {index === pricingTiers.length - 1 && (
                  <div className="text-xs mt-1 font-medium">Lowest</div>
                )}
              </div>
            ))}
          </div>
          <div className="text-xs text-gray-600 mt-3 text-center">
            Users can sell at any tier to the right of their cost tier →
          </div>
        </div>

        {/* Example Scenarios */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <h3 className="font-medium text-gray-900 mb-3">Example Scenarios</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg border">
              <h4 className="font-medium text-blue-900 mb-2">
                Scenario 1: Provincial Distributor
              </h4>
              <div className="text-sm text-gray-700 space-y-2">
                <div>
                  • User's Cost Tier:{" "}
                  <span className="font-medium text-green-600">
                    PD (Provincial Distributor)
                  </span>
                </div>
                <div>
                  • Can sell at:{" "}
                  <span className="font-medium text-orange-600">
                    DD, CD, RS, SUB-RS, SRP
                  </span>
                </div>
                <div>
                  • Cannot sell at:{" "}
                  <span className="font-medium text-red-600">RD, PD</span>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  This ensures they always make a profit by selling at lower
                  tiers than their purchase tier.
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border">
              <h4 className="font-medium text-blue-900 mb-2">
                Scenario 2: Reseller
              </h4>
              <div className="text-sm text-gray-700 space-y-2">
                <div>
                  • User's Cost Tier:{" "}
                  <span className="font-medium text-green-600">
                    RS (Reseller)
                  </span>
                </div>
                <div>
                  • Can sell at:{" "}
                  <span className="font-medium text-orange-600">
                    SUB-RS, SRP
                  </span>
                </div>
                <div>
                  • Cannot sell at:{" "}
                  <span className="font-medium text-red-600">
                    RD, PD, DD, CD, RS
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-2">
                  Limited selling options but ensures profitability.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserTierManagement;
