import { useState, useEffect, useCallback } from 'react';
import { brandsApi } from '../lib/api';
import { Brand } from '../types/inventory';

// Global state for brands
let globalBrandsState: Brand[] = [];
let globalLoading: boolean = false;
let globalError: string | null = null;
let subscribers: Set<() => void> = new Set();

// Function to notify all subscribers
const notifySubscribers = () => {
  subscribers.forEach(callback => callback());
};

// Function to update global state
const updateGlobalState = (brands: Brand[], loading: boolean, error: string | null) => {
  globalBrandsState = brands;
  globalLoading = loading;
  globalError = error;
  notifySubscribers();
};

// Function to fetch brands and update global state
const fetchBrandsGlobally = async (params?: any) => {
  try {
    updateGlobalState(globalBrandsState, true, null);
    
    const response = await brandsApi.getAll(params || { all: 'true' });
    
    if (response.status === 'error' || !response.data) {
      throw new Error(response.message || 'Failed to fetch brands');
    }

    let brandsData: Brand[] = [];
    
    // Handle both array and paginated response formats
    if (Array.isArray(response.data)) {
      brandsData = response.data;
    } else {
      const paginatedData = response.data as { results: Brand[] };
      brandsData = paginatedData.results || [];
    }
    
    updateGlobalState(brandsData, false, null);
    return brandsData;
  } catch (error) {
    console.error('Failed to fetch brands:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch brands';
    updateGlobalState([], false, errorMessage);
    throw error;
  }
};

// Custom hook to use brands
export const useBrands = (params?: any) => {
  const [brands, setBrands] = useState<Brand[]>(globalBrandsState);
  const [loading, setLoading] = useState<boolean>(globalLoading);
  const [error, setError] = useState<string | null>(globalError);
  // Subscribe to global state changes
  useEffect(() => {
    const updateLocalState = () => {
      setBrands(globalBrandsState);
      setLoading(globalLoading);
      setError(globalError);
    };

    subscribers.add(updateLocalState);

    // If we don't have brands yet and we're not currently loading, fetch them
    if (globalBrandsState.length === 0 && !globalLoading) {
      fetchBrandsGlobally(params).catch(() => {
        // Error already handled in fetchBrandsGlobally
      });
    }

    return () => {
      subscribers.delete(updateLocalState);
    };
  }, []);

  // Function to refresh brands
  const refreshBrands = useCallback(async (refreshParams?: any) => {
    try {
      await fetchBrandsGlobally(refreshParams || params);
    } catch (error) {
      // Error already handled in fetchBrandsGlobally
    }
  }, [params]);

  // Function to remove a brand from local state (optimistic update)
  const removeBrand = useCallback((brandId: number) => {
    const updatedBrands = globalBrandsState.filter(brand => brand.brand_id !== brandId);
    updateGlobalState(updatedBrands, false, null);
  }, []);

  // Function to add a brand to local state (optimistic update)
  const addBrand = useCallback((brand: Brand) => {
    const updatedBrands = [...globalBrandsState, brand];
    updateGlobalState(updatedBrands, false, null);
  }, []);

  // Function to update a brand in local state (optimistic update)
  const updateBrand = useCallback((brandId: number, updatedBrand: Brand) => {
    const updatedBrands = globalBrandsState.map(brand => 
      brand.brand_id === brandId ? updatedBrand : brand
    );
    updateGlobalState(updatedBrands, false, null);
  }, []);

  return {
    brands,
    loading,
    error,
    refreshBrands,
    removeBrand,
    addBrand,
    updateBrand
  };
};

// Function to refresh brands globally (can be called from anywhere)
export const refreshBrandsGlobally = () => {
  return fetchBrandsGlobally({ all: 'true' });
};
