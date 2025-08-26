import { Package2, ArrowBigDownDash, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { itemsApi } from "../../../lib/api"; // IMPORT from api.ts, don't redeclare
import type { Item } from "../../../types/inventory";

interface InventoryStatsProps {
    onFilterChange: (filter: {
        item_type: string | null;
        category: string | null;
        brand: string | null;
        availability_status: string | null;
    }) => void;
}

interface Stats {
    total_items: number;
    low_stock: number;
    out_of_stock: number;
}

export default function InventoryStats({ onFilterChange }: InventoryStatsProps) {
    const [stats, setStats] = useState<Stats>({
        total_items: 0,
        low_stock: 0,
        out_of_stock: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Try to get stats from dedicated endpoint first
                try {
                    const response = await itemsApi.getStats();
                    if (response.status === 'success' && response.data) {
                        setStats(response.data);
                        return;
                    }
                } catch (statsError) {
                    console.log('Stats endpoint not available, calculating from items list...');
                }

                // Fallback: Calculate stats from all items
                const params = new URLSearchParams({ all: 'true' });
                const itemsResponse = await itemsApi.getAll(params);
                
                if (itemsResponse.status === 'success' && itemsResponse.data) {
                    let items: Item[] = [];
                    
                    // Handle different response formats
                    if (Array.isArray(itemsResponse.data)) {
                        items = itemsResponse.data;
                    } else if (itemsResponse.data.results) {
                        items = itemsResponse.data.results;
                    }

                    // Calculate stats from items
                    const calculatedStats = {
                        total_items: items.length,
                        low_stock: items.filter(item => 
                            item.quantity <= item.threshold_value && item.quantity > 0
                        ).length,
                        out_of_stock: items.filter(item => item.quantity === 0).length
                    };

                    setStats(calculatedStats);
                } else {
                    console.error('Failed to fetch items for stats calculation:', itemsResponse.message);
                }
            } catch (error) {
                console.error('Error fetching inventory stats:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    const clearFilters = () => {
        onFilterChange({
            item_type: null,
            category: null,
            brand: null,
            availability_status: null
        });
    };

    const setAvailabilityFilter = (status: 'Low Stock' | 'Out of Stock') => {
        onFilterChange({
            item_type: null,
            category: null,
            brand: null,
            availability_status: status
        });
    };

    return (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Total Beauty Products */}
            <div className="space-y-6">
                <h3 className="text-[#4237C7] font-medium pl-3">
                    Total Beauty Products
                </h3>
                <button 
                    onClick={clearFilters}
                    className="inline-flex items-center text-3xl lg:text-4xl font-semibold text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                    {loading ? '...' : stats.total_items}
                    <Package2 className="ml-2 h-7 w-7 lg:h-9 lg:w-9" />
                </button>
            </div>

            {/* Low Stock - Critical for Beauty Products */}
            <div className="space-y-6">
                <h3 className="text-[#D97708] font-medium pl-3">
                    Low Stock Items
                </h3>
                <button 
                    onClick={() => setAvailabilityFilter('Low Stock')}
                    className="inline-flex items-center text-3xl lg:text-4xl font-semibold text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                    {loading ? '...' : stats.low_stock}
                    <ArrowBigDownDash className="ml-2 h-7 w-7 lg:h-9 lg:w-9" />
                </button>
            </div>

            {/* Out of Stock */}
            <div className="space-y-6">
                <h3 className="text-[#DF3938] font-medium pl-3">
                    Out of Stock
                </h3>
                <button 
                    onClick={() => setAvailabilityFilter('Out of Stock')}
                    className="inline-flex items-center text-3xl lg:text-4xl font-semibold text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                    {loading ? '...' : stats.out_of_stock}
                    <TriangleAlert className="ml-2 h-7 w-7 lg:h-9 lg:w-9" />
                </button>
            </div>
        </section>
    );
}

// DO NOT redeclare itemsApi here - it should only be in lib/api.ts