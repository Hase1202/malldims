import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { itemsApi } from '../../lib/api';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { Item } from '../../types/inventory';
import { useBrands } from '../../hooks/useBrands';

// Validation constants from models.py
const MAX_ITEM_NAME_LENGTH = 100;

// Validation helper functions
const isValidItemName = (name: string): boolean => {
    // Only allow letters, numbers, spaces, and basic punctuation
    const validNameRegex = /^[a-zA-Z0-9\s\-_.,()&]+$/;
    return validNameRegex.test(name);
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

interface FormData {
    item_id?: number;
    item_name?: string;
    sku?: string;
    uom?: 'pc' | 'pack';
    quantity?: number;
    availability_status?: string;
    created_at?: string;
    updated_at?: string;
    brand?: number;
    // Pricing fields for each tier
    srpPrice?: number;
    rdPrice?: number;
    pdPrice?: number;
    ddPrice?: number;
    cdPrice?: number;
    rsPrice?: number;
    subRsPrice?: number;
    [key: string]: string | number | null | undefined;
}

interface PaginatedResponse {
    results: Item[];
    count: number;
}

export default function EditInventoryItem({ itemId, onClose }: EditInventoryItemProps) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { brands } = useBrands();
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<FormData>({
        item_name: '',
        sku: '',
        uom: 'pc',
        availability_status: 'In Stock',
        // Initialize pricing fields
        srpPrice: 0,
        rdPrice: 0,
        pdPrice: 0,
        ddPrice: 0,
        cdPrice: 0,
        rsPrice: 0,
        subRsPrice: 0,
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
            const brandId = itemData.brand ? Number(itemData.brand) : undefined;
            if (!brandId) {
                console.warn('Brand ID missing from fetched itemData:', itemData);
            }
            
            // Initialize form data with basic item info
            const formDataWithBrand = {
                item_id: itemData.item_id,
                item_name: itemData.item_name,
                sku: itemData.sku || '',
                uom: itemData.uom || 'pc',
                quantity: itemData.quantity,
                brand: brandId,
                availability_status: 'In Stock',
                // Initialize pricing fields
                srpPrice: 0,
                rdPrice: 0,
                pdPrice: 0,
                ddPrice: 0,
                cdPrice: 0,
                rsPrice: 0,
                subRsPrice: 0,
            };
            
            // If the item has tier_pricing, populate the pricing fields
            if (itemData.tier_pricing && Array.isArray(itemData.tier_pricing)) {
                itemData.tier_pricing.forEach((pricing: any) => {
                    switch (pricing.pricing_tier) {
                        case 'SRP':
                            formDataWithBrand.srpPrice = pricing.price;
                            break;
                        case 'RD':
                            formDataWithBrand.rdPrice = pricing.price;
                            break;
                        case 'PD':
                            formDataWithBrand.pdPrice = pricing.price;
                            break;
                        case 'DD':
                            formDataWithBrand.ddPrice = pricing.price;
                            break;
                        case 'CD':
                            formDataWithBrand.cdPrice = pricing.price;
                            break;
                        case 'RS':
                            formDataWithBrand.rsPrice = pricing.price;
                            break;
                        case 'SUB-RS':
                            formDataWithBrand.subRsPrice = pricing.price;
                            break;
                    }
                });
            }
            
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
            'uom',
            'srpPrice',
            'rdPrice', 
            'pdPrice',
            'ddPrice',
            'cdPrice',
            'rsPrice',
            'subRsPrice'
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
                newData.uom !== originalData.uom
            ) {
                const response = await itemsApi.getAll(new URLSearchParams({ all: 'true' }));
                if (response.status === 'success' && response.data) {
                    const responseData = response.data as Item[] | PaginatedResponse;
                    const items: Item[] = Array.isArray(responseData) ? responseData : responseData.results;
                    const duplicate = items.find((item: Item) => 
                        item.item_id !== Number(itemId) && // Exclude current item
                        item.item_name === newData.item_name &&
                        item.uom === newData.uom &&
                        Number(item.brand) === Number(originalData.brand)  // Use original brand for comparison
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
    }, [formData.item_name, formData.uom]); // Only check when name or UOM changes

    // Function to check if form has any errors
    const hasErrors = (): boolean => {
        return Object.values(formErrors).some(error => error !== undefined) || error !== null;
    };

    // Function to check if form is valid
    const isFormValid = (): boolean => {
        return (
            formData.item_name?.trim() !== '' &&
            !hasErrors() &&
            hasChanges &&
            !isDuplicateChecking
        );
    };

    // Handle pricing field changes
    const handlePricingChange = (key: string, value: string) => {
        const numericValue = value === '' ? 0 : parseFloat(value) || 0;
        const newFormData = { 
            ...formData, 
            [key]: numericValue 
        };
        setFormData(newFormData);
        const newHasChanges = checkForChanges(newFormData);
        setHasChanges(newHasChanges);
    };

    // Update handleInputChange to include duplicate checking
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement> | { target: { name: string, value: any } }) => {
        const { name, value } = e.target;
        let newFormData = { ...formData };
        
        // Always preserve brand since it's read-only
        if (typeof formData.brand !== 'undefined') {
            newFormData.brand = formData.brand;
        }

        // Handle all other fields normally
        if (name === 'threshold_value') {
            newFormData[name] = value === '' ? undefined : Number(value);
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

    if (!isFormValid()) {
        setError('Please fill in all required fields correctly.');
        setIsSaving(false);
        return;
    }

    try {
        const updatePayload = {
            item_name: formData.item_name,
            uom: formData.uom,
        };

        const response = await itemsApi.update(itemId, updatePayload);
        if (response.status === 'error' || !response.data) {
            throw new Error(response.message || 'Failed to update item');
        }

        const tierPricingPromises = [];
        const currentTierPricingResponse = await itemsApi.getTierPricingForItem(Number(itemId));

        let currentTierPricingData = [];
        if (currentTierPricingResponse.status === 'success') {
            if (Array.isArray(currentTierPricingResponse.data)) {
                currentTierPricingData = currentTierPricingResponse.data;
            } else if (currentTierPricingResponse.data && currentTierPricingResponse.data.results) {
                currentTierPricingData = currentTierPricingResponse.data.results;
            }
        }

        const currentPricingMap = new Map();
        currentTierPricingData.forEach((pricing: any) => {
            currentPricingMap.set(pricing.pricing_tier, pricing);
        });

        const pricingTiers = [
            { tier: 'SRP', formField: 'srpPrice' },
            { tier: 'RD', formField: 'rdPrice' },
            { tier: 'PD', formField: 'pdPrice' },
            { tier: 'DD', formField: 'ddPrice' },
            { tier: 'CD', formField: 'cdPrice' },
            { tier: 'RS', formField: 'rsPrice' },
            { tier: 'SUB-RS', formField: 'subRsPrice' }
        ];

        for (const { tier, formField } of pricingTiers) {
            const newPrice = formData[formField as keyof FormData] as number || 0;
            const currentPricing = currentPricingMap.get(tier);

            if (currentPricing) {
                if (newPrice > 0) {
                    if (currentPricing.price !== newPrice) {
                        tierPricingPromises.push(
                            itemsApi.updateTierPricing(currentPricing.id, {
                                item: Number(itemId),
                                pricing_tier: tier,
                                price: newPrice
                            })
                        );
                    }
                } else {
                    tierPricingPromises.push(itemsApi.deleteTierPricing(currentPricing.id));
                }
            } else {
                if (newPrice > 0) {
                    tierPricingPromises.push(
                        itemsApi.createTierPricing({
                            item: Number(itemId),
                            pricing_tier: tier,
                            price: newPrice
                        })
                    );
                }
            }
        }

        if (tierPricingPromises.length > 0) {
            const pricingResults = await Promise.all(tierPricingPromises);
            const failedPricing = pricingResults.filter(result => result.status === 'error');
            if (failedPricing.length > 0) {
                console.warn('Some pricing updates failed:', failedPricing);
            }
        }

        await queryClient.invalidateQueries({ queryKey: ['item', itemId] });
        await queryClient.invalidateQueries({ queryKey: ['items'] });
        handleClose();
    } catch (error: any) {
        console.error('API call error:', error);
        let errorMessage = 'Failed to update item';
        if (error?.response?.data) {
            const errorData = error.response.data;
            if (typeof errorData === 'object') {
                const fieldErrors = Object.entries(errorData).map(([field, messages]) => {
                    if (Array.isArray(messages)) {
                        return `${field}: ${messages.join(', ')}`;
                    }
                    return `${field}: ${messages}`;
                });
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
    } finally {
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
            
            // Invalidate cache to refresh the inventory list
            await queryClient.invalidateQueries({ queryKey: ['items'] });
            
            // Reset states
            setIsDeleting(false);
            setShowDeleteDialog(false);
            
            // Navigate back to inventory
            navigate('/inventory');
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
                                    <label className="block text-sm mb-2">SKU</label>
                                    <input
                                        type="text"
                                        name="sku"
                                        value={formData.sku || ''}
                                        disabled
                                        className="w-full p-2.5 border-[1.5px] border-[#D5D7DA] rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                                        placeholder="Auto-generated"
                                    />
                                </div>

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
                                    <label className="block text-sm mb-2">Unit of Measure (UoM)</label>
                                    <select
                                        name="uom"
                                        value={formData.uom || 'pc'}
                                        onChange={handleInputChange}
                                        className="w-full p-2.5 border-[1.5px] border-[#D5D7DA] rounded-lg focus:outline-none focus:border-[#0504AA]"
                                    >
                                        <option value="pc">Piece (pc)</option>
                                        <option value="pack">Pack</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm mb-2">Brand</label>
                                    <input
                                        type="text"
                                        value={(() => {
                                            const currentBrand = brands.find(b => b.brand_id === formData.brand);
                                            return currentBrand ? currentBrand.brand_name : 'Loading...';
                                        })()}
                                        disabled
                                        className="w-full p-2.5 border-[1.5px] border-[#D5D7DA] rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                                    />
                                </div>

                                {/* Tier Pricing Section */}
                                <div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-4">Tier Pricing</h3>
                                    <p className="text-sm text-gray-600 mb-4">
                                        Set prices for each distribution tier. Prices should generally increase from distributor to retail levels.
                                    </p>
                                    
                                    <div className="space-y-4">
                                        {[
                                            { key: 'rdPrice', label: 'Regional Distributor (RD)', tier: 'RD' },
                                            { key: 'pdPrice', label: 'Provincial Distributor (PD)', tier: 'PD' },
                                            { key: 'ddPrice', label: 'District Distributor (DD)', tier: 'DD' },
                                            { key: 'cdPrice', label: 'City Distributor (CD)', tier: 'CD' },
                                            { key: 'rsPrice', label: 'Reseller (RS)', tier: 'RS' },
                                            { key: 'subRsPrice', label: 'Sub-Reseller (SUB-RS)', tier: 'SUB-RS' },
                                            { key: 'srpPrice', label: 'Suggested Retail Price (SRP)', tier: 'SRP' },
                                        ].map(({ key, label }) => (
                                            <div key={key} className="flex items-center gap-4">
                                                <div className="w-48">
                                                    <label className="block text-sm font-medium text-gray-700">
                                                        {label}
                                                    </label>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₱</span>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            value={formData[key as keyof FormData] || ''}
                                                            onChange={(e) => handlePricingChange(key, e.target.value)}
                                                            className="w-full pl-8 pr-3 py-2 border-[1.5px] border-[#D5D7DA] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                            placeholder="0.00"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
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
