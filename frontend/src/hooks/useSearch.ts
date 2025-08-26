import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from './useDebounce';
import { itemsApi, brandsApi } from '../lib/api';
import { Item, APIResponse, Brand } from '../types/inventory';

interface Filters {
    item_type: string | null;
    category: string | null;
    brand: string | null;
    availability_status: string | null;
}

// Add a generic interface for paginated responses
interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

export function useSearch({ 
    initialQuery = '', 
    debounceMs = 300,
    filters
}: { 
    initialQuery?: string; 
    debounceMs?: number;
    filters: Filters;
}) {
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState<Item[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const debouncedQuery = useDebounce(query, debounceMs);

    const searchItems = useCallback(async (searchQuery: string) => {
        // Always perform search when filters are applied, even if no search query
        const shouldPerformSearch = searchQuery.trim() !== '' || 
            Object.values(filters).some(val => val !== null && val !== '');
            
        if (!shouldPerformSearch) {
            setResults([]);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams();
            
            // Only add search parameter if there's an actual query
            if (searchQuery.trim()) {
                params.append('search', searchQuery.toLowerCase());
            }

            // Add filters to params - make sure to log each one for debugging
            if (filters.item_type) {
                params.append('item_type', filters.item_type);
                console.log('Applied item_type filter:', filters.item_type);
            }
            
            if (filters.category) {
                params.append('category', filters.category);
                console.log('Applied category filter:', filters.category);
            }
            
            if (filters.brand) {
                params.append('brand', filters.brand);
                console.log('Applied brand filter:', filters.brand);
            }
            
            if (filters.availability_status) {
                // Make sure to use the exact format expected by the backend
                params.append('availability_status', filters.availability_status);
                console.log('Applied availability filter:', filters.availability_status);
            }

            // Log the full URL for debugging
            const fullUrl = `/items/?${params.toString()}`;
            console.log('Search URL:', fullUrl);

            const response = await itemsApi.getAll(params);
            console.log('Search response:', response);
            
            if (response.status === 'error' || !response.data) {
                throw new Error(response.message || 'Failed to fetch search results');
            }

            // Handle both array and paginated response formats
            if (Array.isArray(response.data)) {
                console.log('Received array data with', response.data.length, 'items');
                // Use original data without modifications
                setResults(response.data);
            } else if (response.data && typeof response.data === 'object' && 'results' in response.data) {
                const paginatedData = response.data as unknown as APIResponse;
                console.log('Received paginated data with', paginatedData.results.length, 'items');
                // Use original data without modifications
                setResults(paginatedData.results);
            } else {
                setResults([]);
                console.error('Unexpected response format:', response.data);
            }
        } catch (err) {
            console.error('Search error:', err);
            setError(err instanceof Error ? err.message : 'An error occurred while searching');
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    }, [filters]); // Add filters to dependency array

    useEffect(() => {
        searchItems(debouncedQuery);
    }, [debouncedQuery, searchItems]);

    const clearSearch = useCallback(() => {
        setQuery('');
        setResults([]);
        setError(null);
    }, []);

    return {
        query,
        setQuery,
        results,
        isLoading,
        error,
        clearSearch
    };
}

export function useBrandSearch({ 
    initialQuery = '', 
    debounceMs = 300
}: { 
    initialQuery?: string; 
    debounceMs?: number;
}) {
    const [query, setQuery] = useState(initialQuery);
    const [results, setResults] = useState<Brand[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const debouncedQuery = useDebounce(query, debounceMs);

    const searchBrands = useCallback(async (searchQuery: string) => {
        if (!searchQuery.trim()) {
            setResults([]);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const params = new URLSearchParams({
                search: searchQuery.toLowerCase()
            });

            const response = await brandsApi.getAll(params);
            
            if (response.status === 'error' || !response.data) {
                throw new Error(response.message || 'Failed to fetch search results');
            }

            // Handle different response formats
            if (Array.isArray(response.data)) {
                setResults(response.data);
            } else {
                // Safely handle the paginated response format
                const paginatedData = response.data as PaginatedResponse<Brand>;
                setResults(paginatedData.results || []);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred while searching');
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    }, []); 

    useEffect(() => {
        searchBrands(debouncedQuery);
    }, [debouncedQuery, searchBrands]);

    const clearSearch = useCallback(() => {
        setQuery('');
        setResults([]);
        setError(null);
    }, []);

    return {
        query,
        setQuery,
        results,
        isLoading,
        error,
        clearSearch
    };
}