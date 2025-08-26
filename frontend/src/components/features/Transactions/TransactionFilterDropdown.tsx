import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface TransactionFilterDropdownProps {
    label: string;
    options: string[];
    value: string | null;
    onChange: (value: string | null) => void;
    chevronUp?: boolean;
    isLoading?: boolean;
}

const TransactionFilterDropdown: React.FC<TransactionFilterDropdownProps> = ({
    label,
    options,
    value,
    onChange,
    chevronUp,
    isLoading = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const isActive = value !== null;

    return (
        <div className="relative flex-shrink-0" ref={dropdownRef}>
            <button
                ref={buttonRef}
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg transition-all whitespace-nowrap active:scale-95
                    ${isActive 
                        ? 'bg-[#F2F2FB] text-[#0504AA] border border-[#DADAF3]' 
                        : 'border-[1.5px] border-[#EBEAEA] text-[#6F6F6F] hover:bg-gray-50'
                    }`}
            >
                {value || label}
                {isActive ? (
                    <X 
                        className="h-4 w-4 hover:text-red-500"
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange(null);
                            setIsOpen(false);
                        }}
                    />
                ) : (
                    <ChevronDown 
                        className={`h-4 w-4 transition-transform ${chevronUp ? 'rotate-180' : ''} ${isOpen ? (chevronUp ? 'rotate-0' : 'rotate-180') : ''}`}
                    />
                )}
            </button>

            {isOpen && (
                <div className="fixed z-50 mt-1 w-48 bg-white rounded-lg shadow-lg border-[1.5px] border-[#EBEAEA] py-1" style={{
                    top: buttonRef.current ? buttonRef.current.getBoundingClientRect().bottom + 4 : 0,
                    left: buttonRef.current ? buttonRef.current.getBoundingClientRect().left : 0
                }}>
                    {isLoading ? (
                        <div className="px-3 py-2 text-sm text-[#6F6F6F] text-center">
                            Loading...
                        </div>
                    ) : (
                        <div className="max-h-[240px] overflow-y-auto">
                            {options.map((option) => (
                                <button
                                    key={option}
                                    onClick={() => {
                                        onChange(option === value ? null : option);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-50 active:scale-95
                                        ${option === value ? 'text-[#0504AA]' : 'text-[#6F6F6F]'}`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TransactionFilterDropdown; 