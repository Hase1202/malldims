import { Filter } from 'lucide-react';
import FilterDropdown from '../../common/FilterDropdown';

interface AlertsFilterBarProps {
  activeFilter: 'All' | 'Low Stock' | 'Pending Due';
  setActiveFilter: (filter: 'All' | 'Low Stock' | 'Pending Due') => void;
  filterStatus: 'All' | 'Critical' | 'Urgent' | 'Normal';
  setFilterStatus: (status: 'All' | 'Critical' | 'Urgent' | 'Normal') => void;
}

const AlertsFilterBar: React.FC<AlertsFilterBarProps> = ({
  activeFilter,
  setActiveFilter,
  filterStatus,
  setFilterStatus
}) => {
  const statusOptions = ['Critical', 'Urgent', 'Normal'];
  const activeFilterCount = (activeFilter !== 'All' ? 1 : 0) + (filterStatus !== 'All' ? 1 : 0);

  return (
    <div className="flex items-center gap-2.5 md:flex-wrap md:gap-3 overflow-x-auto md:overflow-visible pb-2 md:pb-0 -mb-2 md:mb-0 scrollbar-hide">
      <button 
        onClick={() => setActiveFilter('All')}
        className={`flex-shrink-0 py-1.5 px-3.5 rounded-lg transition-all active:scale-95 duration-50 ease-out
          ${activeFilter === 'All' 
            ? 'bg-[#0504AA] text-white' 
            : 'border-[1.5px] border-[#EBEAEA] text-[#6F6F6F] hover:bg-gray-50'
          }`}
      >
        All
      </button>

      <button 
        onClick={() => setActiveFilter('Low Stock')}
        className={`flex-shrink-0 py-1.5 px-3.5 rounded-lg transition-all active:scale-95 duration-50 ease-out
          ${activeFilter === 'Low Stock' 
            ? 'bg-[#F2F2FB] text-[#0504AA] border-[#DADAF3] border-[1.5px]' 
            : 'border-[1.5px] border-[#EBEAEA] text-[#6F6F6F] hover:bg-gray-50'
          }`}
      >
        Low Stock
      </button>

      <button 
        onClick={() => setActiveFilter('Pending Due')}
        className={`flex-shrink-0 py-1.5 px-3.5 rounded-lg transition-all active:scale-95 duration-50 ease-out
          ${activeFilter === 'Pending Due' 
            ? 'bg-[#F2F2FB] text-[#0504AA] border-[1.5px] border-[#DADAF3]' 
            : 'border-[1.5px] border-[#EBEAEA] text-[#6F6F6F] hover:bg-gray-50'
          }`}
      >
        Pending Due
      </button>

      <FilterDropdown
        label="Priority Status"
        options={statusOptions}
        value={filterStatus !== 'All' ? filterStatus : null}
        onChange={(value) => setFilterStatus(value as 'Critical' | 'Urgent' | 'Normal' || 'All')}
      />

      <div className={`flex-shrink-0 flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg border-[1.5px] border-[#DADAF3] text-[#0504AA] bg-[#F2F2FB]`}>
        <Filter className="h-4 w-4" />
        Filters - {activeFilterCount}
      </div>
    </div>
  );
};

export default AlertsFilterBar; 