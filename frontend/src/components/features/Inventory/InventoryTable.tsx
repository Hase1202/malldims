import { useState, useEffect, useRef, useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { itemsApi, API_ENDPOINTS } from '../../../lib/api'; // Add API_ENDPOINTS here
import { ArrowUpDown, ArrowUp, ArrowDown, X, Edit2 } from 'lucide-react';
import { Item, APIResponse } from '../../../types/inventory';
import InventoryAdjustmentModal from './InventoryAdjustmentModal';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthContext } from '../../../context/AuthContext';
import { isSales } from '../../../utils/permissions';

interface SortConfig {
    field: string;
    direction: 'asc' | 'desc';
}

interface SortableColumn {
    key: string;
    label: string;
}

const SORTABLE_COLUMNS: SortableColumn[] = [
    { key: 'brand_name', label: 'Brand' },
    { key: 'item_name', label: 'Product Name' },
    { key: 'sku', label: 'SKU' },
    { key: 'total_quantity', label: 'Stock Qty' }
];

interface InventoryTableProps {
    searchQuery: string;
    filters: {
        brand: string | null;
    };
    onAdjustment?: (message: string, updatedItem?: Item) => void;
    onSortChange?: (sort: SortConfig) => void;
}

const InventoryTable: React.FC<InventoryTableProps> = ({
    searchQuery = '',
    filters,
    onAdjustment,
    onSortChange
}) => {
    const navigate = useNavigate();
    const [sort, setSort] = useState<SortConfig>({ field: '', direction: 'asc' });
    const [activeSortColumn, setActiveSortColumn] = useState<string | null>(null);
    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
    const queryClient = useQueryClient();
    const { user } = useAuthContext();

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (activeSortColumn && !(event.target as Element).closest('.sort-dropdown')) {
                setActiveSortColumn(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeSortColumn]);

    // Notify parent of sort changes
    useEffect(() => {
        if (onSortChange) {
            onSortChange(sort);
        }
    }, [sort, onSortChange]);

    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        isLoading: isLoadingInventory,
        error: queryError
    } = useInfiniteQuery<APIResponse>({
        queryKey: ['items', searchQuery, filters, sort],
        initialPageParam: 1,
        queryFn: async ({ pageParam }) => {
            console.log('=== API Call Debug ===');
            console.log('Fetching items with params:', { pageParam, searchQuery, filters, sort });
            
            const params = new URLSearchParams({
                page: String(pageParam)
            });
            
            if (sort.field) {
                const orderingValue = `${sort.direction === 'desc' ? '-' : ''}${sort.field}`;
                params.append('ordering', orderingValue);
                console.log('Added sorting:', orderingValue);
            }
            
            if (filters.brand) {
                params.append('brand', filters.brand);
                console.log('Added brand filter:', filters.brand);
            }
            
            if (searchQuery) {
                params.append('search', searchQuery);
                console.log('Added search query:', searchQuery);
            }
            
            console.log('Final API URL:', `${API_ENDPOINTS.ITEMS}?${params.toString()}`);
            
            const response = await itemsApi.getAll(params);
            console.log('API Response status:', response.status);
            console.log('API Response data count:', response.data?.results?.length || response.data?.length || 0);
            
            if (response.status === 'error' || !response.data) {
                throw new Error(response.message || 'Failed to fetch items');
            }
            
            // Handle different response formats
            if (Array.isArray(response.data)) {
                return {
                    count: response.data.length,
                    next: null,
                    previous: null,
                    results: response.data
                } as APIResponse;
            } else if (response.data && typeof response.data === 'object' && 'results' in response.data) {
                return response.data as APIResponse;
            }
            
            return {
                count: 0,
                next: null,
                previous: null,
                results: []
            } as APIResponse;
        },
        getNextPageParam: (lastPage: APIResponse) => {
            if (!lastPage.next) return undefined;
            const nextUrl = new URL(lastPage.next);
            const nextPage = nextUrl.searchParams.get('page');
            return nextPage ? parseInt(nextPage) : undefined;
        },
        staleTime: 5000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
            console.log('Query failed:', error);
            return failureCount < 2; // Retry up to 2 times
        }
    });

    // Intersection Observer setup
    const observer = useRef<IntersectionObserver>();
    const lastItemRef = useCallback((node: HTMLDivElement | null) => {
        if (isFetchingNextPage) return;

        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasNextPage) {
                fetchNextPage();
            }
        });

        if (node) observer.current.observe(node);
    }, [isFetchingNextPage, hasNextPage, fetchNextPage]);

    const handleSort = (columnKey: string, direction: 'asc' | 'desc' | null) => {
        if (direction === null) {
            // Reset sort
            setSort({ field: '', direction: 'asc' });
        } else {
            setSort({ field: columnKey, direction });
        }
        setActiveSortColumn(null);
    };

    const getSortIcon = (columnKey: string) => {
        if (sort.field !== columnKey) {
            return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
        }
        return sort.direction === 'asc' 
            ? <ArrowUp className="w-4 h-4 text-gray-700" />
            : <ArrowDown className="w-4 h-4 text-gray-700" />;
    };

    const isLoading = isLoadingInventory;
    const error = queryError;
    const items = data?.pages.flatMap(page => page.results) || [];
    
    // Debug filtered items
    useEffect(() => {
        if (items && items.length > 0) {
            console.log('FILTERED ITEMS:', items.length);
            console.log('SAMPLE ITEM:', items[0]);
            console.log('SAMPLE AVAILABILITY:', items[0].availability_status);
        }
    }, [items]);

    const handleOpenAdjustmentModal = (e: React.MouseEvent, item: Item) => {
        e.stopPropagation(); // Prevent row click event
        setSelectedItem(item);
        setIsAdjustmentModalOpen(true);
    };
    
    const handleAdjustment = (message: string, updatedItem?: Item) => {
        // If we received the updated item, update it in the current list without refetching
        if (updatedItem) {
            // Use the queryClient to update the item in cache
            queryClient.setQueryData(['items', searchQuery, filters, sort], (oldData: any) => {
                if (!oldData || !oldData.pages) return oldData;
                
                // Create a new pages array with the updated item
                const newPages = oldData.pages.map((page: any) => {
                    if (!page.results) return page;
                    
                    const newResults = page.results.map((item: Item) => 
                        item.item_id === updatedItem.item_id ? updatedItem : item
                    );
                    
                    return {
                        ...page,
                        results: newResults
                    };
                });
                
                return {
                    ...oldData,
                    pages: newPages
                };
            });
        } else {
            // If we didn't get the updated item, trigger a refetch
            document.dispatchEvent(new Event('visibilitychange')); // Trigger react-query refetch
        }
        
        // Call the parent's onAdjustment callback if provided
        if (onAdjustment) {
            onAdjustment(message, updatedItem);
        }
    };

    const TableSkeleton = () => (
        <>
            <div className="flex justify-between items-center px-4 py-3 border-b border-[#EBEAEA]">
                <div className="h-8 bg-gray-200 rounded w-32 animate-pulse"></div>
                <div className="h-8 bg-gray-200 rounded w-24 animate-pulse"></div>
            </div>
            <table className="w-full">
                <thead>
                    <tr className="border-b border-[#EBEAEA] bg-gray-50">
                        {SORTABLE_COLUMNS.map((col) => (
                            <th key={col.key} className="px-2 lg:px-4 py-2 lg:py-3 text-left">
                                <div className="h-5 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                            </th>
                        ))}
                        <th className="px-2 lg:px-4 py-2 lg:py-3 text-left">
                            <div className="h-5 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                        </th>
                        <th className="px-2 lg:px-4 py-2 lg:py-3 text-left">
                            <div className="h-5 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                        </th>
                        <th className="px-2 lg:px-4 py-2 lg:py-3 text-left">
                            <div className="h-5 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                        </th>
                        <th className="px-2 lg:px-4 py-2 lg:py-3 text-left">
                            <div className="h-5 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {[...Array(5)].map((_, index) => (
                        <tr key={index} className="border-b border-[#EBEAEA]">
                            <td className="px-2 lg:px-4 py-4">
                                <div className="h-4 bg-gray-200 rounded w-full animate-pulse"></div>
                            </td>
                            <td className="px-2 lg:px-4 py-4">
                                <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                            </td>
                            <td className="px-2 lg:px-4 py-4">
                                <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse"></div>
                            </td>
                            <td className="px-2 lg:px-4 py-4">
                                <div className="h-6 bg-gray-200 rounded w-24 animate-pulse"></div>
                            </td>
                            <td className="px-2 lg:px-4 py-4">
                                <div className="h-4 bg-gray-200 rounded w-12 animate-pulse"></div>
                            </td>
                            <td className="px-2 lg:px-4 py-4">
                                <div className="h-4 bg-gray-200 rounded w-12 animate-pulse"></div>
                            </td>
                            <td className="px-2 lg:px-4 py-4">
                                <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                            </td>
                            <td className="px-2 lg:px-4 py-4">
                                <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <div className="px-4 py-3 border-t border-[#EBEAEA] flex justify-between items-center">
                <div className="h-8 bg-gray-200 rounded w-20 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
                <div className="h-8 bg-gray-200 rounded w-20 animate-pulse"></div>
            </div>
        </>
    );

    if (isLoading) {
        return (
            <div className="w-full bg-white rounded-xl border-[#EBEAEA] border-[1.5px]">
                <TableSkeleton />
            </div>
        );
    }

    if (error) {
        return (
            <div className="w-full py-8 text-center text-red-600">
                Error: {error instanceof Error ? error.message : error}
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="w-full py-8 text-center text-[#6F6F6F]">
                {searchQuery
                    ? `No items found matching "${searchQuery}"`
                    : 'No items available'}
            </div>
        );
    }

    const highlightText = (text: string, query: string): (string | JSX.Element)[] => {
        if (!query.trim()) return [text];

        const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
        let parts: (string | JSX.Element)[] = [text];

        searchTerms.forEach(term => {
            const regex = new RegExp(`(${term})`, 'gi');
            parts = parts.flatMap(part => 
                typeof part === 'string' 
                    ? part.split(regex).map((subPart, i) => 
                        regex.test(subPart) 
                            ? <span key={`${subPart}-${i}`} className="bg-yellow-100 font-medium">{subPart}</span>
                            : subPart
                    )
                    : [part]
            );
        });

        return parts;
    };

    return (
        <div className="w-full bg-white">
            <div className="overflow-x-auto border-[#EBEAEA] border-[1.5px] rounded-xl">
                <table className="w-full border-collapse" role="grid" aria-label="Inventory items">
                    <thead>
                        <tr className="border-b border-[#EBEAEA] bg-gray-50">
                            <th className="px-4 py-3 text-left text-xs lg:text-sm text-[#646464]">
                                <div className="relative inline-block">
                                    <button
                                        onClick={() => setActiveSortColumn(activeSortColumn === 'brand_name' ? null : 'brand_name')}
                                        className="inline-flex items-center gap-1.5 px-2 rounded transition-all font-medium text-[#6F6F6F] hover:bg-gray-100 active:scale-95"
                                    >
                                        Brand
                                        {getSortIcon('brand_name')}
                                    </button>
                                    {activeSortColumn === 'brand_name' && (
                                        <div className="absolute z-10 mt-1 w-36 bg-white rounded-lg shadow-lg border-[1.5px] border-[#EBEAEA] py-1 sort-dropdown">
                                            <button
                                                onClick={() => handleSort('brand_name', 'asc')}
                                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#6F6F6F] font-normal hover:bg-gray-50 active:scale-95"
                                            >
                                                <ArrowUp className="w-4 h-4" />
                                                Ascending
                                            </button>
                                            <button
                                                onClick={() => handleSort('brand_name', 'desc')}
                                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#6F6F6F] font-normal hover:bg-gray-50 active:scale-95"
                                            >
                                                <ArrowDown className="w-4 h-4" />
                                                Descending
                                            </button>
                                            {sort.field === 'brand_name' && (
                                                <button
                                                    onClick={() => handleSort('brand_name', null)}
                                                    className="flex items-center gap-2 w-full px-3 py-2.5 -mb-1 text-sm text-red-500 font-normal hover:bg-gray-50 active:scale-95 border-t border-[#EBEAEA]"
                                                >
                                                    <X className="w-4 h-4" />
                                                    Clear sort
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </th>
                            <th className="px-4 py-3 text-left text-xs lg:text-sm text-[#646464]">
                                <div className="relative inline-block">
                                    <button
                                        onClick={() => setActiveSortColumn(activeSortColumn === 'item_name' ? null : 'item_name')}
                                        className="inline-flex items-center gap-1.5 px-2 rounded transition-all font-medium text-[#6F6F6F] hover:bg-gray-100 active:scale-95"
                                    >
                                        Product Name
                                        {getSortIcon('item_name')}
                                    </button>
                                    {activeSortColumn === 'item_name' && (
                                        <div className="absolute z-10 mt-1 w-36 bg-white rounded-lg shadow-lg border-[1.5px] border-[#EBEAEA] py-1 sort-dropdown">
                                            <button
                                                onClick={() => handleSort('item_name', 'asc')}
                                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#6F6F6F] font-normal hover:bg-gray-50 active:scale-95"
                                            >
                                                <ArrowUp className="w-4 h-4" />
                                                Ascending
                                            </button>
                                            <button
                                                onClick={() => handleSort('item_name', 'desc')}
                                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#6F6F6F] font-normal hover:bg-gray-50 active:scale-95"
                                            >
                                                <ArrowDown className="w-4 h-4" />
                                                Descending
                                            </button>
                                            {sort.field === 'item_name' && (
                                                <button
                                                    onClick={() => handleSort('item_name', null)}
                                                    className="flex items-center gap-2 w-full px-3 py-2.5 -mb-1 text-sm text-red-500 font-normal hover:bg-gray-50 active:scale-95 border-t border-[#EBEAEA]"
                                                >
                                                    <X className="w-4 h-4" />
                                                    Clear sort
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </th>
                            <th className="px-4 py-3 text-left text-xs lg:text-sm font-medium text-[#646464]">
                                <div className="relative inline-block">
                                    <button
                                        onClick={() => setActiveSortColumn(activeSortColumn === 'sku' ? null : 'sku')}
                                        className="inline-flex items-center gap-1.5 px-2 rounded transition-all text-[#6F6F6F] hover:bg-gray-100 active:scale-95 whitespace-nowrap"
                                    >
                                        SKU
                                        {getSortIcon('sku')}
                                    </button>
                                    {activeSortColumn === 'sku' && (
                                        <div className="absolute z-10 mt-1 w-36 bg-white rounded-lg shadow-lg border-[1.5px] border-[#EBEAEA] py-1 sort-dropdown">
                                            <button
                                                onClick={() => handleSort('sku', 'asc')}
                                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#6F6F6F] font-normal hover:bg-gray-50 active:scale-95"
                                            >
                                                <ArrowUp className="w-4 h-4" />
                                                Ascending
                                            </button>
                                            <button
                                                onClick={() => handleSort('sku', 'desc')}
                                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#6F6F6F] font-normal hover:bg-gray-50 active:scale-95"
                                            >
                                                <ArrowDown className="w-4 h-4" />
                                                Descending
                                            </button>
                                            {sort.field === 'sku' && (
                                                <button
                                                    onClick={() => handleSort('sku', null)}
                                                    className="flex items-center gap-2 w-full px-3 py-2.5 -mb-1 text-sm text-red-500 font-normal hover:bg-gray-50 active:scale-95 border-t border-[#EBEAEA]"
                                                >
                                                    <X className="w-4 h-4" />
                                                    Clear sort
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </th>
                            <th className="px-4 py-3 text-left text-xs lg:text-sm font-medium text-[#646464]">
                                <div className="relative inline-block">
                                    <button
                                        onClick={() => setActiveSortColumn(activeSortColumn === 'total_quantity' ? null : 'total_quantity')}
                                        className="inline-flex items-center gap-1.5 px-2 rounded transition-all text-[#6F6F6F] hover:bg-gray-100 active:scale-95"
                                    >
                                        Stock Qty
                                        {getSortIcon('total_quantity')}
                                    </button>
                                    {activeSortColumn === 'total_quantity' && (
                                        <div className="absolute z-10 mt-1 w-36 bg-white rounded-lg shadow-lg border-[1.5px] border-[#EBEAEA] py-1 sort-dropdown">
                                            <button
                                                onClick={() => handleSort('total_quantity', 'asc')}
                                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#6F6F6F] font-normal hover:bg-gray-50 active:scale-95"
                                            >
                                                <ArrowUp className="w-4 h-4" />
                                                Ascending
                                            </button>
                                            <button
                                                onClick={() => handleSort('total_quantity', 'desc')}
                                                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#6F6F6F] font-normal hover:bg-gray-50 active:scale-95"
                                            >
                                                <ArrowDown className="w-4 h-4" />
                                                Descending
                                            </button>
                                            {sort.field === 'total_quantity' && (
                                                <button
                                                    onClick={() => handleSort('total_quantity', null)}
                                                    className="flex items-center gap-2 w-full px-3 py-2.5 -mb-1 text-sm text-red-500 font-normal hover:bg-gray-50 active:scale-95 border-t border-[#EBEAEA]"
                                                >
                                                    <X className="w-4 h-4" />
                                                    Clear sort
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {items.map((item, index) => (
                            <tr 
                                key={item.item_id} 
                                className="hover:bg-gray-50 border-b border-[#EBEAEA] cursor-pointer"
                                onClick={() => navigate(`/inventory/${item.item_id}`)}
                                role="row"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        navigate(`/inventory/${item.item_id}`);
                                    }
                                }}
                                ref={index === items.length - 1 ? lastItemRef : null}
                            >
                                <td className="px-4 py-3 text-xs lg:text-sm text-gray-900">
                                    {highlightText(
                                        item.brand_name || 
                                        (typeof (item as any).brand === 'string' ? (item as any).brand : 'N/A'), 
                                        searchQuery
                                    )}
                                </td>
                                <td className="px-4 py-3 text-xs lg:text-sm text-gray-900">
                                    <span className="font-medium">
                                        {highlightText(item.item_name, searchQuery)}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-xs lg:text-sm text-gray-900">
                                    {highlightText(item.sku || item.model_number || '', searchQuery)}
                                </td>
                                <td className="px-4 py-3 text-xs lg:text-sm text-gray-900 relative group">
                                    <div className="flex items-center">
                                        <div className="flex flex-col">
                                            <span>{item.total_quantity} {item.uom || 'pc'}</span>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/inventory/${item.item_id}/batches`);
                                                }}
                                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline text-left"
                                                title="Click to view batches"
                                            >
                                                {item.active_batches_count} batch{item.active_batches_count !== 1 ? 'es' : ''}
                                            </button>
                                        </div>
                                        <div className="flex items-center ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {!isSales(user) && (
                                                <button 
                                                    onClick={(e) => handleOpenAdjustmentModal(e, item)}
                                                    className="p-1 rounded-full text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                                                    aria-label="Adjust quantity"
                                                    title="Adjust Inventory Quantity"
                                                >
                                                    <Edit2 className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {isFetchingNextPage && (
                    <div className="p-4 text-center">
                        <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite] text-gray-400"></div>
                    </div>
                )}
            </div>
            
            {/* Inventory Adjustment Modal */}
            <InventoryAdjustmentModal 
                isOpen={isAdjustmentModalOpen}
                onClose={() => setIsAdjustmentModalOpen(false)}
                item={selectedItem}
                onAdjustment={handleAdjustment}
            />
        </div>
    );
};

export default InventoryTable;