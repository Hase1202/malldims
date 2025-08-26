import { Check, Clock } from 'lucide-react';
import { AlertItem } from '../../../pages/alerts/Alerts';
import { useState } from 'react';
import TransactionDetailsModal from '../../features/Transactions/TransactionDetailsModal';

interface AlertsTableProps {
  items: AlertItem[];
  selectedItems: AlertItem[];
  onItemSelect: (item: AlertItem, isSelected: boolean) => void;
  onSelectAll: (isSelected: boolean) => void;
  onItemClick: (itemId: number) => void;
}

const AlertsTable: React.FC<AlertsTableProps> = ({ 
  items, 
  selectedItems, 
  onItemSelect, 
  onSelectAll,
  onItemClick 
}) => {
  const [selectedTransactionId, setSelectedTransactionId] = useState<number | null>(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);

  // Check if all items are selected
  const isAllSelected = items.length > 0 && selectedItems.length === items.length;
  
  // Get status badge style
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Low Stock':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            Low Stock
          </span>
        );
      case 'Pending Due':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Pending Due
          </span>
        );
      default:
        return null;
    }
  };
  
  // Function to group items by priority
  const getItemsByPriority = () => {
    // Group items by priority
    const criticalItems = items.filter(item => item.priority === 'Critical');
    const urgentItems = items.filter(item => item.priority === 'Urgent');
    const normalItems = items.filter(item => item.priority === 'Normal');
    
    return { criticalItems, urgentItems, normalItems };
  };
  
  const { criticalItems, urgentItems, normalItems } = getItemsByPriority();
  
  // Check if an item is selected
  const isItemSelected = (item: AlertItem) => {
    return selectedItems.some(selected => selected.item_id === item.item_id);
  };
  
  const formatDueDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const daysUntilDue = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue <= 0) {
      return 'Due today';
    } else if (daysUntilDue === 1) {
      return 'Due tomorrow';
    } else {
      return `Due in ${daysUntilDue} days`;
    }
  };

  const handleViewTransaction = (e: React.MouseEvent, transactionId: number) => {
    e.stopPropagation();
    setSelectedTransactionId(transactionId);
    setIsTransactionModalOpen(true);
  };
  
  // Render empty state
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-[#EBEAEA] p-8 text-center">
        <p className="text-[#6F6F6F]">No alerts found</p>
      </div>
    );
  }
  
  return (
    <>
      <div className="bg-white rounded-lg border border-[#EBEAEA] overflow-hidden">
        {/* Header with select all */}
        <div className="flex items-center p-4 border-b border-[#EBEAEA]">
          <label className="flex items-center mr-4">
            <div className="relative flex items-center">
              <input 
                type="checkbox" 
                checked={isAllSelected}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="h-4 w-4 rounded border-[#DADAF3] focus:ring-[#0504AA] focus:ring-offset-0 focus:ring-opacity-20 
                checked:bg-[#8285F4] checked:border-[#8285F4] checked:hover:bg-[#8285F4] checked:hover:border-[#8285F4]"
              />
              {isAllSelected && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </div>
            <span className="ml-2 text-sm font-medium text-[#5F5F5F]">Select all</span>
          </label>
        </div>
        
        {/* Critical Section */}
        {criticalItems.length > 0 && (
          <div>
            <div className="bg-red-50 px-4 py-2 font-medium text-red-900 border-b border-[#EBEAEA]">
              Critical
            </div>
            <ul role="list" className="divide-y divide-[#EBEAEA]">
              {criticalItems.map(item => (
                <ItemRow 
                  key={item.item_id} 
                  item={item} 
                  isSelected={isItemSelected(item)} 
                  onSelect={onItemSelect}
                  onItemClick={onItemClick}
                  getStatusBadge={getStatusBadge}
                  formatDueDate={formatDueDate}
                  handleViewTransaction={handleViewTransaction}
                />
              ))}
            </ul>
          </div>
        )}
        
        {/* Urgent Section */}
        {urgentItems.length > 0 && (
          <div>
            <div className="bg-yellow-50 px-4 py-2 font-medium text-yellow-900 border-b border-[#EBEAEA]">
              Urgent
            </div>
            <ul role="list" className="divide-y divide-[#EBEAEA]">
              {urgentItems.map(item => (
                <ItemRow 
                  key={item.item_id} 
                  item={item} 
                  isSelected={isItemSelected(item)} 
                  onSelect={onItemSelect}
                  onItemClick={onItemClick}
                  getStatusBadge={getStatusBadge}
                  formatDueDate={formatDueDate}
                  handleViewTransaction={handleViewTransaction}
                />
              ))}
            </ul>
          </div>
        )}
        
        {/* Normal Section */}
        {normalItems.length > 0 && (
          <div>
            <div className="bg-gray-50 px-4 py-2 font-medium text-gray-900 border-b border-[#EBEAEA]">
              Normal
            </div>
            <ul role="list" className="divide-y divide-[#EBEAEA]">
              {normalItems.map(item => (
                <ItemRow 
                  key={item.item_id} 
                  item={item} 
                  isSelected={isItemSelected(item)} 
                  onSelect={onItemSelect}
                  onItemClick={onItemClick}
                  getStatusBadge={getStatusBadge}
                  formatDueDate={formatDueDate}
                  handleViewTransaction={handleViewTransaction}
                />
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Transaction Details Modal */}
      <TransactionDetailsModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        transactionId={selectedTransactionId}
      />
    </>
  );
};

interface ItemRowProps {
  item: AlertItem;
  isSelected: boolean;
  onSelect: (item: AlertItem, isSelected: boolean) => void;
  onItemClick: (itemId: number) => void;
  getStatusBadge: (status: string) => JSX.Element | null;
  formatDueDate: (dateString: string) => string;
  handleViewTransaction: (e: React.MouseEvent, transactionId: number) => void;
}

const ItemRow: React.FC<ItemRowProps> = ({ 
  item, 
  isSelected, 
  onSelect,
  onItemClick,
  getStatusBadge,
  formatDueDate,
  handleViewTransaction
}) => {
  const handleRowClick = (e: React.MouseEvent) => {
    // Prevent navigation when clicking on the checkbox or transaction button
    if ((e.target as HTMLElement).closest('.checkbox-area') || 
        (e.target as HTMLElement).closest('.transaction-button')) {
      return;
    }
    onItemClick(item.item_id);
  };
  
  return (
    <li 
      className="flex items-center p-4 hover:bg-[#F8F8FE] transition-colors duration-150 cursor-pointer"
      onClick={handleRowClick}
    >
      <div className="flex items-center min-w-0 flex-1">
        <div className="relative flex items-center h-5 checkbox-area">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(item, e.target.checked)}
            className="h-4 w-4 rounded border-[#DADAF3] focus:ring-[#0504AA] focus:ring-offset-0 focus:ring-opacity-20 
            checked:bg-[#8285F4] checked:border-[#8285F4] checked:hover:bg-[#8285F4] checked:hover:border-[#8285F4]"
          />
          {isSelected && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <Check className="h-3 w-3 text-white" />
            </div>
          )}
        </div>
        
        <div className="min-w-0 flex-1 ml-4 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <div>
            <p className="font-medium text-[#2C2C2C] truncate leading-tight hover:underline">{item.item_name}</p>
            <p className="text-sm text-[#6F6F6F] mt-1">Model No. {item.model_number}</p>
            {item.pendingTransaction && (
              <div className="flex items-center gap-1.5 mt-2">
                <Clock className="h-3.5 w-3.5 text-gray-600" />
                <span className="text-sm text-gray-600">
                  {formatDueDate(item.pendingTransaction.due_date)}
                </span>
                <button
                  onClick={(e) => handleViewTransaction(e, item.pendingTransaction!.transaction_id)}
                  className="text-sm text-gray-600 hover:underline ml-1 transaction-button"
                >
                  View Transaction
                </button>
              </div>
            )}
          </div>
          <div className="flex flex-col space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-normal text-[#6F6F6F]">Stock:</span>
              <span className={`text-sm ${item.quantity === 0 ? 'text-red-600' : 'text-[#6F6F6F]'}`}>
                {item.quantity}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-normal text-[#6F6F6F]">Threshold:</span>
              <span className="text-sm text-[#6F6F6F]">{item.threshold_value}</span>
            </div>
            {item.pendingTransaction && (
              <div className="flex items-center space-x-2">
                <span className="text-sm font-normal text-[#6F6F6F]">Requested:</span>
                <span className="text-sm text-[#6F6F6F]">{item.pendingTransaction.requested_quantity}</span>
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-sm font-normal text-[#6F6F6F]">Brand:</span>
              <span className="text-sm text-[#6F6F6F] truncate">{item.brand_name}</span>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusBadge('Low Stock')}
              {item.isPendingDue && getStatusBadge('Pending Due')}
            </div>
          </div>
        </div>
      </div>
    </li>
  );
};

export default AlertsTable; 