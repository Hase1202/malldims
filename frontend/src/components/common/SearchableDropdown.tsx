import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface Option {
  value: number;
  label: string;
  modelNumber?: string;
  itemType?: string;
}

interface SearchableDropdownProps {
  options: Option[];
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  error?: boolean;
  noResultsText?: string;
  isLoading?: boolean;
  searchPlaceholder?: string;
  loadingText?: string;
}

export default function SearchableDropdown({ 
  options, 
  value, 
  onChange, 
  placeholder = "Select an option",
  error = false,
  noResultsText = "No items found",
  isLoading = false,
  searchPlaceholder = "Search...",
  loadingText = "Loading..."
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter options based on search term
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (option.modelNumber && option.modelNumber.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Group options by item type
  const groupedOptions = filteredOptions.reduce((acc, option) => {
    const type = option.itemType || 'Other';
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(option);
    return acc;
  }, {} as Record<string, Option[]>);

  // Sort item types
  const sortedTypes = Object.keys(groupedOptions).sort();

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get selected option label
  const selectedOption = options.find(option => option.value === value);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Selected value display */}
      <div
        className={`flex items-center justify-between p-2.5 border-[1.5px] ${
          error ? 'border-[#D3465C]' : 'border-[#D5D7DA]'
        } rounded-lg cursor-pointer bg-white ${
          !selectedOption ? 'text-black/40' : 'text-[#2C2C2C]'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-col">
          <span>{selectedOption ? selectedOption.label : placeholder}</span>
          {selectedOption?.modelNumber && (
            <span className="text-xs text-gray-500">
              {selectedOption.modelNumber}
            </span>
          )}
        </div>
        <ChevronDown className="h-4 w-4 text-[#2C2C2C]" />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-[#D5D7DA] rounded-lg shadow-lg max-h-[300px] overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-3 py-2 text-sm border-[1.5px] border-gray-200 rounded-md focus:outline-none focus:border-[#DADAF3]"
              />
            </div>
          </div>

          {/* Options list */}
          <div className="overflow-y-auto max-h-[240px]">
            {isLoading ? (
              <div className="p-3 text-sm text-gray-500 text-center">
                {loadingText}
              </div>
            ) : filteredOptions.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 text-center">
                {noResultsText}
              </div>
            ) : (
              sortedTypes.map((type) => (
                <div key={type}>
                  <div className="sticky top-0 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {type}
                  </div>
                  {groupedOptions[type].map((option) => (
                    <div
                      key={option.value}
                      className={`px-3 py-2 cursor-pointer hover:bg-gray-50 ${
                        option.value === value ? 'bg-[#F2F2FB]' : ''
                      }`}
                      onClick={() => {
                        onChange(option.value);
                        setIsOpen(false);
                        setSearchTerm('');
                      }}
                    >
                      <div className="flex flex-col">
                        <span className={`text-sm ${option.value === value ? 'text-[#0504AA] font-medium' : 'text-gray-900'}`}>
                          {option.label}
                        </span>
                        {option.modelNumber && (
                          <span className="text-xs text-gray-500">
                            {option.modelNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
} 