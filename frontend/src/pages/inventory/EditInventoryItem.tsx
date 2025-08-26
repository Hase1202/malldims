import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { itemsApi } from '../../lib/api';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { Item } from '../../types/inventory';
import Dropdown from "../../components/common/Dropdown";
import SearchableDropdown from "../../components/common/SearchableDropdown";
import { useBrands } from '../../hooks/useBrands';

// Validation constants from models.py
const MAX_ITEM_NAME_LENGTH = 100;
const MAX_MODEL_NO_LENGTH = 50;
const MAX_INTEGER_VALUE = 32767; // SmallIntegerField max value

// Validation helper functions
const isValidItemName = (name: string): boolean => {
    // Only allow letters, numbers, spaces, and basic punctuation
    const validNameRegex = /^[a-zA-Z0-9\s\-_.,()&]+$/;
    return validNameRegex.test(name);
};

const isValidModelNumber = (modelNo: string): boolean => {
    // Only allow letters, numbers, spaces, hyphens, dots, parentheses, plus, and slash
    const validModelRegex = /^[a-zA-Z0-9\s\-_.()+/\/]+$/;
    return validModelRegex.test(modelNo);
};

interface ApiResponse {
    status: string;
    message?: string;
    data?: {
        status?: 'success' | 'error';
        message?: string;
    };
}

interface EditInventoryItemProps {
    itemId: string;
    onClose: () => void;
}

const ITEM_TYPES = [
    "Skincare Products",
    "Makeup Products", 
    "Hair Care Products",
    "Fragrance Products",
    "Body Care Products",
    "Beauty Tools & Accessories"
] as const;

const ITEM_CATEGORIES = [
    "Premium Brand",
    "Drugstore Brand", 
    "Organic/Natural",
    "Korean Beauty",
    "Luxury Collection",
    "Professional Use"
] as const;

interface FormData {
    item_id?: number;
    item_name?: string;
    model_number?: string;
    item_type?: string;
    category?: string;
    threshold_value?: number;
    quantity?: number;
    availability_status?: string;
    created_at?: string;
    updated_at?: string;
    brand?: number;
    [key: string]: string | number | null | undefined;
}

interface PaginatedResponse {
    results: Item[];
    count: number;
}

export default function EditInventoryItem({ itemId, onClose }: EditInventoryItemProps) {
    const navigate = useNavigate();
    const { brands, loading: brandsLoading } = useBrands();
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<FormData>({
        item_name: '',
        model_number: '',
        item_type: '',
        category: '',
        threshold_value: undefined,
        availability_status: 'In Stock'
    });
    const [isVisible, setIsVisible] = useState(false);
    const [loadingUI, setLoadingUI] = useState(true); // Force loading UI initially
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDuplicateChecking, setIsDuplicateChecking] = useState(false);
    const [originalData, setOriginalData] = useState<Partial<Item>>({});
    const [hasChanges, setHasChanges] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string | undefined>>({});    // Animation on mount
    useEffect(() => {
        requestAnimationFrame(() => {
            setIsVisible(true);
        });
    }, []);

    // Fetch item details
    const { data: item, isLoading } = useQuery({
        queryKey: ['item', itemId],
        queryFn: async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const response = await itemsApi.getById(itemId);
            
            if (response.status === 'error' || !response.data) {
                throw new Error(response.message || 'Failed to fetch item');
            }
            
            const itemData = response.data as Item;
            // Always set brand as a number, fallback to brand if brand_id is missing
            const brandId = itemData.brand_id ? Number(itemData.brand_id) : (itemData.brand ? Number(itemData.brand) : undefined);
            if (!brandId) {
                console.warn('Brand ID missing from fetched itemData:', itemData);
            }
            const formDataWithBrand = {
                ...itemData,
                brand: brandId
            };
            setFormData(formDataWithBrand);
            setOriginalData(formDataWithBrand);
            setLoadingUI(false);
            return itemData;
        },
        enabled: !!itemId
    });

    // Function to check for changes
    const checkForChanges = (currentData: Partial<Item>) => {
        const relevantFields = [
            'item_name',
            'model_number',
            'item_type',
            'category',
            'threshold_value',
            'brand'
        ];

        return relevantFields.some(field => {
            const key = field as keyof Item;
            return currentData[key] !== originalData[key];
        });
    };

    // Add a useEffect to monitor formData changes
    useEffect(() => {
        console.log('Current formData:', formData);
    }, [formData]);

    const checkForDuplicate = async (newData: FormData): Promise<boolean> => {
        setIsDuplicateChecking(true);
        try {
            // Only check for duplicates if any of these fields changed
            if (
                newData.item_name !== originalData.item_name ||
                newData.model_number !== originalData.model_number ||
                newData.brand !== originalData.brand
            ) {
                const response = await itemsApi.getAll(new URLSearchParams({ all: 'true' }));
                if (response.status === 'success' && response.data) {
                    const responseData = response.data as Item[] | PaginatedResponse;
                    const items: Item[] = Array.isArray(responseData) ? responseData : responseData.results;
                    const duplicate = items.find((item: Item) => 
                        item.item_id !== Number(itemId) && // Exclude current item
                        item.item_name === newData.item_name &&
                        item.model_number === newData.model_number &&
                        Number(item.brand) === Number(newData.brand)
                    );

                    if (duplicate) {
                        setError('An item with these exact details already exists');
                        return true;
                    }
                }
            }
            return false;
        } catch (err) {
            console.error('Error checking for duplicates:', err);
            return false;
        } finally {
            setIsDuplicateChecking(false);
        }
    };

    // Add useEffect to check for duplicates when relevant fields change
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (hasChanges) {
                await checkForDuplicate(formData);
            }
        }, 500); // Debounce the check

        return () => clearTimeout(timer);
    }, [formData.item_name, formData.model_number, formData.brand]);

    // Function to check if form has any errors
    const hasErrors = (): boolean => {
        return Object.values(formErrors).some(error => error !== undefined) || error !== null;
    };

    // Function to check if form is valid
    const isFormValid = (): boolean => {
        return (
            formData.item_name?.trim() !== '' &&
            formData.model_number?.trim() !== '' &&
            formData.item_type !== '' &&
            formData.category !== '' &&
            formData.threshold_value !== undefined &&
            formData.threshold_value !== null &&
            !hasErrors() &&
            hasChanges &&
            !isDuplicateChecking
        );
    };

    // Update handleInputChange to include duplicate checking
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string, value: any } }) => {
        const { name, value } = e.target;
        let newFormData = { ...formData };
        
        // Always preserve brand
        if (typeof formData.brand !== 'undefined') {
            newFormData.brand = formData.brand;
        }

        // Handle numeric fields
        if (name === 'threshold_value') {
            newFormData[name] = value === '' ? undefined : Number(value);
        } else if (name === 'brand') {
            newFormData[name] = value;
        } else {
            newFormData[name] = value;
        }

        // Field-specific validation
        if (name === 'item_name') {
            if (!value.trim()) {
                setFormErrors(prev => ({ ...prev, item_name: 'Item name is required' }));
            } else if (value.length > MAX_ITEM_NAME_LENGTH) {
                setFormErrors(prev => ({ ...prev, item_name: 'Item name exceeds the character limit' }));
            } else if (!isValidItemName(value)) {
                setFormErrors(prev => ({ ...prev, item_name: 'Invalid characters in item name' }));
            } else {
                setFormErrors(prev => ({ ...prev, item_name: undefined }));
            }
        }

        if (name === 'model_number') {
            if (!value.trim()) {
                setFormErrors(prev => ({ ...prev, model_number: 'Model number is required' }));
            } else if (value.length > MAX_MODEL_NO_LENGTH) {
                setFormErrors(prev => ({ ...prev, model_number: 'Model No. exceeds the character limit' }));
            } else if (!isValidModelNumber(value)) {
                setFormErrors(prev => ({ ...prev, model_number: 'Invalid characters in model number' }));
            } else {
                setFormErrors(prev => ({ ...prev, model_number: undefined }));
            }
        }

        if (name === 'item_type') {
            if (!value) {
                setFormErrors(prev => ({ ...prev, item_type: 'Type is required' }));
            } else {
                setFormErrors(prev => ({ ...prev, item_type: undefined }));
            }
        }

        if (name === 'category') {
            if (!value) {
                setFormErrors(prev => ({ ...prev, category: 'Category is required' }));
            } else {
                setFormErrors(prev => ({ ...prev, category: undefined }));
            }
        }

        if (name === 'brand') {
            if (!value) {
                setFormErrors(prev => ({ ...prev, brand: 'Brand is required' }));
            } else {
                setFormErrors(prev => ({ ...prev, brand: undefined }));
            }
        }

        setFormData(newFormData);
        const newHasChanges = checkForChanges(newFormData);
        setHasChanges(newHasChanges);
    };

    // Update handleSubmit to use the new validation
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsSaving(true);
        setError(null);

        // Check if form is valid
        if (!isFormValid()) {
            setError('Please fill in all required fields correctly.');
            setIsSaving(false);
            return;
        }

        try {
            // Map frontend field names to backend field names
            const updatePayload = {
                item_name: formData.item_name,
                model_number: formData.model_number,
                item_type: formData.item_type,
                category: formData.category,
                threshold_value: Number(formData.threshold_value),
                brand: Number(formData.brand)
            };

            console.log('Sending payload to backend:', updatePayload);
            
            const response = await itemsApi.update(itemId, updatePayload);
            
            if (response.status === 'error' || !response.data) {
                throw new Error(response.message || 'Failed to update item');
            }
            
            window.location.reload();
        } catch (error: any) {
            console.error('API call error:', error);
            console.error('Error response data:', error?.response?.data);
            
            // Extract detailed error message from the response
            let errorMessage = 'Failed to update item';
            
            if (error?.response?.data) {
                const errorData = error.response.data;
                
                // Handle field-specific errors
                if (typeof errorData === 'object') {
                    const fieldErrors = [];
                    
                    // Check for field-specific errors
                    for (const [field, messages] of Object.entries(errorData)) {
                        if (Array.isArray(messages)) {
                            fieldErrors.push(`${field}: ${messages.join(', ')}`);
                        } else if (typeof messages === 'string') {
                            fieldErrors.push(`${field}: ${messages}`);
                        }
                    }
                    
                    if (fieldErrors.length > 0) {
                        errorMessage = fieldErrors.join('; ');
                    } else if (errorData.detail) {
                        errorMessage = errorData.detail;
                    } else if (errorData.message) {
                        errorMessage = errorData.message;
                    }
                } else if (typeof errorData === 'string') {
                    errorMessage = errorData;
                }
            } else if (error?.message) {
                errorMessage = error.message;
            }
            
            setError(errorMessage);
            setIsSaving(false);
        }
    };
    

    const handleDelete = async () => {
        try {
            setIsDeleting(true);
            const response = await itemsApi.delete(itemId) as unknown as ApiResponse;
            
            // Check both response.status and response.data.status since the API might return either format
            if (response.status === 'error' || response?.data?.status === 'error') {
                const errorMessage = response.message || response?.data?.message || 'Failed to delete item';
                setError(errorMessage);
                setIsDeleting(false);
                // Keep dialog open if error is about transactions
                if (errorMessage.includes('transaction')) {
                    return;
                }
                setShowDeleteDialog(false);
                return;
            }
            
            // Navigate back to inventory with deletion success state
            navigate('/inventory', {
                state: { showDeleteSuccess: true }
            });
        } catch (error: any) {
            console.error('Delete error:', error);
            const errorMessage = error?.response?.data?.message || 
                               error?.response?.data?.detail ||    
                               error?.data?.message ||            
                               error?.message ||                  
                               'Failed to delete item';
            
            setError(errorMessage);
            setIsDeleting(false);
            
            // Keep dialog open only if error is about transactions
            if (!errorMessage.includes('transaction')) {
                setShowDeleteDialog(false);
            }
        }
    };

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(onClose, 300); // Wait for animation to complete
    };

    // Create a LoadingInput component for consistent styling of loading states
    const LoadingInput = ({ label }: { label: string }) => (
        <div>
            <label className="block text-sm mb-2">{label}</label>
            <div className="w-full h-10 bg-gray-100 rounded-lg animate-pulse opacity-70"></div>
        </div>
    );

    // Create a function to prevent event propagation only when needed
    const stopPropagation = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            e.stopPropagation();
        }
    };

    // Show loading state if data is still loading
    if (loadingUI || isLoading) {
        return (
            <>
                {/* Backdrop */}
                <div 
                    className={`fixed inset-0 bg-black/50 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'} z-40`}
                    onClick={(e) => {
                        e.stopPropagation();
                        handleClose();
                    }}
                />

                {/* Slide-in panel */}
                <div 
                    className={`fixed inset-y-0 right-0 w-[500px] bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${isVisible ? 'translate-x-0' : 'translate-x-full'} z-50`}
                    onClick={stopPropagation}
                >
                    <div className="h-full overflow-y-auto">
                        <div className="p-8">
                            <div className="flex items-center mb-8">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleClose();
                                    }}
                                    className="text-[#646464] hover:text-[#2C2C2C] transition-colors mr-2.5"
                                >
                                    <ArrowRight className="h-5 w-5" />
                                </button>
                                <h1 className="text-xl font-medium">Edit Inventory Item</h1>
                            </div>

                            <div className="space-y-6">
                                <LoadingInput label="Item Name" />
                                <LoadingInput label="Model No." />
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <LoadingInput label="Type" />
                                    <LoadingInput label="Category" />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <LoadingInput label="Quantity" />
                                    <LoadingInput label="Threshold Value" />
                                </div>
                                
                                <LoadingInput label="Brand" />

                                <div className="pt-8 space-y-2.5">
                                    <button
                                        disabled
                                        className="w-full bg-[#0504AA]/50 text-white py-3 rounded-lg cursor-not-allowed"
                                    >
                                        Confirm Changes
                                    </button>
                                    <button
                                        disabled
                                        className="w-full bg-[#DC2625]/50 text-white py-3 rounded-lg cursor-not-allowed"
                                    >
                                        Delete Item
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }
    
    if (!item) return null;

    return (
        <>
            {/* Backdrop */}
            <div 
                className={`fixed inset-0 bg-black/50 transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'} z-40`}
                onClick={(e) => {
                    e.stopPropagation();
                    handleClose();
                }}
            />            {/* Slide-in panel */}
            <div 
                className={`fixed inset-y-0 right-0 w-[500px] bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${isVisible ? 'translate-x-0' : 'translate-x-full'} z-50`}
                onClick={stopPropagation}
            >
                <div className="h-full overflow-y-auto">
                    <div className="p-8">
                        <div className="flex items-center mb-8">
                        <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleClose();
                                }}
                                className="text-[#646464] hover:text-[#2C2C2C] cursor-pointer transition-colors mr-2.5"
                            >
                                <ArrowRight className="h-5 w-5" />
                            </button>
                            <h1 className="text-xl font-medium">Edit Inventory Item</h1>
                        </div>

                        {error && (
                            <div className="bg-red-50 border-l-4 border-[#DC2625] p-4 mb-6">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5 text-[#DC2625]" />
                                    <p className="text-[#DC2625]">{error}</p>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm mb-2">Item Name</label>
                                    <input
                                        type="text"
                                        name="item_name"
                                        value={formData.item_name || ''}
                                        onChange={handleInputChange}
                                        className={`w-full p-2.5 border-[1.5px] ${
                                            formErrors.item_name ? 'border-[#D3465C]' : 'border-[#D5D7DA]'
                                        } rounded-lg`}
                                        maxLength={MAX_ITEM_NAME_LENGTH}
                                        placeholder="Enter item name..."
                                    />
                                    {formErrors.item_name && (
                                        <div className="flex items-center gap-1 text-[#D3465C] text-sm mt-1">
                                            <AlertCircle className="h-4 w-4" />
                                            <span>{formErrors.item_name}</span>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm mb-2">Model No.</label>
                                    <input
                                        type="text"
                                        name="model_number"
                                        value={formData.model_number || ''}
                                        onChange={handleInputChange}
                                        className={`w-full p-2.5 border-[1.5px] ${
                                            formErrors.model_number ? 'border-[#D3465C]' : 'border-[#D5D7DA]'
                                        } rounded-lg`}
                                        maxLength={MAX_MODEL_NO_LENGTH}
                                        placeholder="Enter model number..."
                                    />
                                    {formErrors.model_number && (
                                        <div className="flex items-center gap-1 text-[#D3465C] text-sm mt-1">
                                            <AlertCircle className="h-4 w-4" />
                                            <span>{formErrors.model_number}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm mb-2">Type</label>
                                        <Dropdown
                                            options={ITEM_TYPES.map(type => ({
                                                value: type,
                                                label: type
                                            }))}
                                            value={formData.item_type || ''}
                                            onChange={(value) => handleInputChange({
                                                target: { name: 'item_type', value }
                                            } as React.ChangeEvent<HTMLSelectElement>)}
                                            placeholder="Select..."
                                            error={!!formErrors.item_type}
                                        />
                                        {formErrors.item_type && (
                                            <div className="flex items-center gap-1 text-[#D3465C] text-sm mt-1">
                                                <AlertCircle className="h-4 w-4" />
                                                <span>{formErrors.item_type}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-sm mb-2">Category</label>
                                        <Dropdown
                                            options={ITEM_CATEGORIES.map(category => ({
                                                value: category,
                                                label: category
                                            }))}
                                            value={formData.category || ''}
                                            onChange={(value) => handleInputChange({
                                                target: { name: 'category', value }
                                            } as React.ChangeEvent<HTMLSelectElement>)}
                                            placeholder="Select..."
                                            error={!!formErrors.category}
                                        />
                                        {formErrors.category && (
                                            <div className="flex items-center gap-1 text-[#D3465C] text-sm mt-1">
                                                <AlertCircle className="h-4 w-4" />
                                                <span>{formErrors.category}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm mb-2">Quantity</label>
                                        <input
                                            type="number"
                                            value={formData.quantity || ''}
                                            disabled
                                            className="w-full p-2.5 border-[1.5px] border-[#D5D7DA] rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm mb-2">Threshold Value</label>
                                        <input
                                            type="number"
                                            name="threshold_value"
                                            value={formData.threshold_value ?? ''}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                let val = value === '' ? NaN : Number(value);
                                                
                                                // Update form data
                                                handleInputChange({
                                                    target: { name: 'threshold_value', value }
                                                } as React.ChangeEvent<HTMLInputElement>);
                                                
                                                // Validate in real-time - matching quantity validation exactly
                                                if (value === '') {
                                                    setFormErrors(prev => ({ ...prev, threshold_value: 'Threshold value is required' }));
                                                } else if (value && !Number.isInteger(val)) {
                                                    setFormErrors(prev => ({ ...prev, threshold_value: 'Decimal values are not allowed' }));
                                                } else if (isNaN(val)) {
                                                    setFormErrors(prev => ({ ...prev, threshold_value: 'Threshold value is required' }));
                                                } else if (val <= 0) {
                                                    setFormErrors(prev => ({ ...prev, threshold_value: 'Threshold value must be greater than 0' }));
                                                } else if (val > MAX_INTEGER_VALUE) {
                                                    setFormErrors(prev => ({ ...prev, threshold_value: 'Value should be less than or equal to 32767' }));
                                                } else if (val === 0 && formData.item_type !== 'Finished Goods') {
                                                    setFormErrors(prev => ({ ...prev, threshold_value: 'Threshold value must be greater than zero' }));
                                                } else {
                                                    setFormErrors(prev => ({ ...prev, threshold_value: undefined }));
                                                }
                                            }}
                                            className={`w-full p-2.5 border-[1.5px] ${
                                                formErrors.threshold_value ? 'border-[#D3465C]' : 'border-[#D5D7DA]'
                                            } rounded-lg`}
                                            min="0"
                                            max={MAX_INTEGER_VALUE}
                                            placeholder="Enter threshold value..."
                                        />
                                        {formErrors.threshold_value && (
                                            <div className="flex items-center gap-1 text-[#D3465C] text-sm mt-1">
                                                <AlertCircle className="h-4 w-4" />
                                                <span>{formErrors.threshold_value}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm mb-2">Brand</label>
                                    <SearchableDropdown
                                        options={brands.map(brand => ({
                                            value: brand.brand_id,
                                            label: brand.brand_name,
                                            modelNumber: brand.contact_person || undefined
                                        }))}
                                        value={formData.brand || 0}
                                        onChange={(value) => handleInputChange({ target: { name: 'brand', value } })}
                                        placeholder="Select a brand"
                                        searchPlaceholder="Search for brand name..."                                        error={!!formErrors.brand}
                                        noResultsText="No brands found"
                                        isLoading={brandsLoading}
                                    />
                                    {formErrors.brand && (
                                        <div className="flex items-center gap-1 text-[#D3465C] text-sm mt-1">
                                            <AlertCircle className="h-4 w-4" />
                                            <span>{formErrors.brand}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-8 space-y-2.5">
                                    <button
                                        type="submit"
                                        disabled={!isFormValid() || isSaving}
                                        className="w-full bg-[#0504AA] text-white py-3 cursor-pointer rounded-lg transition-all duration-200 hover:bg-[#0504AA]/90 active:transform active:scale-[0.98] disabled:bg-[#0504AA]/50 disabled:cursor-not-allowed disabled:transform-none"
                                    >
                                        {isSaving ? 'Saving...' : 
                                         isDuplicateChecking ? 'Checking for duplicates...' : 
                                         hasChanges ? 'Confirm Changes' : 'No Changes Made'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowDeleteDialog(true)}
                                        disabled={isSaving}
                                        className="w-full bg-[#DC2625] cursor-pointer text-white py-3 rounded-lg transition-all duration-200 hover:bg-[#DC2625]/90 active:transform active:scale-[0.98] disabled:bg-[#DC2625]/50 disabled:cursor-not-allowed disabled:transform-none"
                                    >
                                        Delete Item
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            {showDeleteDialog && (
                <div 
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-60"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setShowDeleteDialog(false);
                        }
                    }}
                >
                    <div 
                        className="bg-white rounded-xl w-full max-w-md p-6"
                        onClick={stopPropagation}
                    >
                        <h2 className="text-lg font-medium mb-2">Delete inventory item</h2>
                        
                        {error ? (
                            <div className="bg-red-50 border-l-4 border-[#DC2625] p-4 mb-6">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5 text-[#DC2625]" />
                                    <p className="text-[#DC2625]">{error}</p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-[#646464] mb-6">
                                Are you sure you want to delete {item.item_name}?
                                This action cannot be undone.
                            </p>
                        )}

                        <div className="flex justify-between gap-4">
                            <button
                                disabled={isDeleting}
                                onClick={() => {
                                    setShowDeleteDialog(false);
                                    setError(null);
                                }}
                                className="flex-1 py-2.5 border border-[#D5D7DA] rounded-lg transition-all duration-200 hover:bg-gray-100 active:bg-gray-200 active:transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                            >
                                Back
                            </button>
                            <button
                                disabled={isDeleting}
                                onClick={handleDelete}
                                className="flex-1 bg-[#DC2625] text-white py-2.5 rounded-lg transition-all duration-200 hover:bg-[#DC2625]/90 active:transform active:scale-[0.98] disabled:bg-[#DC2625]/70 disabled:cursor-not-allowed disabled:transform-none"
                            >
                                {isDeleting ? 'Deleting...' : 'Confirm Deletion'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
