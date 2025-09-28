import { useState, useEffect, useCallback } from "react";
import { itemsApi, transactionsApi, pricingApi, batchApi } from "../../lib/api";
import {
  Item,
  TransactionCreate,
  PricingTierOption,
  UserTierRestrictions,
} from "../../types/inventory";
import { AlertCircle, Trash2, X } from "lucide-react";
import SearchableDropdown from "../../components/common/SearchableDropdown";
import Dropdown from "../../components/common/Dropdown";
import { useAuthContext } from "../../context/AuthContext";
import { isSales, isWarehouseStaff } from "../../utils/permissions";
import { useBrands } from "../../hooks/useBrands";

type TransactionType =
  | "Receive Products (from Brands)"
  | "Sell Products (to Customers)";

interface TransactionItem {
  item: number;
  quantity_change: number;
  item_name?: string;
  error?: string;
  // Fields for receive transactions (batch creation)
  batch_number?: string;
  cost_price?: number;
  expiry_date?: string;
  // Validation error for batch number
  batch_error?: string;
  // Fields for outgoing transactions (batch selection and pricing)
  batch_id?: number;
  available_batches?: Array<{
    batch_id: number;
    batch_number: number;
    remaining_quantity: number;
    cost_price: number;
  }>;
  selected_batch?: {
    batch_id: number;
    batch_number: number;
    remaining_quantity: number;
    cost_price: number;
  };
  // Pricing tier fields
  pricing_tier?: string;
  unit_price?: number;
  total_price?: number;
}

// Add constant for max value
const MAX_QUANTITY = 32767; // SmallIntegerField max value

interface FormErrors {
  brandName?: string;
  customerName?: string;
}

interface AddTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AddTransactionModal({
  isOpen,
  onClose,
  onSuccess,
}: AddTransactionModalProps) {
  const { user } = useAuthContext();
  const { brands, loading: brandsLoading } = useBrands();

  const [items, setItems] = useState<Item[]>([]);
  const [filteredItems, setFilteredItems] = useState<Item[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [transactionType, setTransactionType] = useState<TransactionType>(
    "Receive Products (from Brands)",
  );
  const [dueDate, setDueDate] = useState<string>("");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [previewReferenceNumber, setPreviewReferenceNumber] =
    useState<string>("");
  const [selectedItems, setSelectedItems] = useState<TransactionItem[]>([
    {
      item: 0,
      quantity_change: 1,
      error: undefined,
      batch_number: undefined,
      cost_price: undefined,
      expiry_date: undefined,
    },
  ]);
  const [customerName, setCustomerName] = useState<string>("");
  const [brandName, setBrandName] = useState<number | null>(null);
  const [notes, setNotes] = useState<string>("");
  const [entityType, setEntityType] = useState<"Customer" | "Brand">("Brand");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [userTierRestrictions, setUserTierRestrictions] =
    useState<UserTierRestrictions | null>(null);
  const [allPricingTiers, setAllPricingTiers] = useState<PricingTierOption[]>(
    [],
  );

  // Helper function to determine if selected transaction type is stock out
  const isStockOut = useCallback((type: TransactionType): boolean => {
    return ["Sell Products (to Customers)"].includes(type);
  }, []); // Generate preview reference number
  const generatePreviewReferenceNumber = useCallback(() => {
    const currentYear = new Date().getFullYear();
    return `${currentYear}-XXXX`;
  }, []);

  useEffect(() => {
    // Generate preview reference number when component mounts
    setPreviewReferenceNumber(generatePreviewReferenceNumber());
  }, [generatePreviewReferenceNumber]);

  // Load user tier restrictions and all pricing tiers
  useEffect(() => {
    const loadPricingData = async () => {
      try {
        // Get user's allowed selling tiers
        const userTiersResponse = await pricingApi.getUserAllowedTiers();
        if (userTiersResponse.status === "success") {
          setUserTierRestrictions(userTiersResponse.data);
        }

        // Get all available pricing tiers
        const allTiersResponse = await pricingApi.getAllTiers();
        if (
          allTiersResponse.status === "success" &&
          allTiersResponse.data.pricing_tiers
        ) {
          setAllPricingTiers(allTiersResponse.data.pricing_tiers);
        }
      } catch (error) {
        console.error("Error loading pricing data:", error);
      }
    };

    loadPricingData();
  }, []);
  const generateBatchNumber = useCallback(
    async (itemId: number): Promise<string> => {
      if (!itemId || itemId === 0) {
        return "B-001"; // Default for no item selected
      }

      try {
        const response = await itemsApi.getNextBatchNumber(itemId);
        if (response.status === "success" && response.data) {
          return response.data.next_batch_number;
        }
      } catch (error) {
        console.error("Error fetching next batch number:", error);
      }

      // Fallback to simple increment logic if API fails
      const itemsToCheck = selectedItems.filter((item) => item.item === itemId);
      const existingBatches = itemsToCheck.filter(
        (item) =>
          item.batch_number && String(item.batch_number).startsWith("B-"),
      );

      let maxSequence = 0;
      existingBatches.forEach((item) => {
        if (item.batch_number) {
          const sequenceMatch = String(item.batch_number).match(/B-(\d{3})$/);
          if (sequenceMatch) {
            const sequenceNum = parseInt(sequenceMatch[1], 10);
            maxSequence = Math.max(maxSequence, sequenceNum);
          }
        }
      });

      const nextSequence = (maxSequence + 1).toString().padStart(3, "0");
      return `B-${nextSequence}`;
    },
    [selectedItems],
  );
  // Function to validate batch number for a specific item
  const validateBatchNumber = useCallback(
    async (
      itemId: number,
      batchNumber: string,
      currentIndex: number,
    ): Promise<{ valid: boolean; message: string }> => {
      if (!itemId || itemId === 0) {
        return { valid: false, message: "Please select an item first" };
      }

      if (!batchNumber || !batchNumber.trim()) {
        return { valid: false, message: "Batch number is required" };
      }

      // Check format
      if (!/^B-\d{3}$/.test(batchNumber)) {
        return {
          valid: false,
          message: "Batch number must be in format B-XXX (e.g., B-001)",
        };
      }

      // Check against other items in current form (excluding the current item being edited)
      const duplicateInForm = selectedItems.some(
        (item, index) =>
          index !== currentIndex && // Exclude the current item being edited
          item.item === itemId &&
          item.batch_number === batchNumber,
      );

      if (duplicateInForm) {
        return {
          valid: false,
          message:
            "This batch number is already used in the current transaction",
        };
      }

      try {
        const response = await itemsApi.validateBatchNumber(
          itemId,
          batchNumber,
        );
        if (response.status === "success" && response.data) {
          return {
            valid: response.data.valid,
            message: response.data.message,
          };
        }
      } catch (error) {
        console.error("Error validating batch number:", error);
        return { valid: false, message: "Error validating batch number" };
      }

      return { valid: true, message: "Batch number is available" };
    },
    [selectedItems],
  );

  // Only allow Sales to add 'Sell Products (to Customers)' transactions
  let transactionTypeOptions;
  if (isSales(user)) {
    transactionTypeOptions = [
      {
        value: "Sell Products (to Customers)",
        label: "Sell Products (to Customers)",
      },
    ];
  } else if (isWarehouseStaff(user)) {
    transactionTypeOptions = [
      {
        value: "Receive Products (from Brands)",
        label: "Receive Products (from Brands)",
      },
      {
        value: "Sell Products (to Customers)",
        label: "Sell Products (to Customers)",
      },
    ];
  } else {
    transactionTypeOptions = [
      {
        value: "Receive Products (from Brands)",
        label: "Receive Products (from Brands)",
      },
      {
        value: "Sell Products (to Customers)",
        label: "Sell Products (to Customers)",
      },
    ];
  }
  useEffect(() => {
    if (
      user &&
      isSales(user) &&
      transactionType !== "Sell Products (to Customers)"
    ) {
      setTransactionType("Sell Products (to Customers)");
    }
  }, [user, transactionType]);

  useEffect(() => {
    // Set due date to 3 weeks from now by default (only for sell transactions)
    if (transactionType === "Sell Products (to Customers)") {
      const threWeeksFromNow = new Date();
      threWeeksFromNow.setDate(threWeeksFromNow.getDate() + 21);
      setDueDate(threWeeksFromNow.toISOString().split("T")[0]);
    } else {
      setDueDate(""); // Clear due date for receive transactions
    }

    // Fetch items only - brands come from the hook
    const fetchItems = async () => {
      setIsLoadingItems(true);
      try {
        const params = new URLSearchParams({
          all: "true",
          ordering: "item_name",
        });

        const response = await itemsApi.getAll(params);

        if (response.status === "success" && response.data) {
          let itemsData: Item[] = [];

          if (typeof response.data === "object" && "results" in response.data) {
            const paginatedData = response.data as { results: Item[] };
            itemsData = paginatedData.results;
          } else if (Array.isArray(response.data)) {
            itemsData = response.data;
          }

          setItems(itemsData);
          setFilteredItems(itemsData); // Initially show all items
        } else {
          setError("Failed to load items");
        }
      } catch (error) {
        console.error("Error fetching items:", error);
        setError("Failed to load items");
      } finally {
        setIsLoadingItems(false);
      }
    };

    if (isOpen) {
      fetchItems();
    }
  }, [transactionType, isOpen]); // Auto-set entity type based on transaction type
  useEffect(() => {
    if (transactionType === "Receive Products (from Brands)") {
      setEntityType("Brand");
    } else if (transactionType === "Sell Products (to Customers)") {
      setEntityType("Customer");
    }
  }, [transactionType]);

  useEffect(() => {
    // Reset entity values and errors when entity type changes
    if (entityType === "Customer") {
      setBrandName(null);
      setFormErrors((prev) => ({ ...prev, brandName: undefined }));
    } else {
      setCustomerName("");
      setFormErrors((prev) => ({ ...prev, customerName: undefined }));
    }
  }, [entityType]);
  // Brand-based item filtering
  useEffect(() => {
    if (brandName && items.length > 0) {
      // Filter items by selected brand
      const itemsForBrand = items.filter((item) => item.brand === brandName);
      setFilteredItems(itemsForBrand);
    } else {
      // Show all items if no brand selected
      setFilteredItems(items);
    }
    // Reset loading state for items when filtering is complete
    setIsLoadingItems(false);
  }, [brandName, items]); // Reset quantity values when transaction type changes
  useEffect(() => {
    const updatedItems = selectedItems.map((item) => ({
      ...item,
      quantity_change: Math.abs(item.quantity_change),
    }));

    setSelectedItems(updatedItems);
  }, [transactionType]); // Initialize batch numbers for receive transactions
  useEffect(() => {
    const initializeBatchNumbers = async () => {
      if (transactionType === "Receive Products (from Brands)") {
        setSelectedItems((prevItems) => {
          const updateItems = async () => {
            const updatedItems = [];
            for (const item of prevItems) {
              if (!item.batch_number && item.item !== 0) {
                const batchNumber = await generateBatchNumber(item.item);
                updatedItems.push({
                  ...item,
                  batch_number: batchNumber,
                });
              } else if (!item.batch_number) {
                updatedItems.push({
                  ...item,
                  batch_number: undefined,
                });
              } else {
                updatedItems.push(item);
              }
            }
            setSelectedItems(updatedItems);
          };
          updateItems();
          return prevItems; // Return original items to avoid setting twice
        });
      } else {
        // Clear batch data for non-receive transactions
        setSelectedItems((prevItems) => {
          return prevItems.map((item) => ({
            ...item,
            batch_number: undefined,
            cost_price: undefined,
            expiry_date: undefined,
          }));
        });
      }
    };

    initializeBatchNumbers();
  }, [transactionType]);

  // Don't render anything if modal is not open
  if (!isOpen) return null;

  const handleItemChange = (index: number, itemId: number) => {
    // Check if this item is already selected in another row
    if (
      itemId !== 0 &&
      selectedItems.some((item, i) => i !== index && item.item === itemId)
    ) {
      setError(
        "This item is already selected. Please choose a different item.",
      );
      return;
    }

    const selectedItem = items.find((item) => item.item_id === itemId);
    if (selectedItem) {
      // If no brand is selected yet, auto-populate it from the selected item
      if (!brandName && entityType === "Brand") {
        setBrandName(selectedItem.brand);
      }
      // If a brand is already selected, check if the item belongs to the same brand
      else if (
        brandName &&
        entityType === "Brand" &&
        selectedItem.brand !== brandName
      ) {
        setError(
          "All items must belong to the same brand. Please select an item from the same brand or change the brand selection.",
        );
        return;
      }
    }

    const newItems = [...selectedItems];
    newItems[index].item = itemId;

    // Set item_name for display purposes
    if (selectedItem) {
      newItems[index].item_name = selectedItem.item_name;
    } // Auto-generate batch number for receive transactions when item is selected
    if (
      transactionType === "Receive Products (from Brands)" &&
      itemId !== 0 &&
      !newItems[index].batch_number
    ) {
      generateBatchNumber(itemId).then((batchNumber) => {
        const updatedItems = [...selectedItems];
        if (updatedItems[index] && updatedItems[index].item === itemId) {
          updatedItems[index].batch_number = batchNumber;
          // Clear any validation error since this is auto-generated
          delete updatedItems[index].batch_error;
          setSelectedItems(updatedItems);
        }
      });
    }

    // Fetch available batches for outgoing transactions when item is selected
    // When item selection changes, fetch available batches for sell transactions
    if (isStockOut(transactionType) && itemId !== 0) {
      console.log(`🔍 Fetching batches for item ${itemId}...`);

      batchApi
        .getByItemId(itemId, true)
        .then((response) => {
          console.log(`📦 Batch API response for item ${itemId}:`, response);

          if (response.status === "success") {
            const updatedItems = [...selectedItems];
            if (updatedItems[index] && updatedItems[index].item === itemId) {
              // Handle different response formats
              let batchData = [];
              if (response.data) {
                // Check if it's paginated response
                if (response.data.results) {
                  batchData = response.data.results;
                } else if (Array.isArray(response.data)) {
                  batchData = response.data;
                } else {
                  console.warn(
                    "⚠️ Unexpected batch data format:",
                    response.data,
                  );
                }
              }

              console.log(
                `📊 Found ${batchData.length} batches for item ${itemId}`,
              );
              updatedItems[index].available_batches = batchData;

              // Auto-select the first batch if available
              if (batchData && batchData.length > 0) {
                updatedItems[index].selected_batch = batchData[0];
                updatedItems[index].batch_id =
                  batchData[0].batch_id || batchData[0].id;
                console.log(`✅ Auto-selected batch:`, batchData[0]);
              } else {
                console.log(`ℹ️ No batches available for item ${itemId}`);
                updatedItems[index].selected_batch = undefined;
                updatedItems[index].batch_id = undefined;
              }
              setSelectedItems(updatedItems);
            }
          } else {
            console.error(
              `❌ Batch API error for item ${itemId}:`,
              response.message,
            );
            setError(`Failed to load batches: ${response.message}`);
          }
        })
        .catch((error) => {
          console.error(`🚨 Error fetching batches for item ${itemId}:`, error);
          setError("Failed to load available batches. Please try again.");
        });
    }

    // Set the items immediately (without waiting for batch number)
    setSelectedItems(newItems);
    setError(null); // Clear any previous errors
  };
  const handleQuantityChange = (index: number, value: string) => {
    const newItems = [...selectedItems];

    // Clear any existing error for this item
    newItems[index].error = undefined;

    // Handle empty value
    if (value === "") {
      newItems[index].quantity_change = 0;
      newItems[index].error = "Quantity is required";
      setSelectedItems(newItems);
      return;
    }

    // Convert to number and validate
    const numValue = Number(value);

    // Check if it's not a valid number
    if (isNaN(numValue)) {
      newItems[index].error = "Please enter a valid number";
      setSelectedItems(newItems);
      return;
    }

    // Check if it's zero or negative
    if (numValue <= 0) {
      newItems[index].error = "Quantity must be greater than 0";
      setSelectedItems(newItems);
      return;
    }

    // Check if it exceeds maximum value
    if (numValue > MAX_QUANTITY) {
      newItems[index].error = `Quantity cannot exceed ${MAX_QUANTITY}`;
      setSelectedItems(newItems);
      return;
    }

    // Check if it exceeds available batch quantity for outgoing transactions
    if (isStockOut(transactionType) && newItems[index].selected_batch) {
      if (numValue > newItems[index].selected_batch!.remaining_quantity) {
        newItems[index].error =
          `Quantity cannot exceed available batch quantity (${newItems[index].selected_batch!.remaining_quantity})`;
        setSelectedItems(newItems);
        return;
      }
    }

    // For "Receive Products", quantities are positive (stock in)
    // For "Sell Products", quantities are negative (stock out)
    const signedValue = isStockOut(transactionType)
      ? -Math.abs(numValue)
      : Math.abs(numValue);
    newItems[index].quantity_change = signedValue;

    setSelectedItems(newItems);
  };
  const handleAddItem = () => {
    if (selectedItems.length >= 10) {
      setError("Maximum 10 items allowed per transaction");
      return;
    }

    const newItem: TransactionItem = {
      item: 0,
      quantity_change: 1,
      error: undefined,
      batch_number: undefined,
      cost_price: undefined,
      expiry_date: undefined,
    }; // Pre-generate batch number for receive transactions
    if (transactionType === "Receive Products (from Brands)") {
      // We'll generate the batch number when an item is selected
      newItem.batch_number = undefined;
    }

    setSelectedItems([...selectedItems, newItem]);
  };
  const handleRemoveItem = (index: number) => {
    if (selectedItems.length === 1) return;
    const newItems = selectedItems.filter((_, i) => i !== index);
    setSelectedItems(newItems);
  };
  const handleBatchFieldChange = async (
    index: number,
    field: "batch_number" | "cost_price" | "expiry_date",
    value: string,
  ) => {
    const newItems = [...selectedItems];

    if (field === "cost_price") {
      // Convert to number for cost_price
      const numValue = Number(value);
      if (value === "" || (!isNaN(numValue) && numValue >= 0)) {
        newItems[index][field] = numValue || undefined;
      }
    } else if (field === "batch_number") {
      newItems[index][field] = value || undefined;

      // Validate batch number if it's not empty and item is selected
      if (value && newItems[index].item && newItems[index].item !== 0) {
        const validation = await validateBatchNumber(
          newItems[index].item,
          value,
          index,
        );
        if (!validation.valid) {
          // Store validation error
          newItems[index].batch_error = validation.message;
        } else {
          // Clear validation error
          delete newItems[index].batch_error;
        }
      } else {
        // Clear validation error if batch number is empty
        delete newItems[index].batch_error;
      }
    } else {
      newItems[index][field] = value || undefined;
    }

    setSelectedItems(newItems);
  };

  const handlePricingTierChange = async (index: number, tier: string) => {
    const newItems = [...selectedItems];
    const item = newItems[index];

    if (!item || !customerName) {
      return;
    }

    // Check if user can sell at this tier
    if (
      userTierRestrictions &&
      !userTierRestrictions.allowed_selling_tiers.find((t) => t.value === tier)
    ) {
      setError(
        `You are not authorized to sell at ${tier} tier. Your cost tier is ${userTierRestrictions.user_cost_tier}`,
      );
      return;
    }

    item.pricing_tier = tier;

    // Calculate price based on selected tier
    try {
      const selectedItem = items.find((i) => i.item_id === item.item);
      if (selectedItem && selectedItem.tier_pricing) {
        const tierPrice = selectedItem.tier_pricing.find(
          (tp) => tp.pricing_tier === tier,
        );
        if (tierPrice) {
          item.unit_price = tierPrice.price;
          item.total_price = tierPrice.price * Math.abs(item.quantity_change);
        }
      } else {
        // Fallback: use a default pricing calculation
        // This would typically come from your pricing API
        const defaultPrices = {
          RD: 100,
          PD: 90,
          DD: 80,
          CD: 70,
          RS: 60,
          "SUB-RS": 50,
          SRP: 40,
        };
        const price = defaultPrices[tier as keyof typeof defaultPrices] || 40;
        item.unit_price = price;
        item.total_price = price * Math.abs(item.quantity_change);
      }
    } catch (error) {
      console.error("Error calculating price:", error);
    }

    setSelectedItems(newItems);
  };
  const validateForm = (): boolean => {
    let isValid = true;
    const errors: FormErrors = {};

    // Entity validation
    if (entityType === "Customer" && !customerName.trim()) {
      errors.customerName = "Customer name is required";
      isValid = false;
    }

    if (entityType === "Brand" && !brandName) {
      errors.brandName = "Brand selection is required";
      isValid = false;
    }

    // Item validation - check if we have at least one complete item
    const validItems = selectedItems.filter(
      (item) => item.item !== 0 && item.quantity_change !== 0 && !item.error,
    );

    if (validItems.length === 0) {
      setError("At least one valid item with quantity is required");
      isValid = false;
    }

    // Check for any item errors
    const hasItemErrors = selectedItems.some((item) => item.error);
    if (hasItemErrors) {
      setError("Please fix all item errors before submitting");
      isValid = false;
    } // Batch validation for receive transactions
    if (transactionType === "Receive Products (from Brands)") {
      const itemsWithoutBatchNumber = validItems.filter(
        (item) => !item.batch_number || !String(item.batch_number).trim(),
      );
      if (itemsWithoutBatchNumber.length > 0) {
        setError(
          "Batch number is required for all items when receiving products",
        );
        isValid = false;
      }

      const itemsWithoutCostPrice = validItems.filter(
        (item) => !item.cost_price || item.cost_price <= 0,
      );
      if (itemsWithoutCostPrice.length > 0) {
        setError(
          "Cost price is required for all items when receiving products",
        );
        isValid = false;
      }

      // Check for batch number validation errors
      const itemsWithBatchErrors = selectedItems.filter(
        (item) => item.batch_error,
      );
      if (itemsWithBatchErrors.length > 0) {
        setError("Please fix all batch number errors before submitting");
        isValid = false;
      }
    }

    // Validation for outgoing transactions
    if (isStockOut(transactionType)) {
      // Validate pricing tier selection for outgoing transactions
      const itemsWithoutPricingTier = validItems.filter(
        (item) => !item.pricing_tier,
      );
      if (itemsWithoutPricingTier.length > 0) {
        setError(
          "Pricing tier is required for all items when selling products",
        );
        isValid = false;
      }

      // Validate unit prices are calculated
      const itemsWithoutUnitPrice = validItems.filter(
        (item) => !item.unit_price || item.unit_price <= 0,
      );
      if (itemsWithoutUnitPrice.length > 0) {
        setError(
          "Unit price calculation failed for some items. Please check pricing tiers.",
        );
        isValid = false;
      }

      // Batch validation (only if batches are available)
      const itemsWithBatches = validItems.filter(
        (item) => item.available_batches && item.available_batches.length > 0,
      );
      const itemsWithoutBatch = itemsWithBatches.filter(
        (item) => !item.batch_id,
      );
      if (itemsWithoutBatch.length > 0) {
        setError(
          "Batch selection is required for items that have available batches",
        );
        isValid = false;
      }

      // Validate quantity doesn't exceed available batch quantity
      const itemsExceedingBatch = validItems.filter((item) => {
        if (
          item.selected_batch &&
          Math.abs(item.quantity_change) >
            item.selected_batch.remaining_quantity
        ) {
          return true;
        }
        return false;
      });

      if (itemsExceedingBatch.length > 0) {
        setError("Quantity cannot exceed available batch quantity");
        isValid = false;
      }
    }

    setFormErrors(errors);
    return isValid;
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // Filter out empty items and prepare transaction data
      const validItems = selectedItems
        .filter((item) => item.item !== 0 && item.quantity_change !== 0)
        .map((item) => {
          const baseItem = {
            item: item.item,
            quantity_change: item.quantity_change,
          };

          // Add batch data for receive transactions
          if (transactionType === "Receive Products (from Brands)") {
            return {
              ...baseItem,
              batch_number: item.batch_number,
              cost_price: item.cost_price,
              expiry_date: item.expiry_date || undefined,
            };
          }

          // Add pricing info for outgoing transactions (batch_id optional if no batches available)
          if (isStockOut(transactionType)) {
            const outgoingItem = {
              ...baseItem,
              ...(item.batch_id && { batch_id: item.batch_id }),
              pricing_tier: item.pricing_tier,
              unit_price: item.unit_price,
              total_price:
                item.total_price ||
                (item.unit_price || 0) * Math.abs(item.quantity_change),
            };
            console.log(`🔍 Outgoing item ${item.item} data:`, outgoingItem);
            return outgoingItem;
          }

          return baseItem;
        });

      if (validItems.length === 0) {
        setError("No valid items to submit");
        setIsLoading(false);
        return;
      }

      const transactionData: TransactionCreate = {
        transaction_type:
          transactionType === "Receive Products (from Brands)"
            ? "INCOMING"
            : "OUTGOING",
        transaction_status: "Pending",
        ...(referenceNumber.trim() && {
          reference_number: referenceNumber.trim(),
        }),
        due_date: dueDate || undefined,
        notes: notes || undefined,
        items: validItems,
        ...(entityType === "Customer"
          ? { customer_name: customerName.trim() }
          : { brand: brandName! }),
      };

      console.log("📤 Sending transaction data:", transactionData);
      console.log(
        "🔍 Transaction items breakdown:",
        validItems.map((item, i) => ({
          index: i,
          item_id: item.item,
          quantity: item.quantity_change,
          batch_id: item.batch_id,
          pricing_tier: item.pricing_tier,
          unit_price: item.unit_price,
        })),
      );

      const response = await transactionsApi.create(transactionData);

      if (response.status === "success") {
        // Call success callback and close modal
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      } else {
        setError(response.message || "Failed to create transaction");
      }
    } catch (error: any) {
      console.error("🚨 Transaction Creation Error:", error);
      console.error("📋 Transaction Data Sent:", transactionData);
      console.error("📊 Valid Items:", validItems);

      // Better error handling to show specific network/server errors
      let errorMessage = "An unexpected error occurred";

      if (error.code === "ECONNABORTED") {
        errorMessage =
          "Request timeout - please check your connection and try again";
      } else if (error.response) {
        // Server responded with error status
        const status = error.response.status;
        console.error(`❌ HTTP ${status} Error Response:`, error.response.data);

        if (status === 400) {
          // Parse 400 errors more specifically
          let detailMessage = "Invalid data submitted";

          if (error.response.data) {
            if (typeof error.response.data === "string") {
              detailMessage = error.response.data;
            } else if (error.response.data.detail) {
              detailMessage = error.response.data.detail;
            } else if (error.response.data.message) {
              detailMessage = error.response.data.message;
            } else if (error.response.data.non_field_errors) {
              detailMessage = error.response.data.non_field_errors.join(", ");
            } else {
              // Show field-specific errors
              const fieldErrors = [];
              for (const [field, errors] of Object.entries(
                error.response.data,
              )) {
                if (Array.isArray(errors)) {
                  fieldErrors.push(`${field}: ${errors.join(", ")}`);
                }
              }
              if (fieldErrors.length > 0) {
                detailMessage = fieldErrors.join(" | ");
              }
            }
          }

          errorMessage = `Bad Request (400): ${detailMessage}`;
        } else if (status === 401) {
          errorMessage = "Authentication required - please log in again";
        } else if (status === 403) {
          errorMessage =
            "Permission denied - you are not authorized to create transactions";
        } else if (status === 500) {
          errorMessage = "Server error - please try again later";
        } else {
          errorMessage = `Server error (${status}): ${error.response.data?.detail || error.message}`;
        }
      } else if (error.request) {
        // Request was made but no response received
        errorMessage =
          "Cannot connect to server - please check if the backend is running";
      } else {
        errorMessage = error.message || "Unknown error occurred";
      }

      console.error("🎯 Final Error Message:", errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h1 className="text-2xl font-bold text-[#2C2C2C]">
              Add Transaction
            </h1>
            <p className="text-[#646464] mt-1">
              Record a new inventory transaction
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6">
          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Transaction Type */}
            <div>
              <label className="block text-sm mb-2 text-[#2C2C2C]">
                Transaction Type <span className="text-[#2C2C2C]/50">*</span>
              </label>
              <Dropdown
                options={transactionTypeOptions}
                value={transactionType}
                onChange={(value) =>
                  setTransactionType(value as TransactionType)
                }
                placeholder="Select transaction type"
              />
            </div>

            {/* Reference Number */}
            <div>
              <label className="block text-sm mb-2 text-[#2C2C2C]">
                Reference Number
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full p-2.5 border-[1.5px] border-[#D5D7DA] rounded-lg"
                placeholder={`Auto-generated: ${previewReferenceNumber}`}
              />
              {!referenceNumber.trim() && (
                <p className="text-xs text-gray-500 mt-1">
                  Preview: {previewReferenceNumber}
                </p>
              )}
            </div>

            {/* Entity Selection */}
            <div>
              <label className="block text-sm mb-3 text-[#2C2C2C]">
                Entity Type <span className="text-[#2C2C2C]/50">*</span>
              </label>
              <div className="flex">
                <button
                  type="button"
                  onClick={() => setEntityType("Customer")}
                  disabled={
                    transactionType === "Receive Products (from Brands)"
                  }
                  className={`py-2.5 px-4 text-sm font-medium rounded-l-lg border-[1.5px] transition-all ${
                    entityType === "Customer"
                      ? "bg-[#0504AA]/10 border-[#0504AA] text-[#0504AA]"
                      : transactionType === "Receive Products (from Brands)"
                        ? "bg-gray-100 border-[#D5D7DA] text-gray-400 cursor-not-allowed"
                        : "bg-white border-[#D5D7DA] text-[#2C2C2C]"
                  }`}
                >
                  Customer
                </button>
                <button
                  type="button"
                  onClick={() => setEntityType("Brand")}
                  disabled={transactionType === "Sell Products (to Customers)"}
                  className={`py-2.5 px-4 text-sm font-medium rounded-r-lg border-[1.5px] transition-all ${
                    entityType === "Brand"
                      ? "bg-[#0504AA]/10 border-[#0504AA] text-[#0504AA]"
                      : transactionType === "Sell Products (to Customers)"
                        ? "bg-gray-100 border-[#D5D7DA] text-gray-400 cursor-not-allowed"
                        : "bg-white border-[#D5D7DA] text-[#2C2C2C]"
                  }`}
                >
                  Brand
                </button>
              </div>

              {entityType === "Customer" ? (
                <div className="mt-3">
                  <label className="block text-sm mb-2 text-[#2C2C2C]">
                    Customer <span className="text-[#2C2C2C]/50">*</span>
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full p-2.5 border-[1.5px] border-[#D5D7DA] rounded-lg"
                    placeholder="Enter customer name"
                  />
                </div>
              ) : (
                <div className="mt-3">
                  <label className="block text-sm mb-2 text-[#2C2C2C]">
                    Brand <span className="text-[#2C2C2C]/50">*</span>
                  </label>{" "}
                  <SearchableDropdown
                    options={brands.map((brand) => ({
                      value: brand.brand_id,
                      label: brand.brand_name,
                      modelNumber: brand.contact_person || undefined,
                    }))}
                    value={brandName || 0}
                    onChange={(value) => setBrandName(value)}
                    placeholder="Select a brand"
                    searchPlaceholder="Search for brand name..."
                    error={!!formErrors.brandName}
                    noResultsText="No brands found"
                    isLoading={brandsLoading}
                    loadingText="Loading brands..."
                  />
                </div>
              )}
            </div>

            {/* Items Section */}
            <div>
              <label className="block text-sm mb-3 text-[#2C2C2C]">
                Items <span className="text-[#2C2C2C]/50">*</span>
              </label>
              <div className="space-y-4">
                {selectedItems.map((selectedItem, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 rounded-lg p-4 space-y-3"
                  >
                    {" "}
                    {/* Item Selection Row */}
                    <div className="flex gap-3 items-start">
                      <div className="flex-1 min-w-0">
                        <SearchableDropdown
                          options={filteredItems.map((item) => ({
                            value: item.item_id,
                            label: item.item_name,
                            modelNumber: item.model_number || undefined,
                          }))}
                          value={selectedItem.item}
                          onChange={(value) => handleItemChange(index, value)}
                          placeholder="Select an item"
                          searchPlaceholder="Search for items..."
                          noResultsText="No items found"
                          isLoading={isLoadingItems}
                          error={!!selectedItem.error}
                          loadingText="Loading items..."
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24">
                          <input
                            type="number"
                            value={Math.abs(selectedItem.quantity_change) || ""}
                            onChange={(e) =>
                              handleQuantityChange(index, e.target.value)
                            }
                            className={`w-full p-2.5 border-[1.5px] ${
                              selectedItem.error
                                ? "border-[#D3465C]"
                                : "border-[#D5D7DA]"
                            } rounded-lg`}
                            placeholder="Quantity"
                            min="1"
                            max={MAX_QUANTITY}
                          />
                          {selectedItem.error && (
                            <div className="flex items-center gap-1 text-[#D3465C] text-xs mt-1">
                              <AlertCircle className="h-3 w-3" />
                              <span>{selectedItem.error}</span>
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 min-w-0">
                          {selectedItem.item !== 0 &&
                            (() => {
                              const item = items.find(
                                (i: Item) => i.item_id === selectedItem.item,
                              );
                              return item ? item.uom : "";
                            })()}
                        </div>
                      </div>
                      {selectedItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="p-2.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {/* Batch Information Row - Only for Receive Products */}
                    {transactionType === "Receive Products (from Brands)" &&
                      selectedItem.item !== 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-gray-100">
                          <div>
                            {" "}
                            <label className="block text-xs text-gray-600 mb-1">
                              Batch Number *
                            </label>
                            <div className="flex gap-2">
                              <div className="flex-1">
                                <input
                                  type="text"
                                  value={selectedItem.batch_number || ""}
                                  onChange={(e) =>
                                    handleBatchFieldChange(
                                      index,
                                      "batch_number",
                                      e.target.value,
                                    )
                                  }
                                  className={`w-full p-2 border-[1.5px] rounded-lg text-sm ${
                                    selectedItem.batch_error
                                      ? "border-red-500 bg-red-50"
                                      : "border-[#D5D7DA] bg-white"
                                  }`}
                                  placeholder="e.g., B-001"
                                />
                                {selectedItem.batch_error && (
                                  <div className="text-red-500 text-xs mt-1">
                                    {selectedItem.batch_error}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (
                                    selectedItem.item &&
                                    selectedItem.item !== 0
                                  ) {
                                    const newBatchNumber =
                                      await generateBatchNumber(
                                        selectedItem.item,
                                      );
                                    const newItems = [...selectedItems];
                                    newItems[index].batch_number =
                                      newBatchNumber;
                                    // Clear any validation error
                                    delete newItems[index].batch_error;
                                    setSelectedItems(newItems);
                                  }
                                }}
                                className="px-3 py-2 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                                title="Generate new batch number"
                              >
                                🔄
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              Cost Price *
                            </label>
                            <input
                              type="number"
                              value={selectedItem.cost_price || ""}
                              onChange={(e) =>
                                handleBatchFieldChange(
                                  index,
                                  "cost_price",
                                  e.target.value,
                                )
                              }
                              className="w-full p-2 border-[1.5px] border-[#D5D7DA] rounded-lg text-sm"
                              placeholder="0.00"
                              min="0"
                              step="1"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              Expiry Date (Optional)
                            </label>
                            <input
                              type="date"
                              value={selectedItem.expiry_date || ""}
                              onChange={(e) =>
                                handleBatchFieldChange(
                                  index,
                                  "expiry_date",
                                  e.target.value,
                                )
                              }
                              className="w-full p-2 border-[1.5px] border-[#D5D7DA] rounded-lg text-sm"
                            />
                          </div>
                        </div>
                      )}
                    {/* Batch Selection and Pricing Row - Only for Sell Products */}
                    {isStockOut(transactionType) && selectedItem.item !== 0 && (
                      <div className="pt-3 border-t border-gray-100">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {selectedItem.available_batches && (
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">
                                Select Batch *
                              </label>
                              <select
                                value={selectedItem.batch_id || ""}
                                onChange={(e) => {
                                  const batchId = parseInt(e.target.value);
                                  const selectedBatch =
                                    selectedItem.available_batches?.find(
                                      (b) => b.batch_id === batchId,
                                    );
                                  const newItems = [...selectedItems];
                                  newItems[index].batch_id = batchId;
                                  newItems[index].selected_batch =
                                    selectedBatch;
                                  setSelectedItems(newItems);
                                }}
                                className="w-full p-2 border-[1.5px] border-[#D5D7DA] rounded-lg text-sm"
                              >
                                <option value="">Select a batch...</option>
                                {selectedItem.available_batches &&
                                selectedItem.available_batches.length > 0 ? (
                                  selectedItem.available_batches.map(
                                    (batch) => (
                                      <option
                                        key={batch.batch_id || batch.id}
                                        value={batch.batch_id || batch.id}
                                      >
                                        Batch {batch.batch_number} -{" "}
                                        {batch.remaining_quantity} available (₱
                                        {batch.cost_price})
                                      </option>
                                    ),
                                  )
                                ) : (
                                  <option value="" disabled>
                                    No batches available
                                  </option>
                                )}
                              </select>
                              {selectedItem.selected_batch && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Available:{" "}
                                  {
                                    selectedItem.selected_batch
                                      .remaining_quantity
                                  }{" "}
                                  units
                                </div>
                              )}
                            </div>
                          )}

                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              Pricing Tier *
                            </label>
                            <select
                              value={selectedItem.pricing_tier || ""}
                              onChange={(e) =>
                                handlePricingTierChange(index, e.target.value)
                              }
                              className="w-full p-2 border-[1.5px] border-[#D5D7DA] rounded-lg text-sm"
                              disabled={!customerName.trim()}
                            >
                              <option value="">Select pricing tier...</option>
                              {userTierRestrictions?.allowed_selling_tiers.map(
                                (tier) => (
                                  <option key={tier.value} value={tier.value}>
                                    {tier.label}
                                  </option>
                                ),
                              )}
                            </select>
                            {!customerName.trim() && (
                              <div className="text-xs text-orange-500 mt-1">
                                Enter customer name first
                              </div>
                            )}
                            {userTierRestrictions?.user_cost_tier && (
                              <div className="text-xs text-blue-500 mt-1">
                                Your cost tier:{" "}
                                {userTierRestrictions.user_cost_tier}
                              </div>
                            )}
                            {selectedItem.unit_price && (
                              <div className="text-xs text-green-600 mt-1">
                                Unit Price: ₱{selectedItem.unit_price}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Show pricing tier selection even without batches for testing */}
                    {isStockOut(transactionType) &&
                      selectedItem.item !== 0 &&
                      (!selectedItem.available_batches ||
                        selectedItem.available_batches.length === 0) && (
                        <div className="pt-3 border-t border-gray-100">
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                            <div className="text-xs text-yellow-700">
                              ⚠️ No inventory batches available for this item.
                              <br />
                              💡 Create some inventory first by using "Receive
                              Products (from Brands)" transactions.
                              <br />
                              🧪 Or continue for testing - you can still set
                              pricing tier.
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">
                              Pricing Tier *
                            </label>
                            <select
                              value={selectedItem.pricing_tier || ""}
                              onChange={(e) =>
                                handlePricingTierChange(index, e.target.value)
                              }
                              className="w-full p-2 border-[1.5px] border-[#D5D7DA] rounded-lg text-sm"
                              disabled={!customerName.trim()}
                            >
                              <option value="">Select pricing tier...</option>
                              {userTierRestrictions?.allowed_selling_tiers.map(
                                (tier) => (
                                  <option key={tier.value} value={tier.value}>
                                    {tier.label}
                                  </option>
                                ),
                              )}
                            </select>
                            {!customerName.trim() && (
                              <div className="text-xs text-orange-500 mt-1">
                                Enter customer name first
                              </div>
                            )}
                            {userTierRestrictions?.user_cost_tier && (
                              <div className="text-xs text-blue-500 mt-1">
                                Your cost tier:{" "}
                                {userTierRestrictions.user_cost_tier}
                              </div>
                            )}
                            {selectedItem.unit_price && (
                              <div className="text-xs text-green-600 mt-1">
                                Unit Price: ₱{selectedItem.unit_price} | Total:
                                ₱{selectedItem.total_price}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddItem}
                  className="w-full py-2.5 border-2 border-dashed border-[#D5D7DA] rounded-lg text-[#646464] hover:border-[#0504AA] hover:text-[#0504AA] transition-colors"
                >
                  + Add Another Item
                </button>
              </div>
            </div>

            {/* Due Date - Only for Sell Products */}
            {transactionType === "Sell Products (to Customers)" && (
              <div>
                <label className="block text-sm mb-2 text-[#2C2C2C]">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full p-2.5 border-[1.5px] border-[#D5D7DA] rounded-lg"
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-sm mb-2 text-[#2C2C2C]">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full p-2.5 border-[1.5px] border-[#D5D7DA] rounded-lg resize-none"
                placeholder="Add any additional notes..."
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4 gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-3 bg-[#0504AA] text-white rounded-lg font-medium hover:bg-[#0504AA]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? "Creating Transaction..." : "Create Transaction"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
