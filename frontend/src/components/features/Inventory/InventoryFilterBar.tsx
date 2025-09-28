import { Filter } from 'lucide-react';
import FilterDropdown from '../../common/FilterDropdown';
import { useBrands } from '../../../hooks/useBrands';

interface FilterState {
    brand: string | null;
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
                        brand: null
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
                label="Brand"
                options={brands}
                value={getBrandName(currentFilters.brand)}
                onChange={(value: string | null) => handleFilterChange('brand', value)}
                isLoading={isLoadingBrands}
            />

            <div className={`flex-shrink-0 flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg border-[1.5px] border-[#DADAF3] text-[#0504AA] bg-[#F2F2FB]`}>
                <Filter className="h-4 w-4" />
                Filters - {activeFilterCount}
            </div>
        </div>
    );
};

export default InventoryFilterBar;