import { useState, useEffect } from 'react';
import { User, DollarSign, AlertCircle } from 'lucide-react';
import { Customer } from '../../../types/inventory';
import { customersApi } from '../../../lib/api';

interface SpecialPricingByCustomerProps {
  itemId: number;
}

interface SpecialPricingWithCustomer {
  customer: number;
  item: number;
  discount: number;
  customer_name?: string;
  customer_type?: string;
  platform?: string;
}

const SpecialPricingByCustomer = ({ itemId }: SpecialPricingByCustomerProps) => {
  const [specialPricing, setSpecialPricing] = useState<SpecialPricingWithCustomer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSpecialPricing();
    fetchCustomers();
  }, [itemId]);

  const fetchSpecialPricing = async () => {
    try {
      const response = await fetch(`/api/customer-special-pricing/?item=${itemId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setSpecialPricing(data.results || data);
      } else if (response.status === 401) {
        console.error('Authentication failed - token may be expired');
      } else {
        console.error('Failed to fetch special pricing:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error fetching special pricing:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await customersApi.getAll();
      if (response.status === 'success' && response.data) {
        setCustomers(Array.isArray(response.data) ? response.data : response.data.results || []);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const getCustomerDetails = (customerId: number) => {
    return customers.find(customer => customer.customer_id === customerId);
  };

  const calculateFinalPrice = (tierPrice: number, discount: number): number => {
    return Math.max(0, tierPrice + discount); // discount is negative, so we add it
  };

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent"></div>
        <p className="mt-2 text-gray-600">Loading special pricing...</p>
      </div>
    );
  }

  if (specialPricing.length === 0) {
    return (
      <div className="p-6 text-center">
        <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Special Pricing</h3>
        <p className="text-gray-600">
          This item doesn't have any special pricing for customers. Special pricing can be set in the customer details page.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="text-left p-4 font-medium text-gray-700">Customer</th>
              <th className="text-left p-4 font-medium text-gray-700">Type</th>
              <th className="text-left p-4 font-medium text-gray-700">Platform</th>
              <th className="text-right p-4 font-medium text-gray-700">Tier Price</th>
              <th className="text-right p-4 font-medium text-gray-700">Discount</th>
              <th className="text-right p-4 font-medium text-gray-700">Final Price</th>
            </tr>
          </thead>
          <tbody>
            {specialPricing.map((pricing) => {
              const customer = getCustomerDetails(pricing.customer);
              const tierPrice = 0; // This would need to be calculated based on customer's tier pricing
              const finalPrice = calculateFinalPrice(tierPrice, pricing.discount);
              
              return (
                <tr key={`${pricing.customer}-${pricing.item}`} className="border-b hover:bg-gray-50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <User className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {customer?.company_name || 'Unknown Customer'}
                        </p>
                        <p className="text-sm text-gray-600">
                          {customer?.contact_person}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {customer?.customer_type || 'N/A'}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-gray-600 capitalize">
                      {customer?.platform?.replace('_', ' ') || 'Not set'}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <DollarSign className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">₱{tierPrice.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <DollarSign className="h-4 w-4 text-red-400" />
                      <span className="font-medium text-red-600">₱{pricing.discount.toFixed(2)}</span>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="font-bold text-green-600">₱{finalPrice.toFixed(2)}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900">About Special Pricing</h4>
            <p className="text-sm text-blue-700 mt-1">
              Special pricing overrides the standard tier pricing for specific customers. 
              The discount amount is applied to the customer's tier price to calculate the final price.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpecialPricingByCustomer;
