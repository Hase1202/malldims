import { useState, useEffect } from 'react';
import { Menu } from "lucide-react";
import { useNavigate, useLocation } from 'react-router-dom';
import Sidebar from "../../components/common/Sidebar";
import InventoryTable from "../../components/features/Inventory/InventoryTable";
import InventoryStats from "../../components/features/Inventory/InventoryStats";
import SearchInput from "../../components/common/SearchInput";
import Toast from "../../components/common/Toast";
import { useSearch } from "../../hooks/useSearch";
import InventoryFilterBar from "../../components/features/Inventory/InventoryFilterBar";
import { API_BASE_URL } from '../../lib/api';
import api from '../../lib/api';
import { Item } from '../../types/inventory';
import { useAuthContext } from '../../context/AuthContext';
import { isSales } from '../../utils/permissions';

export default function InventoryPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'loading' | 'success' | 'error'>('success');
    
    const [filters, setFilters] = useState<{
        item_type: string | null;
        category: string | null;
        brand: string | null;
        availability_status: string | null;
    }>({
        item_type: null,
        category: null,
        brand: null,
        availability_status: null
    });
    const [sort, setSort] = useState<{ field: string; direction: 'asc' | 'desc' }>({ field: '', direction: 'asc' });
    const { user } = useAuthContext();

    // Update filters when URL parameters change
    useEffect(() => {
        // Get raw, unprocessed URL parameters
        const rawSearch = location.search;
        console.log('RAW URL search string:', rawSearch);
        
        // Manually parse parameters to avoid encoding issues
        const params = new URLSearchParams(location.search);
        
        // Get all parameters directly from the search params
        const availabilityStatus = params.get('availability_status');
        const itemType = params.get('item_type');
        const category = params.get('category');
        const brand = params.get('brand');
        
        console.log('Direct from URL - availability_status:', availabilityStatus);
        console.log('Direct from URL - item_type:', itemType);
        console.log('Direct from URL - category:', category);
        console.log('Direct from URL - brand:', brand);
        
        // Create new filters object based on URL parameters
        const newFilters = {
            item_type: itemType,
            category: category,
            brand: brand,
            availability_status: availabilityStatus
        };
        
        console.log('Setting filters directly from URL:', newFilters);
        setFilters(newFilters);
        
    }, [location.search]); // Only depend on location.search to avoid loops

    // Check if there are filters in the location state (coming from dashboard)
    useEffect(() => {
        if (location.state?.filters) {
            setFilters(location.state.filters);
            // Clear the location state after using it to prevent it from being applied again
            // on page refresh or when coming back to this page
            window.history.replaceState({}, document.title);
        }
    }, [location.state]);

    // Check for deletion success state
    useEffect(() => {
        if (location.state?.showDeleteSuccess) {
            setToastMessage('Item successfully deleted.');
            setToastType('success');
            setShowToast(true);
            
            // Clear the state after showing the toast
            navigate(location.pathname, { replace: true, state: {} });
            
            // Hide toast after 3 seconds
            setTimeout(() => {
                setShowToast(false);
            }, 3000);
        }
    }, [location.state, navigate]);

    const {
        query: searchQuery,
        setQuery: setSearchQuery,
        isLoading: isSearching,
        clearSearch
    } = useSearch({
        debounceMs: 300,
        filters
    });

    const handleFilterChange = (newFilters: typeof filters) => {
        console.log('Applying new filters:', newFilters); // Debug log
        setFilters(newFilters);
        
        // Clear search when filters change to avoid conflicts
        if (searchQuery) {
            setSearchQuery('');
        }
        
        // Update URL with new filters for shareable links
        const params = new URLSearchParams();
        if (newFilters.item_type) params.append('item_type', newFilters.item_type);
        if (newFilters.category) params.append('category', newFilters.category);
        if (newFilters.brand) params.append('brand', newFilters.brand);
        if (newFilters.availability_status) params.append('availability_status', newFilters.availability_status);
        
        console.log('URL params:', params.toString()); // Debug log
        
        // Replace current URL with new filters
        navigate({
            pathname: location.pathname,
            search: params.toString()
        }, { replace: true });
    };

    // Handler for inventory adjustments
    const handleInventoryAdjustment = (message: string, _updatedItem?: Item) => {
        // Show success toast
        setToastMessage(message);
        setToastType('success');
        setShowToast(true);
        
        // Hide toast after 3 seconds
        setTimeout(() => {
            setShowToast(false);
        }, 3000);
    };

    const handleSortChange = (newSort: { field: string; direction: 'asc' | 'desc' }) => {
        setSort(newSort);
    };

    const handleExportCSV = async () => {
        // Show loading toast notification
        setToastType('loading');
        setToastMessage('Preparing your inventory data...');
        setShowToast(true);
        
        try {
            // Build query parameters based on current filters and sort
            const params = new URLSearchParams();
            if (filters.item_type) params.append('item_type', filters.item_type);
            if (filters.category) params.append('category', filters.category);
            if (filters.brand) params.append('brand', filters.brand);
            if (filters.availability_status) params.append('availability_status', filters.availability_status);
            
            // Add sort configuration if present
            if (sort.field) {
                const orderingValue = `${sort.direction === 'desc' ? '-' : ''}${sort.field}`;
                params.append('ordering', orderingValue);
                console.log('Exporting with sort:', orderingValue);
            }
            
            // Add Philippine timezone offset (UTC+8)
            params.append('timezone', 'Asia/Manila');

            console.log('Exporting CSV from:', `${API_BASE_URL}/items/export_csv/?${params.toString()}`);

            // Make the API request
            const response = await api({
                url: '/items/export_csv/',
                method: 'GET',
                params: Object.fromEntries(params),
                responseType: 'arraybuffer',
                headers: {
                    'Accept': 'application/csv, text/csv, application/octet-stream, */*'
                }
            });

            // Get the CSV data as arraybuffer
            const data = response.data;
            const contentType = response.headers['content-type'] || 'application/csv';
            
            // Create blob for download
            const blob = new Blob([data], { type: contentType });
            
            // Get filename from response headers or generate one
            let filename = 'lowtemp_inventory_export.csv';
            const contentDisposition = response.headers['content-disposition'];
            if (contentDisposition && contentDisposition.includes('filename=')) {
                const matches = contentDisposition.match(/filename="(.+?)"/);
                if (matches && matches[1]) {
                    filename = matches[1];
                }
            }
            
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            
            // Trigger download and update toast to success once download starts
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            // Change to success state immediately after download starts
            setToastType('success');
            setToastMessage('Inventory data has been downloaded');
            
            // Set a timeout to hide the success toast after 3 seconds
            setTimeout(() => setShowToast(false), 3000);
        } catch (error) {
            console.error('Error exporting CSV:', error);
            setToastType('error');
            setToastMessage('Failed to export CSV. Please try again.');
            setShowToast(true);
            setTimeout(() => setShowToast(false), 3000);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row min-h-screen overflow-hidden">
            {/* Sidebar */}
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            {/* Main Content */}
            <div className="flex-1 space-y-6 lg:space-y-10 p-4 lg:p-8 overflow-y-auto pb-12 lg:ml-64">
                {/* Mobile Header with Menu Button */}
                <div className="flex lg:hidden items-center mb-4">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-1 hover:bg-gray-100 rounded-lg"
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                </div>

                {/* Overall Inventory */}
                <section className="w-full space-y-3">
                    {/* Header */}
                    <header className="font-bold text-xl text-[#2C2C2C]">Overall Inventory</header>

                    {/* Container */}
                    <div className="min-h-[18.5vh] w-full border-[#EBEAEA] bg-[#FCFBFC] rounded-xl border-[1.5px] p-4 lg:p-8">
                        <InventoryStats onFilterChange={handleFilterChange} />
                    </div>
                </section>

                {/* Stocks */}
                <section className="space-y-3">
                    {/* Header and Buttons */}
                    <div className="flex items-center justify-between">
                        <header className="font-bold text-xl text-[#2C2C2C]">Stocks</header>
                        <div className="flex gap-3 lg:hidden">
                            {/* Export CSV */}
                            <button className="bg-[#E6E6FE] border-[1.5px] text-sm border-[#DADAF3] py-2 px-3.5 rounded-lg text-[#0504AA] font-medium hover:bg-opacity-90 cursor-pointer active:scale-95 duration-50 transition-all ease-out" onClick={handleExportCSV}>
                                Export CSV
                            </button>
                            {/* Add Item */}
                            {!isSales(user) && (
                                <button
                                    className="bg-[#0504AA] py-2 px-3.5 text-white text-sm rounded-lg font-medium border-[1.5px] border-[#0504AA] hover:bg-opacity-90 cursor-pointer active:scale-95 duration-50 transition-all ease-out"
                                    onClick={() => {
                                      console.log('Add Item button clicked'); // Add this for debugging
                                      navigate('/inventory/add');
                                    }}
                                >
                                    Add Item
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Search bar */}
                    <SearchInput
                        value={searchQuery}
                        onChange={setSearchQuery}
                        onClear={clearSearch}
                        isLoading={isSearching}
                        placeholder="Search for inventory item or model number..."
                    />

                    {/* Filters and Desktop Buttons */}
                    <div className="flex items-start justify-between mb-2">
                        <InventoryFilterBar
                            onFiltersChange={handleFilterChange}
                            currentFilters={filters}
                        />
                        
                        {/* Desktop Buttons */}
                        <div className="hidden lg:flex gap-3 self-start">
                            {/* Export CSV */}
                            <button className="bg-[#E6E6FE] border-[1.5px] text-sm border-[#DADAF3] py-2 px-3.5 rounded-lg text-[#0504AA] font-medium hover:bg-opacity-90 cursor-pointer active:scale-95 duration-50 transition-all ease-out" onClick={handleExportCSV}>
                                Export CSV
                            </button>
                            {/* Add Item */}
                            {!isSales(user) && (
                                <button
                                    className="bg-[#0504AA] py-2 px-3.5 text-white text-sm rounded-lg font-medium border-[1.5px] border-[#0504AA] hover:bg-opacity-90 cursor-pointer active:scale-95 duration-50 transition-all ease-out"
                                    onClick={() => {
                                      console.log('Add Item button clicked'); // Add this for debugging
                                      navigate('/inventory/add');
                                    }}
                                >
                                    Add Item
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <InventoryTable
                            searchQuery={searchQuery}
                            filters={filters}
                            onAdjustment={handleInventoryAdjustment}
                            onSortChange={handleSortChange}
                        />
                    </div>
                </section>

                {/* Toast notification */}
                <Toast 
                    title={
                        toastType === 'loading' ? 'Exporting CSV...' : 
                        toastType === 'success' ? 'Success' : 'Error'
                    }
                    message={toastMessage}
                    type={toastType}
                    duration={toastType === 'loading' ? null : 3000}
                    isVisible={showToast} 
                    onClose={() => setShowToast(false)} 
                />
                
            </div>
        </div>
    );
}