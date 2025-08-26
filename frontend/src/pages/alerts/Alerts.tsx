import { useState, useEffect } from 'react';
import { Menu } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import Sidebar from "../../components/common/Sidebar";
import Toast from "../../components/common/Toast";
import AlertsTable from "../../components/features/Alerts/AlertsTable";
import AlertsFilterBar from "../../components/features/Alerts/AlertsFilterBar";
import { itemsApi, transactionsApi } from '../../lib/api';
import { Item, Transaction, TransactionItem } from '../../types/inventory';
import { useInfiniteQuery } from '@tanstack/react-query';

export type AlertItem = Item & {
  priority: 'Critical' | 'Urgent' | 'Normal';
  pendingTransaction?: {
    transaction_id: number;
    due_date: string;
    requested_quantity: number;
  };
  isPendingDue?: boolean;
};

export default function AlertsPage() {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [alertItems, setAlertItems] = useState<AlertItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<AlertItem[]>([]);
  const [activeFilter, setActiveFilter] = useState<'All' | 'Low Stock' | 'Pending Due'>('All');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Critical' | 'Urgent' | 'Normal'>('All');
  // State to track if we should use infinite scroll fallback
  const [useInfiniteScroll, setUseInfiniteScroll] = useState(false);

  // Function to fetch all items in one go
  const fetchAllItems = async (): Promise<Item[]> => {
    const params = new URLSearchParams();
    params.append('all', 'true');
    const response = await itemsApi.getAll(params);
    console.log('fetchAllItems raw response.data:', response.data);
    if (response.status === 'error' || !response.data) {
      throw new Error(response.message || 'Failed to fetch items');
    }
    if (Array.isArray(response.data)) {
      return response.data as Item[];
    } else if (response.data && typeof response.data === 'object') {
      if ('results' in response.data && Array.isArray((response.data as any).results)) {
        return (response.data as { results: Item[] }).results;
      }
      // If the object itself is a mapping of items, try Object.values
      return Object.values(response.data) as Item[];
    }
    return [];
  };

  // Infinite query for paginated fetch (fallback)
  const {
    data: itemsDataPages
  } = useInfiniteQuery<{ count: number; next: string | null; previous: string | null; results: Item[] }, Error>({
    queryKey: ['items', useInfiniteScroll],
    enabled: useInfiniteScroll,
    initialPageParam: 1,
    queryFn: async ({ pageParam }): Promise<{ count: number; next: string | null; previous: string | null; results: Item[] }> => {
      const params = new URLSearchParams({ page: String(pageParam) });
      const response = await itemsApi.getAll(params);
      if (response.status === 'error' || !response.data) {
        throw new Error(response.message || 'Failed to fetch items');
      }
      if (Array.isArray(response.data)) {
        return {
          count: response.data.length,
          next: null,
          previous: null,
          results: response.data as Item[]
        };
      } else if (response.data && typeof response.data === 'object' && 'results' in response.data) {
        return response.data as { count: number; next: string | null; previous: string | null; results: Item[] };
      }
      return { count: 0, next: null, previous: null, results: [] };
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage.next) return undefined;
      const nextUrl = new URL(lastPage.next);
      const nextPage = nextUrl.searchParams.get('page');
      return nextPage ? parseInt(nextPage) : undefined;
    },
    staleTime: 5000,
    refetchOnWindowFocus: false
  });

  // State for all items (if not using infinite scroll)
  const [allItems, setAllItems] = useState<Item[]>([]);

  // On mount, try to fetch all items in one go
  useEffect(() => {
    if (!useInfiniteScroll) {
      fetchAllItems().then(items => {
        console.log('fetchAllItems returned', items.length, 'items');
        setAllItems(items);
        console.log('setAllItems called with', items.length, 'items');
      }).catch(() => {
        setUseInfiniteScroll(true);
      });
    }
  }, [useInfiniteScroll]);

  // Use allItems if not using infinite scroll, otherwise flatten paginated data
  const itemsData = useInfiniteScroll
    ? (itemsDataPages?.pages.flatMap(page => page.results) || [])
    : allItems;

  // DEBUG: Log all items with their status, quantity, and threshold
  console.log('All items with status:', itemsData.map(item => ({
    id: item.item_id,
    name: item.item_name,
    status: item.availability_status,
    quantity: item.quantity,
    threshold: item.threshold_value
  })));

  // Fetch pending transactions
  useEffect(() => {
    const fetchAlertItems = async () => {
      setIsLoading(true);
      try {
        // Fetch pending transactions (keep this fetch as before)
        const transactionParams = new URLSearchParams();
        transactionParams.append('status', 'Pending');
        const transactionsResponse = await transactionsApi.getAll(transactionParams);
        // Use allItems if not using infinite scroll, otherwise flatten paginated data
        const itemsData: Item[] = useInfiniteScroll
          ? (itemsDataPages?.pages.flatMap(page => page.results) || [])
          : allItems;
        // DEBUG: Log all items and check for missing or problematic data
        console.log('Total items received:', itemsData.length);
        itemsData.forEach(item => {
          if (item.quantity == null || item.threshold_value == null) {
            console.warn('Item with missing quantity or threshold_value:', item);
          } else if (isNaN(Number(item.quantity)) || isNaN(Number(item.threshold_value))) {
            console.warn('Item with non-numeric quantity or threshold_value:', item);
          }
        });
        // Old filter logic for reference
        const filteredItems = itemsData.filter(item => {
          const qty = Number(item.quantity);
          const thresh = Number(item.threshold_value);
          return (!isNaN(qty) && !isNaN(thresh)) && (qty <= thresh || qty === 0);
        });
        console.log('Filtered items count:', filteredItems.length);
        // Build a map for fast lookup
        const itemMap = new Map<number, Item>();
        itemsData.forEach(item => itemMap.set(item.item_id, item));
        // Get pending transactions
        const pendingTransactions: Transaction[] = transactionsResponse.status === 'success' && transactionsResponse.data
          ? ('results' in transactionsResponse.data 
            ? (transactionsResponse.data.results as Transaction[]) 
            : (transactionsResponse.data as Transaction[]))
          : [];
        // Debug: Print all transaction item IDs and names
        const allTransactionItems = pendingTransactions.flatMap(tx => tx.items || []).map(item => ({ item_id: typeof item === 'number' ? item : item.item, item_name: typeof item === 'number' ? undefined : item.item_name }));
        console.log('[TRANSACTION ITEMS]', allTransactionItems);
        // Create a map of item IDs to their pending transaction details
        const pendingTransactionMap = new Map();
        pendingTransactions.forEach((transaction: Transaction) => {
          transaction.items?.forEach((item: TransactionItem) => {
            const itemId = typeof item === 'number' ? item : item.item;
            // Use requested_quantity if present, otherwise fallback to Math.abs(quantity_change)
            const requestedQty = typeof item === 'number' ? 0 : (item.requested_quantity ?? Math.abs(item.quantity_change));
            if (itemId) {
              // Debug log for diagnosis
              const invItem = itemMap.get(itemId);
              if (invItem) {
                console.log('[PENDING DUE DEBUG]', {
                  item_name: invItem.item_name,
                  item_id: itemId,
                  inventory_quantity: invItem.quantity,
                  requested_quantity: requestedQty,
                  quantity_change: item.quantity_change
                });
              }
              pendingTransactionMap.set(itemId, {
                transaction_id: transaction.transaction_id,
                due_date: transaction.due_date || '',
                requested_quantity: requestedQty
              });
            }
          });
        });
        // Add items from pending transactions where requested_quantity > item.quantity, even if not low stock
        const pendingDueItems: AlertItem[] = [];
        pendingTransactionMap.forEach((pending, itemId) => {
          const item = itemMap.get(itemId);
          if (item && pending.requested_quantity > item.quantity) {
            // Calculate pending due priority
            let pendingPriority: 'Critical' | 'Urgent' | 'Normal' = 'Normal';
            if (pending.due_date) {
              const dueDate = new Date(pending.due_date);
              const today = new Date();
              const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              if (daysUntilDue <= 3) {
                pendingPriority = 'Critical';
              } else if (daysUntilDue <= 7) {
                pendingPriority = 'Urgent';
              }
            }
            pendingDueItems.push({
              ...item,
              priority: pendingPriority,
              pendingTransaction: pending,
              isPendingDue: true
            });
          }
        });
        // Calculate priority for low stock/critical/urgent items (existing logic)
        const alertItemsWithPriority: AlertItem[] = filteredItems.map((item: Item) => {
          let priority: 'Critical' | 'Urgent' | 'Normal' = 'Normal';
          const pendingTransaction = pendingTransactionMap.get(item.item_id);
          if (pendingTransaction) {
            const dueDate = new Date(pendingTransaction.due_date);
            const today = new Date();
            const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntilDue <= 3) {
              priority = 'Critical';
            } else if (daysUntilDue <= 7) {
              priority = 'Urgent';
            }
          }
          if (item.quantity === 0) {
            priority = 'Critical';
          } else if (
            item.quantity >= item.threshold_value * 0.01 && 
            item.quantity <= item.threshold_value * 0.5 && 
            priority !== 'Critical'
          ) {
            priority = 'Urgent';
          }
          return { 
            ...item, 
            priority,
            pendingTransaction: pendingTransactionMap.get(item.item_id),
            isPendingDue: !!pendingTransactionMap.get(item.item_id)
          };
        });
        // Merge and deduplicate items efficiently
        const mergedMap = new Map<number, AlertItem>();
        alertItemsWithPriority.forEach(item => mergedMap.set(item.item_id, item));
        pendingDueItems.forEach(item => mergedMap.set(item.item_id, { ...mergedMap.get(item.item_id), ...item, isPendingDue: true }));
        setAlertItems(Array.from(mergedMap.values()));
      } catch (err) {
        console.error('Error fetching alert items:', err);
        setError('An error occurred while fetching alert items');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchAlertItems();
    
    // Set up real-time updates
    const intervalId = setInterval(fetchAlertItems, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(intervalId);
  }, [itemsDataPages, allItems, useInfiniteScroll]);

  // Handle item selection
  const handleItemSelect = (item: AlertItem, isSelected: boolean) => {
    if (isSelected) {
      setSelectedItems(prev => [...prev, item]);
    } else {
      setSelectedItems(prev => prev.filter(i => i.item_id !== item.item_id));
    }
  };

  // Handle select all items
  const handleSelectAll = (isSelected: boolean) => {
    if (isSelected) {
      // Get filtered items based on current filter
      const filteredItems = getFilteredItems();
      setSelectedItems(filteredItems);
    } else {
      setSelectedItems([]);
    }
  };

  // Filter items based on current filters
  const getFilteredItems = () => {
    let filtered = [...alertItems];
    // Apply type filter
    if (activeFilter === 'Low Stock') {
      filtered = filtered.filter(item => item.availability_status === 'Low Stock' || item.availability_status === 'Out of Stock');
    } else if (activeFilter === 'Pending Due') {
      filtered = filtered.filter(item => item.isPendingDue);
    }
    // Apply priority filter
    if (filterStatus !== 'All') {
      filtered = filtered.filter(item => item.priority === filterStatus);
    }
    return filtered;
  };

  const filteredItems = getFilteredItems();
  console.log('alertItems count:', alertItems.length);
  console.log('filteredItems count:', filteredItems.length);
  
  // Check if there are any low stock items
  const hasLowStockItems = alertItems.some(item => item.availability_status === 'Low Stock');
  
  // Navigate to generate requisition list page
  const handleGenerateRequisitionList = () => {
    if (selectedItems.length === 0 || !hasLowStockItems) return;
    
    navigate('/alerts/generate-requisition', {
      state: { selectedItems }
    });
  };

  // Navigate to item details page
  const handleItemClick = (itemId: number) => {
    navigate(`/inventory/${itemId}`);
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto pb-12 lg:ml-64">
        {/* Mobile Header with Menu Button */}
        <div className="flex lg:hidden items-center mb-4">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-1 hover:bg-gray-100 rounded-lg"
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>

        {/* Alerts Section */}
        <section className="space-y-4 mt-4 lg:mt-6">
          {/* Header and Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h1 className="text-2xl font-bold text-[#2C2C2C]">Alerts</h1>
            
            <button 
              onClick={handleGenerateRequisitionList}
              disabled={selectedItems.length === 0 || !hasLowStockItems}
              className={`py-2 px-3.5 rounded-lg text-white text-sm font-medium transition-all whitespace-nowrap ${
                selectedItems.length > 0 && hasLowStockItems
                  ? 'bg-[#0504AA] cursor-pointer hover:bg-opacity-90 active:scale-95 duration-50 ease-out' 
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              Generate Requisition List
            </button>
          </div>
          
          {/* Description text */}
          <p className="text-[#646464]">
            Manage low stock alerts and pending dues
          </p>
          
          {/* Filter Bar */}
          <div className="overflow-x-auto pb-2 -mx-4 px-4 md:-mx-0 md:px-0">
            <AlertsFilterBar 
              activeFilter={activeFilter} 
              setActiveFilter={setActiveFilter}
              filterStatus={filterStatus}
              setFilterStatus={setFilterStatus}
            />
          </div>
          
          {/* Alerts Content */}
          <div className="overflow-x-auto -mx-4 px-4 md:-mx-0 md:px-0">
            {isLoading ? (
              <div className="bg-white rounded-lg border border-[#EBEAEA] overflow-hidden">
                {/* Header with select all skeleton */}
                <div className="flex items-center p-4 border-b border-[#EBEAEA]">
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
                </div>
                
                {/* Critical Section Skeleton */}
                <div>
                  <div className="bg-red-50 px-4 py-2 border-b border-[#EBEAEA]">
                    <div className="h-5 w-16 bg-red-200 rounded animate-pulse"></div>
                  </div>
                  <div className="divide-y divide-[#EBEAEA]">
                    {[...Array(2)].map((_, index) => (
                      <div key={`critical-${index}`} className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                              <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse mb-2"></div>
                              <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse"></div>
                            </div>
                            <div className="flex flex-col space-y-1">
                              <div className="flex items-center space-x-2">
                                <div className="h-4 w-12 bg-gray-200 rounded animate-pulse"></div>
                                <div className="h-4 w-6 bg-gray-200 rounded animate-pulse"></div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                                <div className="h-4 w-6 bg-gray-200 rounded animate-pulse"></div>
                              </div>
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center mb-2">
                                <div className="h-4 w-28 bg-gray-200 rounded animate-pulse"></div>
                              </div>
                              <div className="h-5 w-20 bg-orange-100 rounded-full animate-pulse"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Urgent Section Skeleton */}
                <div>
                  <div className="bg-yellow-50 px-4 py-2 border-b border-[#EBEAEA]">
                    <div className="h-5 w-14 bg-yellow-200 rounded animate-pulse"></div>
                  </div>
                  <div className="divide-y divide-[#EBEAEA]">
                    {[...Array(1)].map((_, index) => (
                      <div key={`urgent-${index}`} className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                              <div className="h-5 w-3/4 bg-gray-200 rounded animate-pulse mb-2"></div>
                              <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse"></div>
                            </div>
                            <div className="flex flex-col space-y-1">
                              <div className="flex items-center space-x-2">
                                <div className="h-4 w-12 bg-gray-200 rounded animate-pulse"></div>
                                <div className="h-4 w-6 bg-gray-200 rounded animate-pulse"></div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
                                <div className="h-4 w-6 bg-gray-200 rounded animate-pulse"></div>
                              </div>
                            </div>
                            <div className="flex flex-col">
                              <div className="flex items-center mb-2">
                                <div className="h-4 w-28 bg-gray-200 rounded animate-pulse"></div>
                              </div>
                              <div className="h-5 w-20 bg-orange-100 rounded-full animate-pulse"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : error ? (
              <div className="bg-white rounded-lg border border-[#EBEAEA] p-8 text-center">
                <p className="text-red-500">{error}</p>
              </div>
            ) : (
              <AlertsTable 
                items={filteredItems}
                selectedItems={selectedItems}
                onItemSelect={handleItemSelect}
                onSelectAll={handleSelectAll}
                onItemClick={handleItemClick}
              />
            )}
          </div>
        </section>
      </div>
      
      {/* Toast notification for operations */}
      {showToast && (
        <Toast
          title={toastMessage}
          type="success"
          isVisible={showToast}
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
}
