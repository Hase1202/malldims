import Sidebar from "../../components/common/Sidebar";
import { useState } from "react";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { itemsApi } from "../../lib/api";
import { useNavigate, Navigate } from "react-router-dom";
import { Item } from "../../types/inventory";
import Dropdown from "../../components/common/Dropdown";
import SearchableDropdown from "../../components/common/SearchableDropdown";
import { useAuthContext } from '../../context/AuthContext';
import { isSales } from '../../utils/permissions';
import { useBrands } from '../../hooks/useBrands';

interface InventoryItemForm {
    itemName: string;
    modelNo: string;
    type: string;
    category: string;
    quantity: number;
    thresholdValue: number;
    brand: string;
    // Pricing fields
    regionalDistributor: number;
    provincialDistributor: number;
    districtDistributor: number;
    cityDistributor: number;
    reseller: number;
    subReseller: number;
    srp: number;
}

interface FormErrors {
    itemName?: string;
    modelNo?: string;
    type?: string;
    category?: string;
    thresholdValue?: string;
    brand?: string;
    // Pricing errors
    regionalDistributor?: string;
    provincialDistributor?: string;
    districtDistributor?: string;
    cityDistributor?: string;
    reseller?: string;
    subReseller?: string;
    srp?: string;
    pricingHierarchy?: string;
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

type ItemType = typeof ITEM_TYPES[number];
type ItemCategory = typeof ITEM_CATEGORIES[number];

const MAX_ITEM_NAME_LENGTH = 100;
const MAX_MODEL_NO_LENGTH = 50;
const MAX_INTEGER_VALUE = 32767;  // SmallIntegerField max value

// Validation regex for item name and model number
const ITEM_NAME_REGEX = /^[a-zA-Z0-9\s\-_.,()&]+$/;
// Allow + and / in model number
const MODEL_NO_REGEX = /^[a-zA-Z0-9\s\-_.()+/\/]+$/;

export default function AddInventoryItemPage() {
    const { user } = useAuthContext();
    if (isSales(user)) return <Navigate to="/inventory" replace />;
    const navigate = useNavigate();
    const { brands, loading: brandsLoading, error: brandsError } = useBrands();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formErrors, setFormErrors] = useState<FormErrors>({});
    const [form, setForm] = useState<InventoryItemForm>({
        itemName: '',
        modelNo: '',
        type: '',
        category: '',
        quantity: 0, // Always 0 for new items - batches will handle quantities
        thresholdValue: NaN,
        brand: '',
        // Initialize pricing fields
        regionalDistributor: 0,
        provincialDistributor: 0,
        districtDistributor: 0,
        cityDistributor: 0,
        reseller: 0,
        subReseller: 0,
        srp: 0,
    });
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // Combine errors from brands hook and local state
    const displayError = error || brandsError;
    const isLoading = loading || brandsLoading;

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

        // Model Number validation
        if (!form.modelNo.trim()) {
            errors.modelNo = 'Model number is required';
            isValid = false;
        } else if (form.modelNo.length > MAX_MODEL_NO_LENGTH) {
            errors.modelNo = 'Model No. exceeds the character limit';
            isValid = false;
        } else if (!MODEL_NO_REGEX.test(form.modelNo)) {
            errors.modelNo = 'Invalid characters in model number';
            isValid = false;
        }

        if (!form.type) {
            errors.type = 'Type is required';
            isValid = false;
        }

        if (!form.category) {
            errors.category = 'Category is required';
            isValid = false;
        }

        if (!form.brand) {
            errors.brand = 'Brand is required';
            isValid = false;
        }

        // Quantity is always 0 for new items - quantities are managed through batches
        // No validation needed as it's a fixed value

        // Threshold Value validation
        if (form.thresholdValue === undefined || form.thresholdValue === null || isNaN(form.thresholdValue)) {
            errors.thresholdValue = 'Threshold value is required';
            isValid = false;
        } else if (form.thresholdValue < 0) {
            errors.thresholdValue = 'Threshold value cannot be negative';
            isValid = false;
        } else if (form.thresholdValue > MAX_INTEGER_VALUE) {
            errors.thresholdValue = 'Value should be less than or equal to 32767';
            isValid = false;
        } else if (!Number.isInteger(form.thresholdValue)) {
            errors.thresholdValue = 'Decimal values are not allowed';
            isValid = false;
        } else if (form.thresholdValue === 0 && form.type !== 'Finished Goods') {
            errors.thresholdValue = 'Threshold value must be greater than zero';
            isValid = false;
        }

        // Pricing validation
        const pricingFields = ['regionalDistributor', 'provincialDistributor', 'districtDistributor', 'cityDistributor', 'reseller', 'subReseller', 'srp'] as const;
        for (const field of pricingFields) {
            if (form[field] < 0) {
                errors[field] = 'Price cannot be negative';
                isValid = false;
            }
        }

        // Validate pricing hierarchy (each tier should be >= the next tier)
        const prices = [
            { name: 'Regional Distributor', value: form.regionalDistributor, field: 'regionalDistributor' as keyof FormErrors },
            { name: 'Provincial Distributor', value: form.provincialDistributor, field: 'provincialDistributor' as keyof FormErrors },
            { name: 'District Distributor', value: form.districtDistributor, field: 'districtDistributor' as keyof FormErrors },
            { name: 'City Distributor', value: form.cityDistributor, field: 'cityDistributor' as keyof FormErrors },
            { name: 'Reseller', value: form.reseller, field: 'reseller' as keyof FormErrors },
            { name: 'Sub-Reseller', value: form.subReseller, field: 'subReseller' as keyof FormErrors },
            { name: 'SRP', value: form.srp, field: 'srp' as keyof FormErrors },
        ];

        for (let i = 0; i < prices.length - 1; i++) {
            if (prices[i].value > 0 && prices[i + 1].value > 0 && prices[i].value < prices[i + 1].value) {
                errors.pricingHierarchy = `${prices[i].name} price should be greater than or equal to ${prices[i + 1].name} price`;
                isValid = false;
                break;
            }
        }

        setFormErrors(errors);
        return isValid;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setFormErrors({});

        if (!validateForm()) {
            setError('Please fill in all required fields correctly');
            return;
        }

        // Additional validation for NaN values
        if (isNaN(form.thresholdValue)) {
            setError('Please enter valid number for threshold value');
            return;
        }

        setLoading(true);

        try {
            // Find the selected brand to get its name
            const selectedBrand = brands.find(b => b.brand_id === Number(form.brand));
            const itemData: Omit<Item, "item_id"> = {
                item_name: form.itemName.trim(),
                model_number: form.modelNo.trim(),
                item_type: form.type as ItemType,
                category: form.category as ItemCategory,
                quantity: 0, // Always 0 for new items - quantities managed through batches
                threshold_value: form.thresholdValue,
                brand: Number(form.brand),
                brand_name: selectedBrand?.brand_name || '',
                brand_id: form.brand,
                availability_status: 'Out of Stock' // New items start as out of stock until batches are added
            };
            
            const itemResponse = await itemsApi.create(itemData);
            if (itemResponse.status === 'success' && itemResponse.data) {
                // Create pricing for the newly created item
                const pricingData = {
                    item: itemResponse.data.item_id,
                    regional_distributor: form.regionalDistributor,
                    provincial_distributor: form.provincialDistributor,
                    district_distributor: form.districtDistributor,
                    city_distributor: form.cityDistributor,
                    reseller: form.reseller,
                    sub_reseller: form.subReseller,
                    srp: form.srp,
                    is_active: true
                };

                const pricingResponse = await itemsApi.createPricing(pricingData);
                if (pricingResponse.status === 'success') {
                    navigate('/inventory');
                } else {
                    setError('Item created but failed to set pricing. You can set pricing later.');
                    setTimeout(() => navigate('/inventory'), 2000);
                }
            } else if (itemResponse.message && itemResponse.message.includes('Item already exists')) {
                setFormErrors(prev => ({
                    ...prev,
                    itemName: 'Item already exists',
                    modelNo: 'Item already exists',
                    brand: 'Item already exists'
                }));
                setError('An item with the same name, model number, and brand already exists.');
            } else {
                setError(itemResponse.message || 'Failed to create item');
            }
        } catch (error) {
            console.error('Error creating item:', error);
            setError('An unexpected error occurred while creating the item');
        }
        setLoading(false);
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

    return (
        <div className="flex flex-col lg:flex-row min-h-screen overflow-hidden">
            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <div className="flex-1 bg-[#F9F9F9] overflow-y-auto lg:ml-64">
                {/* Go back button */}
                <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 p-8 text-sm text-[#646464] hover:text-[#3d3d3d] cursor-pointer transition-all duration-100 ease-out"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Go back
                </button>

                {/* Form */}
                <div className="max-w-2xl mx-auto pb-8">
                    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border-[1.5px] border-[#EBEAEA] p-8 space-y-8">
                        <h1 className="text-xl font-medium text-[#2C2C2C] mb-8">Add Inventory Item</h1>

                        {displayError && (
                            <div className="bg-red-50 border-l-4 border-[#D3465C] p-4 mb-6">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="h-5 w-5 text-[#D3465C]" />
                                    <p className="text-[#D3465C]">{displayError}</p>
                                </div>
                            </div>
                        )}

                        {/* Item Name */}
                        <div>
                            <label className="block text-sm mb-2 text-[#2C2C2C]">
                                Item Name <span className="text-[#2C2C2C]/50">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Item name..."
                                maxLength={MAX_ITEM_NAME_LENGTH}
                                className={`w-full p-2.5 border-[1.5px] ${formErrors.itemName ? 'border-[#D3465C]' : 'border-[#D5D7DA]'} rounded-lg placeholder-black/40`}
                                value={form.itemName}
                                onChange={e => {
                                    const value = e.target.value;
                                    setForm({ ...form, itemName: value });
                                    if (!value.trim()) {
                                        setFormErrors(prev => ({ ...prev, itemName: 'Item name is required' }));
                                    } else if (value.length > MAX_ITEM_NAME_LENGTH) {
                                        setFormErrors(prev => ({ ...prev, itemName: 'Item name exceeds the character limit' }));
                                    } else if (!ITEM_NAME_REGEX.test(value)) {
                                        setFormErrors(prev => ({ ...prev, itemName: 'Invalid characters in item name' }));
                                    } else {
                                        setFormErrors(prev => ({ ...prev, itemName: undefined }));
                                    }
                                }}
                            />
                            {renderFieldError('itemName')}
                        </div>

                        {/* Model No. */}
                        <div>
                            <label className="block text-sm mb-2 text-[#2C2C2C]">
                                Model No. <span className="text-[#2C2C2C]/50">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Model number..."
                                maxLength={MAX_MODEL_NO_LENGTH}
                                className={`w-full p-2.5 border-[1.5px] ${formErrors.modelNo ? 'border-[#D3465C]' : 'border-[#D5D7DA]'} rounded-lg placeholder-black/40`}
                                value={form.modelNo}
                                onChange={e => {
                                    const value = e.target.value;
                                    setForm({ ...form, modelNo: value });
                                    if (!value.trim()) {
                                        setFormErrors(prev => ({ ...prev, modelNo: 'Model number is required' }));
                                    } else if (value.length > MAX_MODEL_NO_LENGTH) {
                                        setFormErrors(prev => ({ ...prev, modelNo: 'Model No. exceeds the character limit' }));
                                    } else if (!MODEL_NO_REGEX.test(value)) {
                                        setFormErrors(prev => ({ ...prev, modelNo: 'Invalid characters in model number' }));
                                    } else {
                                        setFormErrors(prev => ({ ...prev, modelNo: undefined }));
                                    }
                                }}
                            />
                            {renderFieldError('modelNo')}
                        </div>

                        {/* Type and Category */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm mb-2 text-[#2C2C2C]">
                                    Type <span className="text-[#2C2C2C]/50">*</span>
                                </label>
                                <Dropdown
                                    options={ITEM_TYPES.map(type => ({
                                        value: type,
                                        label: type
                                    }))}
                                    value={form.type}
                                    onChange={(value) => {
                                        setForm({ ...form, type: value });
                                        setFormErrors(prev => ({ ...prev, type: value ? undefined : 'Type is required' }));
                                    }}
                                    placeholder="Select..."
                                    error={!!formErrors.type}
                                />
                                {renderFieldError('type')}
                            </div>
                            <div>
                                <label className="block text-sm mb-2 text-[#2C2C2C]">
                                    Category <span className="text-[#2C2C2C]/50">*</span>
                                </label>
                                <Dropdown
                                    options={ITEM_CATEGORIES.map(category => ({
                                        value: category,
                                        label: category
                                    }))}
                                    value={form.category}
                                    onChange={(value) => {
                                        setForm({ ...form, category: value });
                                        setFormErrors(prev => ({ ...prev, category: value ? undefined : 'Category is required' }));
                                    }}
                                    placeholder="Select..."
                                    error={!!formErrors.category}
                                />
                                {renderFieldError('category')}
                            </div>
                        </div>

                        {/* Quantity and Threshold */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm mb-2 text-[#2C2C2C]">
                                    Quantity <span className="text-[#646464]"></span>
                                </label>
                                <input
                                    type="number"
                                    value="0"
                                    disabled
                                    className="w-full p-2.5 border-[1.5px] border-[#D5D7DA] rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                                    readOnly
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-2 text-[#2C2C2C]">
                                    Threshold Value <span className="text-[#2C2C2C]/50">*</span>
                                </label>
                                <input
                                    type="number"
                                    placeholder="Enter threshold value"
                                    min="0"
                                    max={MAX_INTEGER_VALUE}
                                    className={`w-full p-2.5 border-[1.5px] ${formErrors.thresholdValue ? 'border-[#D3465C]' : 'border-[#D5D7DA]'} rounded-lg placeholder-black/40 ${isNaN(form.thresholdValue) ? 'text-black/40' : 'text-[#2C2C2C]'}`}
                                    value={isNaN(form.thresholdValue) ? '' : form.thresholdValue}
                                    onChange={e => {
                                        let val = e.target.value === '' ? NaN : Number(e.target.value);
                                        if (isNaN(val)) {
                                            setFormErrors(prev => ({ ...prev, thresholdValue: 'Threshold value is required' }));
                                        } else if (val < 0) {
                                            setFormErrors(prev => ({ ...prev, thresholdValue: 'Threshold value cannot be negative' }));
                                        } else if (!Number.isInteger(val)) {
                                            setFormErrors(prev => ({ ...prev, thresholdValue: 'Decimal values are not allowed' }));
                                        } else if (val > MAX_INTEGER_VALUE) {
                                            setFormErrors(prev => ({ ...prev, thresholdValue: 'Value should be less than or equal to 32767' }));
                                        } else if (val === 0 && form.type !== 'Finished Goods') {
                                            setFormErrors(prev => ({ ...prev, thresholdValue: 'Threshold value must be greater than zero' }));
                                        } else {
                                            setFormErrors(prev => ({ ...prev, thresholdValue: undefined }));
                                        }
                                        setForm({ ...form, thresholdValue: val });
                                    }}
                                />
                                {renderFieldError('thresholdValue')}
                            </div>
                        </div>

                        {/* Brand */}
                        <div>
                            <label className="block text-sm mb-2 text-[#2C2C2C]">
                                Brand <span className="text-[#2C2C2C]/50">*</span>
                            </label>
                            <SearchableDropdown
                                options={brands.map(brand => ({
                                    value: brand.brand_id,
                                    label: brand.brand_name,
                                    modelNumber: brand.contact_person || undefined
                                }))}
                                value={Number(form.brand) || 0}
                                onChange={(value) => {
                                    setForm({ ...form, brand: value.toString() });
                                    setFormErrors(prev => ({ ...prev, brand: value ? undefined : 'Brand is required' }));
                                }}
                                placeholder="Select a brand"
                                searchPlaceholder="Search for brand name..."
                                error={!!formErrors.brand}
                                noResultsText="No brands found"
                            />
                            {renderFieldError('brand')}
                        </div>

                        {/* Pricing Section */}
                        <div className="border-t border-gray-200 pt-6">
                            <h3 className="text-lg font-medium text-[#2C2C2C] mb-4">Pricing Tiers</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm mb-2 text-[#2C2C2C]">
                                        Regional Distributor (RD)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0.00"
                                        className={`w-full p-2.5 border-[1.5px] ${formErrors.regionalDistributor ? 'border-[#D3465C]' : 'border-[#D5D7DA]'} rounded-lg placeholder-black/40`}
                                        value={form.regionalDistributor || ''}
                                        onChange={e => {
                                            const value = parseFloat(e.target.value) || 0;
                                            setForm({ ...form, regionalDistributor: value });
                                            setFormErrors(prev => ({ ...prev, regionalDistributor: value < 0 ? 'Price cannot be negative' : undefined, pricingHierarchy: undefined }));
                                        }}
                                    />
                                    {renderFieldError('regionalDistributor')}
                                </div>

                                <div>
                                    <label className="block text-sm mb-2 text-[#2C2C2C]">
                                        Provincial Distributor (PD)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0.00"
                                        className={`w-full p-2.5 border-[1.5px] ${formErrors.provincialDistributor ? 'border-[#D3465C]' : 'border-[#D5D7DA]'} rounded-lg placeholder-black/40`}
                                        value={form.provincialDistributor || ''}
                                        onChange={e => {
                                            const value = parseFloat(e.target.value) || 0;
                                            setForm({ ...form, provincialDistributor: value });
                                            setFormErrors(prev => ({ ...prev, provincialDistributor: value < 0 ? 'Price cannot be negative' : undefined, pricingHierarchy: undefined }));
                                        }}
                                    />
                                    {renderFieldError('provincialDistributor')}
                                </div>

                                <div>
                                    <label className="block text-sm mb-2 text-[#2C2C2C]">
                                        District Distributor (DD)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0.00"
                                        className={`w-full p-2.5 border-[1.5px] ${formErrors.districtDistributor ? 'border-[#D3465C]' : 'border-[#D5D7DA]'} rounded-lg placeholder-black/40`}
                                        value={form.districtDistributor || ''}
                                        onChange={e => {
                                            const value = parseFloat(e.target.value) || 0;
                                            setForm({ ...form, districtDistributor: value });
                                            setFormErrors(prev => ({ ...prev, districtDistributor: value < 0 ? 'Price cannot be negative' : undefined, pricingHierarchy: undefined }));
                                        }}
                                    />
                                    {renderFieldError('districtDistributor')}
                                </div>

                                <div>
                                    <label className="block text-sm mb-2 text-[#2C2C2C]">
                                        City Distributor (CD)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0.00"
                                        className={`w-full p-2.5 border-[1.5px] ${formErrors.cityDistributor ? 'border-[#D3465C]' : 'border-[#D5D7DA]'} rounded-lg placeholder-black/40`}
                                        value={form.cityDistributor || ''}
                                        onChange={e => {
                                            const value = parseFloat(e.target.value) || 0;
                                            setForm({ ...form, cityDistributor: value });
                                            setFormErrors(prev => ({ ...prev, cityDistributor: value < 0 ? 'Price cannot be negative' : undefined, pricingHierarchy: undefined }));
                                        }}
                                    />
                                    {renderFieldError('cityDistributor')}
                                </div>

                                <div>
                                    <label className="block text-sm mb-2 text-[#2C2C2C]">
                                        Reseller (RS)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0.00"
                                        className={`w-full p-2.5 border-[1.5px] ${formErrors.reseller ? 'border-[#D3465C]' : 'border-[#D5D7DA]'} rounded-lg placeholder-black/40`}
                                        value={form.reseller || ''}
                                        onChange={e => {
                                            const value = parseFloat(e.target.value) || 0;
                                            setForm({ ...form, reseller: value });
                                            setFormErrors(prev => ({ ...prev, reseller: value < 0 ? 'Price cannot be negative' : undefined, pricingHierarchy: undefined }));
                                        }}
                                    />
                                    {renderFieldError('reseller')}
                                </div>

                                <div>
                                    <label className="block text-sm mb-2 text-[#2C2C2C]">
                                        Sub-Reseller (Sub-RS)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0.00"
                                        className={`w-full p-2.5 border-[1.5px] ${formErrors.subReseller ? 'border-[#D3465C]' : 'border-[#D5D7DA]'} rounded-lg placeholder-black/40`}
                                        value={form.subReseller || ''}
                                        onChange={e => {
                                            const value = parseFloat(e.target.value) || 0;
                                            setForm({ ...form, subReseller: value });
                                            setFormErrors(prev => ({ ...prev, subReseller: value < 0 ? 'Price cannot be negative' : undefined, pricingHierarchy: undefined }));
                                        }}
                                    />
                                    {renderFieldError('subReseller')}
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm mb-2 text-[#2C2C2C]">
                                        Suggested Retail Price (SRP)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        placeholder="0.00"
                                        className={`w-full p-2.5 border-[1.5px] ${formErrors.srp ? 'border-[#D3465C]' : 'border-[#D5D7DA]'} rounded-lg placeholder-black/40`}
                                        value={form.srp || ''}
                                        onChange={e => {
                                            const value = parseFloat(e.target.value) || 0;
                                            setForm({ ...form, srp: value });
                                            setFormErrors(prev => ({ ...prev, srp: value < 0 ? 'Price cannot be negative' : undefined, pricingHierarchy: undefined }));
                                        }}
                                    />
                                    {renderFieldError('srp')}
                                </div>
                            </div>
                            {formErrors.pricingHierarchy && (
                                <div className="mt-2 text-[#D3465C] text-sm">
                                    {formErrors.pricingHierarchy}
                                </div>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading || Object.values(formErrors).some(Boolean)}
                            className="cursor-pointer w-full border-[1.5px] text-white bg-[#0504AA] border-[#0504AA] rounded-lg hover:bg-[#0504AA]/90 active:scale-95 duration-50 transition-all ease-out py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? 'Loading...' : 'Add Inventory Item'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}