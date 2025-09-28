import axios from "axios";

export const API_BASE_URL = "http://127.0.0.1:8000/api";

// Create Axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Increased from 10000 to 30000 (30 seconds)
  headers: {
    "Content-Type": "application/json",
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Add response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refreshToken");
        if (refreshToken) {
          console.log("Attempting token refresh...");
          const response = await fetch(`${API_BASE_URL}/token/refresh/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ refresh: refreshToken }),
          });

          if (response.ok) {
            const { access } = await response.json();
            localStorage.setItem("accessToken", access);
            localStorage.setItem("lastTokenCheck", Date.now().toString());
            originalRequest.headers.Authorization = `Bearer ${access}`;
            console.log("Token refreshed successfully");
            return api(originalRequest);
          } else {
            console.log("Token refresh failed with status:", response.status);
          }
        } else {
          console.log("No refresh token available");
        }
      } catch (refreshError) {
        console.error("Token refresh error:", refreshError);
      }

      // Only clear tokens and redirect if we're sure the session is invalid
      console.log("Clearing invalid session and redirecting to login");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("lastTokenCheck");

      // Use React Router navigation instead of direct window redirect if possible
      // Check if we're already on login page to prevent redirect loop
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);

// Items API - ONLY declare this once, here in api.ts
export const itemsApi = {
  getAll: async (params?: any) => {
    try {
      const response = await api.get("/items/", { params });
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to fetch items",
      };
    }
  },

  getById: async (id: string) => {
    try {
      const response = await api.get(`/items/${id}/`);
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to fetch item",
      };
    }
  },

  getHistory: async (id: string) => {
    try {
      const response = await api.get(`/items/${id}/history/`);
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to fetch history",
      };
    }
  },

  create: async (itemData: any) => {
    try {
      const response = await api.post("/items/", itemData);
      return {
        status: "success",
        data: response.data,
        message: "Item created successfully",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to create item",
      };
    }
  },

  update: async (id: string, itemData: any) => {
    try {
      const response = await api.put(`/items/${id}/`, itemData);

      return {
        status: "success",
        data: response.data,
        message: "Item updated successfully",
      };
    } catch (error: any) {
      console.error("=== UPDATE ERROR DEBUG ===");
      console.error("Error object:", error);
      console.error("Response status:", error?.response?.status);
      console.error("Response data:", error?.response?.data);
      console.error("Response headers:", error?.response?.headers);

      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to update item",
      };
    }
  },

  delete: async (id: string) => {
    try {
      await api.delete(`/items/${id}/`);
      return {
        status: "success",
        data: null,
        message: "Item deleted successfully",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to delete item",
      };
    }
  },

  getStats: async () => {
    try {
      const response = await api.get("/dashboard/stats/");
      // Transform the response to match the expected InventoryStats interface
      const stats = {
        total_items: response.data.total_items || 0,
        low_stock: response.data.low_stock_items || 0,
        out_of_stock: response.data.out_of_stock_items || 0,
      };
      return {
        status: "success",
        data: stats,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to fetch stats",
      };
    }
  },

  getNextBatchNumber: async (itemId: number) => {
    try {
      const response = await api.get(`/items/${itemId}/next-batch-number/`);
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to fetch next batch number",
      };
    }
  },

  exportCsv: async (params: any) => {
    try {
      const response = await api.get("/items/export/", {
        params,
        responseType: "blob",
      });
      return {
        status: "success",
        data: response.data,
        message: "CSV exported successfully",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to export CSV",
      };
    }
  },

  createPricing: async (pricingData: any) => {
    try {
      const response = await api.post("/item-pricing/", pricingData);
      return {
        status: "success",
        data: response.data,
        message: "Pricing created successfully",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to create pricing",
      };
    }
  },

  createTierPricing: async (pricingData: any) => {
    try {
      const response = await api.post("/item-tier-pricing/", pricingData);
      return {
        status: "success",
        data: response.data,
        message: "Tier pricing created successfully",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to create tier pricing",
      };
    }
  },

  updateTierPricing: async (pricingId: number, pricingData: any) => {
    try {
      const response = await api.put(
        `/item-tier-pricing/${pricingId}/`,
        pricingData,
      );
      return {
        status: "success",
        data: response.data,
        message: "Tier pricing updated successfully",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to update tier pricing",
      };
    }
  },

  deleteTierPricing: async (pricingId: number) => {
    try {
      await api.delete(`/item-tier-pricing/${pricingId}/`);
      return {
        status: "success",
        data: null,
        message: "Tier pricing deleted successfully",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to delete tier pricing",
      };
    }
  },

  getTierPricingForItem: async (itemId: number) => {
    try {
      const response = await api.get(`/item-tier-pricing/?item=${itemId}`);
      return {
        status: "success",
        data: response.data,
        message: "Tier pricing retrieved successfully",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to get tier pricing",
      };
    }
  },

  getNextSku: async (brandId: number) => {
    try {
      const response = await api.get(`/items/next-sku/?brand_id=${brandId}`);
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to get next SKU",
      };
    }
  },

  validateBatchNumber: async (itemId: number, batchNumber: string) => {
    try {
      const response = await api.post("/items/validate-batch-number/", {
        item_id: itemId,
        batch_number: batchNumber,
      });
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to validate batch number",
      };
    }
  },
};

// Batch API
export const batchApi = {
  getAll: async (params?: any) => {
    try {
      const response = await api.get("/inventory-batches/", { params });
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to fetch batches",
      };
    }
  },

  getByItemId: async (itemId: number, activeOnly = false) => {
    try {
      const params: any = { item_id: itemId };
      if (activeOnly) {
        params.active_only = "true";
      }
      const response = await api.get("/inventory-batches/", { params });
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to fetch item batches",
      };
    }
  },

  create: async (data: any) => {
    try {
      const response = await api.post("/inventory-batches/", data);
      return {
        status: "success",
        data: response.data,
        message: "Batch created successfully",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to create batch",
      };
    }
  },
};

// Export other APIs as needed
export default api;

export const API_ENDPOINTS = {
  // Authentication
  LOGIN: `${API_BASE_URL}/token/`,
  REFRESH: `${API_BASE_URL}/token/refresh/`,
  USER_INFO: `${API_BASE_URL}/user/`,

  // Core entities
  ITEMS: `${API_BASE_URL}/items/`,
  BRANDS: `${API_BASE_URL}/brands/`,
  CUSTOMERS: `${API_BASE_URL}/customers/`,
  TRANSACTIONS: `${API_BASE_URL}/transactions/`,

  // Beauty product features
  CUSTOMER_SPECIAL_PRICES: `${API_BASE_URL}/customer-special-pricing/`,

  // Reports and dashboard
  DASHBOARD_STATS: `${API_BASE_URL}/dashboard/stats/`,
  SALES_REPORT: `${API_BASE_URL}/reports/sales/`,
  INVENTORY_VALUE_REPORT: `${API_BASE_URL}/reports/inventory-value/`,
};

// Type definitions
export interface User {
  id: number; // Add alias for compatibility
  account_id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  role: string;
  cost_tier: string | number; // Accept either string or number
  is_active: boolean;
  date_joined: string;
}

export interface ApiResponse<T> {
  results?: T[];
  count?: number;
  next?: string;
  previous?: string;
  // Add these missing properties
  data?: T;
  status?: number | string;
  message?: string;
}

// API service functions
export const authApi = {
  login: (data: any) =>
    fetch(API_ENDPOINTS.LOGIN, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),
  refreshToken: (refreshToken: string) =>
    fetch(API_ENDPOINTS.REFRESH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: refreshToken }),
    }),
  getUserInfo: async () => {
    try {
      const token = localStorage.getItem("accessToken");
      const response = await fetch(`${API_BASE_URL}/user/`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      if (response.ok) {
        return {
          status: "success",
          data,
          message: "",
        };
      } else {
        return {
          status: "error",
          data: null,
          message: data?.detail || "Failed to fetch user info",
        };
      }
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message: error?.message || "Failed to fetch user info",
      };
    }
  },
  updateUserInfo: (data: any) => {
    const token = localStorage.getItem("accessToken");
    return fetch(API_ENDPOINTS.USER_INFO, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  },
};

// Brands API
export const brandsApi = {
  getAll: async (params?: any) => {
    try {
      const response = await api.get("/brands/", { params });
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to fetch brands",
      };
    }
  },

  getById: async (id: string) => {
    try {
      const response = await api.get(`/brands/${id}/`);
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to fetch brand",
      };
    }
  },

  create: async (data: any) => {
    try {
      const response = await api.post("/brands/", data);
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to create brand",
      };
    }
  },

  update: async (id: string, data: any) => {
    try {
      const response = await api.put(`/brands/${id}/`, data);
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to update brand",
      };
    }
  },

  delete: async (id: string) => {
    try {
      await api.delete(`/brands/${id}/`);
      return {
        status: "success",
        data: null,
        message: "Brand deleted successfully",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to delete brand",
      };
    }
  },
};

// Update transactionsApi to use the Axios instance
export const transactionsApi = {
  getAll: async (params?: any) => {
    try {
      const response = await api.get("/transactions/", { params });
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to fetch transactions",
      };
    }
  },

  getById: async (id: string) => {
    try {
      const response = await api.get(`/transactions/${id}/`);
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to fetch transaction",
      };
    }
  },

  create: async (data: any) => {
    try {
      const response = await api.post("/transactions/", data);
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to create transaction",
      };
    }
  },

  update: async (id: string, data: any) => {
    try {
      const response = await api.put(`/transactions/${id}/`, data);
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to update transaction",
      };
    }
  },

  delete: async (id: string) => {
    try {
      await api.delete(`/transactions/${id}/`);
      return {
        status: "success",
        data: null,
        message: "Transaction deleted successfully",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to delete transaction",
      };
    }
  },

  // Cancel a transaction
  cancel: async (id: string) => {
    try {
      const response = await api.post(`/transactions/${id}/cancel/`);
      return {
        status: "success",
        data: response.data,
        message: response.data?.message || "Transaction cancelled successfully",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to cancel transaction",
      };
    }
  },

  // Complete a transaction
  complete: async (id: string) => {
    try {
      const response = await api.post(`/transactions/${id}/complete/`);
      return {
        status: "success",
        data: response.data,
        message: response.data?.message || "Transaction completed successfully",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to complete transaction",
      };
    }
  },
};

export const usersApi = {
  getAll: async (params?: any) => {
    try {
      const response = await api.get("/users/", { params });
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to fetch users",
      };
    }
  },

  getById: async (id: string) => {
    try {
      const response = await api.get(`/users/${id}/`);
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to fetch user",
      };
    }
  },

  create: async (data: any) => {
    try {
      const response = await api.post("/users/", data);
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to create user",
      };
    }
  },

  update: async (id: string, data: any) => {
    try {
      const response = await api.put(`/users/${id}/`, data);
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to update user",
      };
    }
  },

  delete: async (id: string) => {
    try {
      await api.delete(`/users/${id}/`);
      return {
        status: "success",
        data: null,
        message: "User deleted successfully",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to delete user",
      };
    }
  },
};

export const customersApi = {
  getAll: async (params?: any) => {
    try {
      const response = await api.get("/customers/", { params });
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to fetch customers",
      };
    }
  },

  getById: async (id: string) => {
    try {
      const response = await api.get(`/customers/${id}/`);
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to fetch customer",
      };
    }
  },

  create: async (data: any) => {
    try {
      const response = await api.post("/customers/", data);
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to create customer",
      };
    }
  },

  update: async (id: string, data: any) => {
    try {
      const response = await api.put(`/customers/${id}/`, data);
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to update customer",
      };
    }
  },

  delete: async (id: string) => {
    try {
      await api.delete(`/customers/${id}/`);
      return {
        status: "success",
        data: null,
        message: "Customer deleted successfully",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to delete customer",
      };
    }
  },
};

// Customer Special Prices API
export const customerSpecialPricesApi = {
  getAll: async (params?: any) => {
    try {
      const response = await api.get("/customer-special-pricing/", { params });
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to fetch special prices",
      };
    }
  },

  getByCustomerId: async (customerId: number) => {
    try {
      const response = await api.get("/customer-special-pricing/", {
        params: { customer: customerId },
      });
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to fetch customer special prices",
      };
    }
  },

  create: async (data: any) => {
    try {
      const response = await api.post("/customer-special-pricing/", data);
      return {
        status: "success",
        data: response.data,
        message: "Special price request created successfully",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to create special price",
      };
    }
  },

  approve: async (id: string) => {
    try {
      const response = await api.post(
        `/customer-special-pricing/${id}/approve/`,
      );
      return {
        status: "success",
        data: response.data,
        message: "Special price approved successfully",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to approve special price",
      };
    }
  },

  reject: async (id: string) => {
    try {
      const response = await api.post(
        `/customer-special-pricing/${id}/reject/`,
      );
      return {
        status: "success",
        data: response.data,
        message: "Special price rejected successfully",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to reject special price",
      };
    }
  },

  delete: async (id: string) => {
    try {
      await api.delete(`/customer-special-pricing/${id}/`);
      return {
        status: "success",
        data: null,
        message: "Special price deleted successfully",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to delete special price",
      };
    }
  },
};

// Item Pricing API
export const pricingApi = {
  getAll: async (params?: any) => {
    try {
      const response = await api.get("/item-pricing/", { params });
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to fetch pricing",
      };
    }
  },

  getByItemId: async (itemId: number) => {
    try {
      const response = await api.get("/item-pricing/", {
        params: { item_id: itemId },
      });
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to fetch item pricing",
      };
    }
  },

  getUserAllowedTiers: async () => {
    try {
      const response = await api.get(
        "/pricing-utils/?action=user_allowed_tiers",
      );
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to fetch user tiers",
      };
    }
  },

  getAllTiers: async () => {
    try {
      const response = await api.get("/pricing-utils/");
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to fetch all pricing tiers",
      };
    }
  },

  calculatePriceForUser: async (
    customerId: number,
    itemId: number,
    requestedTier?: string,
  ) => {
    try {
      const payload: any = {
        customer_id: customerId,
        item_id: itemId,
      };

      if (requestedTier) {
        payload.requested_tier = requestedTier;
      }

      const response = await api.post("/pricing-utils/", payload);
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to calculate price",
      };
    }
  },
};

// Test API connectivity
export const testConnection = async () => {
  try {
    console.log("Testing connection to:", API_BASE_URL);
    const response = await api.get("/test/", { timeout: 5000 });
    console.log("Connection test successful:", response.data);
    return { success: true, message: "Connected successfully" };
  } catch (error: any) {
    console.error("Connection test failed:", error);
    if (error.code === "ECONNABORTED") {
      return {
        success: false,
        message: "Connection timeout - backend may not be running",
      };
    } else if (error.response) {
      return {
        success: false,
        message: `Server responded with status ${error.response.status}`,
      };
    } else if (error.request) {
      return {
        success: false,
        message: "Cannot reach server - backend is likely not running",
      };
    } else {
      return {
        success: false,
        message: error.message || "Unknown connection error",
      };
    }
  }
};

// Add this to your useAuth hook or a utility file
export const debugAuth = () => {
  const accessToken = localStorage.getItem("accessToken");
  const refreshToken = localStorage.getItem("refreshToken");

  console.log("=== Auth Debug ===");
  console.log("Access token present:", !!accessToken);
  console.log("Refresh token present:", !!refreshToken);

  if (accessToken) {
    try {
      const payload = JSON.parse(atob(accessToken.split(".")[1]));
      const exp = payload.exp * 1000;
      const now = Date.now();
      console.log("Token expires:", new Date(exp));
      console.log("Token is expired:", exp < now);
      console.log("User ID from token:", payload.user_id);
    } catch (e) {
      console.error("Error parsing token:", e);
    }
  }

  return { accessToken, refreshToken };
};

// Pricing logic to check for special prices vs standard tiered pricing
export const pricingLogic = {
  /**
   * Get the price for a customer and item
   * Checks for special price first, falls back to tiered pricing
   */
  getPriceForCustomerAndItem: async (customerId: number, itemId: number) => {
    try {
      // First check for customer special price
      const specialPriceResponse = await api.get("/customer-special-pricing/", {
        params: { customer: customerId, item: itemId },
      });

      if (specialPriceResponse.data?.results?.length > 0) {
        const specialPrice = specialPriceResponse.data.results[0];
        if (specialPrice.is_approved) {
          return {
            status: "success",
            data: {
              price: parseFloat(specialPrice.special_price),
              price_type: "special",
              pricing_info: specialPrice,
            },
            message: "Special price found",
          };
        }
      }

      // If no special price, get standard tiered pricing
      const pricingResponse = await api.get("/item-pricing/", {
        params: { item_id: itemId },
      });

      if (pricingResponse.data?.results?.length > 0) {
        const pricing = pricingResponse.data.results[0];

        // Get customer info to determine their pricing tier
        const customerResponse = await api.get(`/customers/${customerId}/`);
        const customer = customerResponse.data;

        const tierPrices = {
          RD: pricing.regional_distributor,
          PD: pricing.provincial_distributor,
          DD: pricing.district_distributor,
          CD: pricing.city_distributor,
          RS: pricing.reseller,
          SUB: pricing.sub_reseller,
          SRP: pricing.srp,
        };

        const price =
          tierPrices[customer.pricing_tier as keyof typeof tierPrices] ||
          pricing.srp;

        return {
          status: "success",
          data: {
            price: parseFloat(price),
            price_type: "tiered",
            tier: customer.pricing_tier,
            pricing_info: pricing,
          },
          message: "Tiered price found",
        };
      }

      return {
        status: "error",
        data: null,
        message: "No pricing found for this item",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to get price",
      };
    }
  },

  /**
   * Check if a special price requires approval
   * Rules: Any new special price or significant deviation from tiered price
   */
  requiresApproval: async (
    customerId: number,
    itemId: number,
    proposedPrice: number,
  ) => {
    try {
      const currentPricing = await pricingLogic.getPriceForCustomerAndItem(
        customerId,
        itemId,
      );

      if (currentPricing.status === "success" && currentPricing.data) {
        const currentPrice = currentPricing.data.price;
        const deviationPercentage =
          Math.abs((proposedPrice - currentPrice) / currentPrice) * 100;

        // Require approval for deviations > 10% or if price is lower than current
        return {
          requiresApproval:
            deviationPercentage > 10 || proposedPrice < currentPrice,
          deviationPercentage,
          currentPrice,
          reason:
            deviationPercentage > 10
              ? `Price deviation of ${deviationPercentage.toFixed(1)}% exceeds 10% threshold`
              : proposedPrice < currentPrice
                ? "Proposed price is lower than current price"
                : "No approval required",
        };
      }

      // If no current pricing found, require approval for new special prices
      return {
        requiresApproval: true,
        deviationPercentage: 0,
        currentPrice: 0,
        reason: "New special price requires approval",
      };
    } catch (error: any) {
      return {
        requiresApproval: true,
        deviationPercentage: 0,
        currentPrice: 0,
        reason:
          "Error checking approval requirements - defaulting to approval required",
      };
    }
  },
};

// Customer Brand Pricing API
export const customerBrandPricingApi = {
  getAll: async (params?: any) => {
    try {
      const response = await api.get("/customer-brand-pricing/", { params });
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to fetch customer brand pricing",
      };
    }
  },

  getByCustomerId: async (customerId: number) => {
    try {
      const response = await api.get("/customer-brand-pricing/", {
        params: { customer: customerId },
      });
      return {
        status: "success",
        data: response.data,
        message: "",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to fetch customer brand pricing",
      };
    }
  },

  create: async (data: any) => {
    try {
      const response = await api.post("/customer-brand-pricing/", data);
      return {
        status: "success",
        data: response.data,
        message: "Brand pricing assigned successfully",
      };
    } catch (error: any) {
      console.error("Customer brand pricing API error:", error?.response?.data);
      const errorMessage =
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        (error?.response?.data && typeof error.response.data === "object"
          ? JSON.stringify(error.response.data)
          : error?.message) ||
        "Failed to assign brand pricing";
      return {
        status: "error",
        data: null,
        message: errorMessage,
      };
    }
  },

  createBulk: async (data: any) => {
    try {
      const response = await api.post(
        "/customer-brand-pricing/bulk_create/",
        data,
      );
      return {
        status: "success",
        data: response.data,
        message: "Brand pricing assigned successfully",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to assign brand pricing",
      };
    }
  },

  update: async (id: string, data: any) => {
    try {
      const response = await api.put(`/customer-brand-pricing/${id}/`, data);
      return {
        status: "success",
        data: response.data,
        message: "Brand pricing updated successfully",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to update brand pricing",
      };
    }
  },

  delete: async (id: string) => {
    try {
      await api.delete(`/customer-brand-pricing/${id}/`);
      return {
        status: "success",
        data: null,
        message: "Brand pricing removed successfully",
      };
    } catch (error: any) {
      return {
        status: "error",
        data: null,
        message:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to remove brand pricing",
      };
    }
  },
};
