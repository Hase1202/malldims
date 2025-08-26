import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface DropdownProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  label?: string;
}

export default function Dropdown({ 
  options, 
  value, 
  onChange, 
  placeholder = "Select an option",
  error = false,
  label
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      {label && (
        <label className="block text-sm mb-2 text-[#2C2C2C]">
          {label} <span className="text-[#2C2C2C]/50">*</span>
        </label>
      )}
      {/* Selected value display */}
      <div
        className={`flex items-center justify-between p-2.5 border-[1.5px] ${
          error ? 'border-[#D3465C]' : 'border-[#D5D7DA]'
        } rounded-lg cursor-pointer bg-white ${
          !selectedOption ? 'text-black/40' : 'text-[#2C2C2C]'
        }`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown className="h-4 w-4 text-[#2C2C2C]" />
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-[#D5D7DA] rounded-lg shadow-lg max-h-[300px] overflow-hidden">
          <div className="overflow-y-auto max-h-[240px]">
            {options.map((option) => (
              <div
                key={option.value}
                className={`px-3 py-2 cursor-pointer hover:bg-gray-50 ${
                  option.value === value ? 'bg-[#F2F2FB] text-[#0504AA] font-medium' : 'text-gray-900'
                }`}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                {option.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 