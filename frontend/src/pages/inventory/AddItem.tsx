import Sidebar from "../../components/common/Sidebar";
import { useState } from "react";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { itemsApi } from "../../lib/api";
import { useNavigate, Navigate } from "react-router-dom";
import Dropdown from "../../components/common/Dropdown";
import SearchableDropdown from "../../components/common/SearchableDropdown";
import { useAuthContext } from '../../context/AuthContext';
import { isSales } from '../../utils/permissions';
import { useBrands } from '../../hooks/useBrands';

interface InventoryItemForm {
    itemName: string;
    sku: string;
    uom: 'pc' | 'pack';
    quantity: number;
    brand: string;
    // Pricing fields for each tier
    srpPrice: number;
    rdPrice: number;
    pdPrice: number;
    ddPrice: number;
    cdPrice: number;
    rsPrice: number;
    subRsPrice: number;
}

interface FormErrors {
    itemName?: string;
    sku?: string;
    uom?: string;
    brand?: string;
    // Pricing errors
    srpPrice?: string;
    rdPrice?: string;
    pdPrice?: string;
    ddPrice?: string;
    cdPrice?: string;
    rsPrice?: string;
    subRsPrice?: string;
    pricingHierarchy?: string;
}

const UOM_CHOICES = [
    { value: 'pc', label: 'Piece' },
    { value: 'pack', label: 'Pack' }
] as const;

const MAX_ITEM_NAME_LENGTH = 100;
const MAX_MODEL_NO_LENGTH = 50;

// Validation regex for item name
const ITEM_NAME_REGEX = /^[a-zA-Z0-9\s\-_.,()&]+$/;

export default function AddInventoryItemPage() {
    const { user } = useAuthContext();
    if (isSales(user)) return <Navigate to="/inventory" replace />;
    const navigate = useNavigate();
    const { brands, loading: brandsLoading, error: brandsError } = useBrands();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [nextSku, setNextSku] = useState<string>('');
    const [form, setForm] = useState<InventoryItemForm>({
        itemName: '',
        sku: '',
        uom: 'pc',
        quantity: 0, // Always 0 for new items - batches will handle quantities
        brand: '',
        // Initialize pricing fields
        srpPrice: 0,
        rdPrice: 0,
        pdPrice: 0,
        ddPrice: 0,
        cdPrice: 0,
        rsPrice: 0,
        subRsPrice: 0,
    });

    // Combine errors from brands hook and local state
    const displayError = error || brandsError;
    const isLoading = loading || brandsLoading;

    // Fetch next SKU when brand changes
    const updateNextSku = async (brandId: string) => {
        if (brandId) {
            try {
                const response = await itemsApi.getNextSku(parseInt(brandId));
                if (response.status === 'success' && response.data) {
                    setNextSku(response.data.next_sku);
                } else {
                    setNextSku('');
                }
            } catch (error) {
                console.error('Failed to get next SKU:', error);
                setNextSku('');
            }
        } else {
            setNextSku('');
        }
    };

    // Update SKU when brand changes
    const handleBrandChange = (brandId: string) => {
        setForm({ ...form, brand: brandId });
        updateNextSku(brandId);
    };

    const validateForm = (): boolean => {
        const errors: FormErrors = {};
        let isValid = true;

        // Item Name validation
        if (!form.itemName.trim()) {
            errors.itemName = 'Item name is required';
            isValid = false;
        } else if (form.itemName.length > MAX_ITEM_NAME_LENGTH) {
            errors.itemName = 'Item name exceeds the character limit';
            isValid = false;
        } else if (!ITEM_NAME_REGEX.test(form.itemName)) {
            errors.itemName = 'Invalid characters in item name';
            isValid = false;
        }

        // SKU validation (optional)
        if (form.sku && form.sku.length > MAX_MODEL_NO_LENGTH) {
            errors.sku = 'SKU exceeds the character limit';
            isValid = false;
        }

        if (!form.brand) {
            errors.brand = 'Brand is required';
            isValid = false;
        }

        // UoM validation
        if (!form.uom || !UOM_CHOICES.some(choice => choice.value === form.uom)) {
            errors.uom = 'Unit of Measurement is required';
            isValid = false;
        }

        // Pricing validation
        const pricingFields = ['srpPrice', 'rdPrice', 'pdPrice', 'ddPrice', 'cdPrice', 'rsPrice', 'subRsPrice'] as const;
        for (const field of pricingFields) {
            if (form[field] < 0) {
                errors[field] = 'Price cannot be negative';
                isValid = false;
            }
        }

        // Validate pricing hierarchy (each tier should be <= the next tier)
        const prices = [
            { name: 'Regional Distributor', value: form.rdPrice, field: 'rdPrice' as keyof FormErrors },
            { name: 'Provincial Distributor', value: form.pdPrice, field: 'pdPrice' as keyof FormErrors },
            { name: 'District Distributor', value: form.ddPrice, field: 'ddPrice' as keyof FormErrors },
            { name: 'City Distributor', value: form.cdPrice, field: 'cdPrice' as keyof FormErrors },
            { name: 'Reseller', value: form.rsPrice, field: 'rsPrice' as keyof FormErrors },
            { name: 'Sub-Reseller', value: form.subRsPrice, field: 'subRsPrice' as keyof FormErrors },
            { name: 'SRP', value: form.srpPrice, field: 'srpPrice' as keyof FormErrors },
        ];

        for (let i = 0; i < prices.length - 1; i++) {
            if (prices[i].value > 0 && prices[i + 1].value > 0 && prices[i].value > prices[i + 1].value) {
                errors.pricingHierarchy = `${prices[i].name} price should be less than or equal to ${prices[i + 1].name} price`;
                isValid = false;
                break;
            }
        }

        setFormErrors(errors);
        return isValid;
    };

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        
        if (!validateForm()) {
            setError("Please fix all errors before submitting.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Create the basic item first (SKU will be auto-generated)
            const itemData = {
                item_name: form.itemName,
                uom: form.uom,
                quantity: form.quantity,
                brand: parseInt(form.brand),
            };

            console.log('Creating item with data:', itemData);
            const response = await itemsApi.create(itemData);
            
            if (response.status === 'success' && response.data) {
                const itemId = response.data.item_id;
                console.log('Item created with ID:', itemId);
                
                // Create pricing for each tier
                const pricingPromises = [];
                
                if (form.srpPrice > 0) {
                    pricingPromises.push(itemsApi.createTierPricing({
                        item: itemId,
                        pricing_tier: 'SRP',
                        price: form.srpPrice
                    }));
                }
                
                if (form.rdPrice > 0) {
                    pricingPromises.push(itemsApi.createTierPricing({
                        item: itemId,
                        pricing_tier: 'RD',
                        price: form.rdPrice
                    }));
                }
                
                if (form.pdPrice > 0) {
                    pricingPromises.push(itemsApi.createTierPricing({
                        item: itemId,
                        pricing_tier: 'PD',
                        price: form.pdPrice
                    }));
                }
                
                if (form.ddPrice > 0) {
                    pricingPromises.push(itemsApi.createTierPricing({
                        item: itemId,
                        pricing_tier: 'DD',
                        price: form.ddPrice
                    }));
                }
                
                if (form.cdPrice > 0) {
                    pricingPromises.push(itemsApi.createTierPricing({
                        item: itemId,
                        pricing_tier: 'CD',
                        price: form.cdPrice
                    }));
                }
                
                if (form.rsPrice > 0) {
                    pricingPromises.push(itemsApi.createTierPricing({
                        item: itemId,
                        pricing_tier: 'RS',
                        price: form.rsPrice
                    }));
                }
                
                if (form.subRsPrice > 0) {
                    pricingPromises.push(itemsApi.createTierPricing({
                        item: itemId,
                        pricing_tier: 'SUB-RS',
                        price: form.subRsPrice
                    }));
                }
                
                // Execute all pricing creation requests
                if (pricingPromises.length > 0) {
                    console.log('Creating pricing for', pricingPromises.length, 'tiers');
                    await Promise.all(pricingPromises);
                }
                
                navigate("/inventory");
            } else {
                setError(response.message || "Failed to create item");
            }
        } catch (error: any) {
            console.error("Create item error:", error);
            
            if (error.response?.data?.message) {
                setError(error.response.data.message);
            } else if (error.response?.data) {
                // Handle field-specific errors
                const backendErrors = error.response.data;
                const newFormErrors: FormErrors = {};
                
                Object.keys(backendErrors).forEach(field => {
                    switch (field) {
                        case 'item_name':
                            newFormErrors.itemName = Array.isArray(backendErrors[field]) 
                                ? backendErrors[field][0] 
                                : backendErrors[field];
                            break;
                        case 'sku':
                            newFormErrors.sku = Array.isArray(backendErrors[field]) 
                                ? backendErrors[field][0] 
                                : backendErrors[field];
                            break;
                        case 'brand':
                            newFormErrors.brand = Array.isArray(backendErrors[field]) 
                                ? backendErrors[field][0] 
                                : backendErrors[field];
                            break;
                        default:
                            console.log('Unhandled field error:', field, backendErrors[field]);
                    }
                });
                
                if (Object.keys(newFormErrors).length > 0) {
                    setFormErrors(prev => ({ ...prev, ...newFormErrors }));
                }
                
                setError("Please fix the highlighted errors and try again.");
            } else {
                setError("An unexpected error occurred. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    };

    const renderFieldError = (fieldName: keyof FormErrors) => {
        if (formErrors[fieldName]) {
            return (
                <div className="flex items-center gap-1 text-[#D3465C] text-sm mt-1">
                    <AlertCircle className="h-4 w-4" />
                    <span>{formErrors[fieldName]}</span>
                </div>
            );
        }
        return null;
    };

    if (brandsLoading) {
        return (
            <div className="flex h-screen bg-gray-50">
                <Sidebar isOpen={false} />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
                        <p className="mt-2 text-gray-600">Loading brands...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar isOpen={false} />
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="bg-white shadow-md z-10">
                    <div className="px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => navigate('/inventory')}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                    aria-label="Go back to inventory"
                                >
                                    <ArrowLeft className="h-5 w-5 text-gray-600" />
                                </button>
                                <h1 className="text-2xl font-bold text-gray-900">Add New Item</h1>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-6">
                    <div className="max-w-4xl mx-auto">
                        {displayError && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                                <div className="flex">
                                    <AlertCircle className="h-5 w-5 text-red-400" />
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-red-800">Error</h3>
                                        <div className="mt-2 text-sm text-red-700">{displayError}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border-[1.5px] border-[#EBEAEA] p-8 space-y-8">
                            {/* Basic Information */}
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label htmlFor="itemName" className="block text-sm font-medium text-gray-700 mb-2">
                                            Item Name *
                                        </label>
                                        <input
                                            type="text"
                                            id="itemName"
                                            value={form.itemName}
                                            onChange={(e) => setForm({ ...form, itemName: e.target.value })}
                                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                                formErrors.itemName ? 'border-red-500' : 'border-gray-300'
                                            }`}
                                            placeholder="Enter item name"
                                            maxLength={MAX_ITEM_NAME_LENGTH}
                                        />
                                        {renderFieldError('itemName')}
                                    </div>

                                    <div>
                                        <label htmlFor="sku" className="block text-sm font-medium text-gray-700 mb-2">
                                            SKU (Auto-generated)
                                        </label>
                                        <input
                                            type="text"
                                            id="sku"
                                            value={nextSku || (form.brand ? "Select brand to preview SKU" : "Select brand first")}
                                            disabled
                                            className="w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Unit of Measurement *
                                        </label>
                                        <Dropdown
                                            options={UOM_CHOICES.map(choice => ({
                                                value: choice.value,
                                                label: choice.label
                                            }))}
                                            value={form.uom}
                                            onChange={(value) => setForm({ ...form, uom: value as 'pc' | 'pack' })}
                                            placeholder="Select unit"
                                            error={!!formErrors.uom}
                                        />
                                        {renderFieldError('uom')}
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Brand *
                                        </label>
                                        <SearchableDropdown
                                            options={brands.map(brand => ({
                                                value: brand.brand_id,
                                                label: brand.brand_name
                                            }))}
                                            value={parseInt(form.brand) || 0}
                                            onChange={(value) => handleBrandChange(value.toString())}
                                            placeholder="Search and select brand"
                                            error={!!formErrors.brand}
                                        />
                                        {renderFieldError('brand')}
                                    </div>
                                </div>
                            </div>

                            {/* Pricing Information */}
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 mb-4">Tier Pricing</h2>
                                <p className="text-sm text-gray-600 mb-4">
                                    Set prices for each distribution tier. Prices should generally increase from distributor to retail levels.
                                </p>
                                
                                {formErrors.pricingHierarchy && (
                                    <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                        <div className="flex items-center gap-2 text-red-700">
                                            <AlertCircle className="h-4 w-4" />
                                            <span className="text-sm">{formErrors.pricingHierarchy}</span>
                                        </div>
                                    </div>
                                )}

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
                                            <div className="w-64">
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
                                                        value={form[key as keyof InventoryItemForm] || ''}
                                                        onChange={(e) => setForm({ 
                                                            ...form, 
                                                            [key]: parseFloat(e.target.value) || 0 
                                                        })}
                                                        className={`w-full pl-8 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                                                            formErrors[key as keyof FormErrors] ? 'border-red-500' : 'border-gray-300'
                                                        }`}
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                                {renderFieldError(key as keyof FormErrors)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="flex justify-end pt-6 border-t border-gray-200">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    {isLoading ? 'Creating...' : 'Create Item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
