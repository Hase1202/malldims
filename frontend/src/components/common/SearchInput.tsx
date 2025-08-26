import { ChangeEvent, KeyboardEvent } from 'react';
import { Search, X, Loader2 } from 'lucide-react';

interface SearchInputProps {
    value: string;
    onChange: (value: string) => void;
    onClear: () => void;
    isLoading?: boolean;
    placeholder?: string;
    className?: string;
}

export default function SearchInput({
    value,
    onChange,
    onClear,
    isLoading = false,
    placeholder = 'Search...',
    className = ''
}: SearchInputProps) {
    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Escape') {
            onClear();
        }
    };

    return (
        <div className={`relative ${className}`}>
            <div className="flex items-center space-x-2 p-2.5 border-[1.5px] border-[#EBEAEA] w-full lg:w-[42vh] rounded-lg focus-within:border-[#DADAF3] transition-colors duration-200">
                <Search className="h-4 w-4 mt-0.5 text-[#6F6F6F]" aria-hidden="true" />
                <input
                    type="text"
                    value={value}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="w-full text-sm placeholder:text-[#6F6F6F] focus:outline-none"
                    aria-label="Search inventory items"
                    role="searchbox"
                    aria-expanded={value.length > 0}
                />
                {(value.length > 0 || isLoading) && (
                    <div className="flex items-center">
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-[#6F6F6F]" aria-hidden="true" />
                        ) : (
                            <button
                                onClick={onClear}
                                className="p-1 hover:bg-gray-100 rounded-full"
                                aria-label="Clear search"
                            >
                                <X className="h-4 w-4 text-[#6F6F6F]" />
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
} 