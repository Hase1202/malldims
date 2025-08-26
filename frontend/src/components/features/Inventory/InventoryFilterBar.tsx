import { Filter } from 'lucide-react';
import FilterDropdown from '../../common/FilterDropdown';
import { useBrands } from '../../../hooks/useBrands';

interface FilterState {
    item_type: string | null;
    category: string | null;
    brand: string | null;
    availability_status: string | null;
}

interface InventoryFilterBarProps {
    onFiltersChange: (filters: FilterState) => void;
    currentFilters: FilterState;
}

const InventoryFilterBar: React.FC<InventoryFilterBarProps> = ({
    onFiltersChange,
    currentFilters
}) => {
    const { brands: brandData, loading: isLoadingBrands } = useBrands();

    const itemTypeOptions = [
        { value: 'Skincare Products', label: 'Skincare Products' },
        { value: 'Makeup Products', label: 'Makeup Products' },
        { value: 'Hair Care Products', label: 'Hair Care Products' },
        { value: 'Fragrance Products', label: 'Fragrance Products' },
        { value: 'Body Care Products', label: 'Body Care Products' },
        { value: 'Beauty Tools & Accessories', label: 'Beauty Tools & Accessories' }
    ];

    const categoryOptions = [
        { value: 'Premium Brand', label: 'Premium Brand' },
        { value: 'Drugstore Brand', label: 'Drugstore Brand' },
        { value: 'Organic/Natural', label: 'Organic/Natural' },
        { value: 'Korean Beauty', label: 'Korean Beauty' },
        { value: 'Luxury Collection', label: 'Luxury Collection' },
        { value: 'Professional Use', label: 'Professional Use' }
    ];

    const availabilityOptions = [
        { value: 'In Stock', label: 'In Stock' },
        { value: 'Low Stock', label: 'Low Stock' },
        { value: 'Out of Stock', label: 'Out of Stock' }
    ];

    const brands = brandData.map(b => b.brand_name);

    const handleFilterChange = (key: keyof FilterState, value: string | null) => {
        let newValue = value;
        
        // If it's a brand filter, convert the brand name to ID
        if (key === 'brand' && value) {
            const brand = brandData.find(b => b.brand_name === value);
            newValue = brand ? brand.brand_id.toString() : null;
        }

        const newFilters = { ...currentFilters, [key]: newValue };
        onFiltersChange(newFilters);
    };

    const getBrandName = (brandId: string | null) => {
        if (!brandId) return null;
        const brand = brandData.find(b => b.brand_id.toString() === brandId);
        return brand ? brand.brand_name : null;
    };

    const activeFilterCount = Object.values(currentFilters).filter(Boolean).length;

    return (
        <div className="flex items-center gap-2.5 md:flex-wrap md:gap-3 overflow-x-auto md:overflow-visible pb-2 md:pb-0 -mb-2 md:mb-0 scrollbar-hide">
            <button 
                onClick={() => {
                    const allNull = {
                        item_type: null,
                        category: null,
                        brand: null,
                        availability_status: null
                    };
                    onFiltersChange(allNull);
                }}
                className={`flex-shrink-0 py-1.5 cursor-pointer px-3.5 rounded-lg transition-all
                    ${activeFilterCount === 0 
                        ? 'bg-[#0504AA] text-white' 
                        : 'border-[1.5px] border-[#EBEAEA] text-[#6F6F6F] hover:bg-gray-50'
                    }`}
            >
                All
            </button>

            <FilterDropdown
                label="Type"
                options={itemTypeOptions}
                value={currentFilters.item_type}
                onChange={(value: string | null) => handleFilterChange('item_type', value)}
            />

            <FilterDropdown
                label="Category"
                options={categoryOptions}
                value={currentFilters.category}
                onChange={(value: string | null) => handleFilterChange('category', value)}
            />

            <FilterDropdown
                label="Brand"
                options={brands}
                value={getBrandName(currentFilters.brand)}
                onChange={(value: string | null) => handleFilterChange('brand', value)}
                isLoading={isLoadingBrands}
            />

            <FilterDropdown
                label="Availability"
                options={availabilityOptions}
                value={currentFilters.availability_status}
                onChange={(value: string | null) => handleFilterChange('availability_status', value)}
            />

            <div className={`flex-shrink-0 flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg border-[1.5px] border-[#DADAF3] text-[#0504AA] bg-[#F2F2FB]`}>
                <Filter className="h-4 w-4" />
                Filters - {activeFilterCount}
            </div>
        </div>
    );
};

export default InventoryFilterBar;