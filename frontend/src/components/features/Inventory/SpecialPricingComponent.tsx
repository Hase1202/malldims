import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { DollarSign, Users, ArrowRight } from 'lucide-react';

interface SpecialPricingData {
    customer_id: number;
    customer_name: string;
    discount: number;
    created_at: string;
    created_by?: {
        username: string;
        first_name?: string;
        last_name?: string;
    } | null;
}

interface SpecialPricingComponentProps {
    itemId: string;
}

const SpecialPricingComponent: React.FC<SpecialPricingComponentProps> = ({ itemId }) => {
    const navigate = useNavigate();
    const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

    // Fetch special pricing for this item
    const { data: specialPricing, isLoading } = useQuery({
        queryKey: ['item-special-pricing', itemId],
        queryFn: async () => {
            try {
                const baseUrl = process.env.NODE_ENV === 'development' 
                    ? 'http://127.0.0.1:8000' 
                    : window.location.origin;
                const response = await fetch(`${baseUrl}/api/items/${itemId}/special_pricing/`, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
                        'Content-Type': 'application/json'
                    }
                });
                if (response.ok) {
                    return await response.json() as SpecialPricingData[];
                } else if (response.status === 401) {
                    console.error('Authentication failed - token may be expired');
                    // You might want to redirect to login or refresh token here
                    return [];
                } else {
                    console.error('Failed to fetch special pricing:', response.status, response.statusText);
                    return [];
                }
            } catch (error) {
                console.error('Error fetching special pricing:', error);
                return [];
            }
        },
        enabled: !!itemId
    });

    const handleCustomerSelect = (customerId: number) => {
        setSelectedCustomerId(customerId);
    };

    const handleGoToPricingTier = () => {
        if (selectedCustomerId) {
            // Navigate to pricing tier page for the selected customer
            navigate(`/customers/${selectedCustomerId}/pricing`);
        }
    };

    if (isLoading) {
        return (
            <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[#2C2C2C]">
                    <DollarSign className="h-5 w-5 text-[#0504AA]" />
                    Special Pricing
                </h2>
                <div className="text-[#646464] py-4">Loading special pricing...</div>
            </div>
        );
    }

    return (
        <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-[#2C2C2C]">
                <DollarSign className="h-5 w-5 text-[#0504AA]" />
                Special Pricing
            </h2>
            
            {specialPricing && specialPricing.length > 0 ? (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                    {specialPricing.map((pricing, idx) => (
                        <div 
                            key={idx}
                            className={`p-4 border rounded-lg transition-colors cursor-pointer ${
                                selectedCustomerId === pricing.customer_id
                                    ? 'bg-blue-50 border-blue-300'
                                    : 'hover:bg-gray-50 hover:border-gray-300'
                            }`}
                            onClick={() => handleCustomerSelect(pricing.customer_id)}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Users className="h-5 w-5 text-[#0504AA]" />
                                    <div>
                                        <p className="font-medium text-[#2C2C2C]">
                                            {pricing.customer_name}
                                        </p>
                                        <p className="text-sm text-[#646464]">
                                            Discount: {pricing.discount}%
                                        </p>
                                        {pricing.created_by && (
                                            <p className="text-xs text-[#646464]">
                                                Created by: {pricing.created_by.first_name} {pricing.created_by.last_name} ({pricing.created_by.username})
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-[#646464]">
                                        {new Date(pricing.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    {selectedCustomerId && (
                        <div className="mt-4 pt-4 border-t">
                            <button
                                onClick={handleGoToPricingTier}
                                className="flex items-center gap-2 bg-[#0504AA] text-white px-4 py-2 rounded-lg hover:bg-[#0504AA]/90 transition-colors"
                            >
                                Go to Pricing Tier Page
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-[#646464] py-4">
                    No special pricing found for this item.
                </div>
            )}
        </div>
    );
};

export default SpecialPricingComponent;
