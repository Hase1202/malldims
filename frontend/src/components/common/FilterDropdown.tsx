import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

type OptionType = string | { value: string; label: string };

interface FilterDropdownProps {
    label: string;
    options: OptionType[];
    value: string | null;
    onChange: (value: string | null) => void;
    isLoading?: boolean;
}

const FilterDropdown: React.FC<FilterDropdownProps> = ({
    label,
    options,
    value,
    onChange,
    isLoading = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Normalize options to ensure consistent format
    const normalizedOptions = options.map((option, index) => {
        if (typeof option === 'string') {
            return { value: option, label: option, key: `${option}-${index}` };
        }
        return { ...option, key: `${option.value}-${index}` };
    });

    // Get display value
    const getDisplayValue = () => {
        if (!value) return label;
        const option = normalizedOptions.find(opt => opt.value === value);
        return option ? option.label : value;
    };

    const handleOptionClick = (optionValue: string) => {
        onChange(optionValue === value ? null : optionValue);
        setIsOpen(false);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (isLoading) {
        return (
            <div className="flex-shrink-0 py-1.5 px-3.5 rounded-lg border-[1.5px] border-[#EBEAEA] text-[#6F6F6F] bg-gray-50">
                Loading...
            </div>
        );
    }

    return (
        <div className="relative flex-shrink-0" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg transition-all cursor-pointer
                    ${value 
                        ? 'bg-[#0504AA] text-white' 
                        : 'border-[1.5px] border-[#EBEAEA] text-[#6F6F6F] hover:bg-gray-50'
                    }`}
            >
                <span className="whitespace-nowrap">{getDisplayValue()}</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-full max-h-60 overflow-y-auto">
                    {normalizedOptions.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-gray-500">
                            No options available
                        </div>
                    ) : (
                        normalizedOptions.map((option) => (
                            <button
                                key={option.key}
                                onClick={() => handleOptionClick(option.value)}
                                className={`w-full text-left px-3 py-2 hover:bg-gray-100 text-sm transition-colors
                                    ${value === option.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}
                                `}
                            >
                                {option.label}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default FilterDropdown;