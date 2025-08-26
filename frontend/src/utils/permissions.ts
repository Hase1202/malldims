import { User } from '../lib/api';

type Role = 'Admin' | 'Leader' | 'Sales Rep' | 'Inventory Manager' | 'Warehouse Staff' | 'Sales';

export const hasRole = (user: User | null, role: Role): boolean => {
    return user?.role === role;
};

export const isAdmin = (user: User | null): boolean => {
    return hasRole(user, 'Admin');
};

export const isLeader = (user: User | null): boolean => {
    return hasRole(user, 'Leader');
};

export const canManageCustomers = (user: User | null): boolean => {
    return hasRole(user, 'Admin') || hasRole(user, 'Leader') || hasRole(user, 'Inventory Manager');
};

export const canManageBrands = (user: User | null): boolean => {
    return hasRole(user, 'Inventory Manager') || hasRole(user, 'Admin') || hasRole(user, 'Leader');
};

export const canManageItems = (user: User | null): boolean => {
    return hasRole(user, 'Inventory Manager') || hasRole(user, 'Warehouse Staff') || hasRole(user, 'Admin') || hasRole(user, 'Leader');
};

export const canManageTransactions = (user: User | null): boolean => {
    return hasRole(user, 'Inventory Manager') || hasRole(user, 'Warehouse Staff') || hasRole(user, 'Admin') || hasRole(user, 'Leader');
};

export const canApproveTransactions = (user: User | null): boolean => {
    return hasRole(user, 'Inventory Manager') || hasRole(user, 'Warehouse Staff') || hasRole(user, 'Admin') || hasRole(user, 'Leader');
};

export const canViewAlerts = (user: User | null): boolean => {
    return hasRole(user, 'Inventory Manager') || hasRole(user, 'Warehouse Staff') || hasRole(user, 'Admin') || hasRole(user, 'Leader');
};

export const canExportData = (_: User | null): boolean => {
    return true; // All roles can export data
};

export const canViewDashboard = (_: User | null): boolean => {
    return true; // All roles can view dashboard
};

export const canReserveGoods = (_: User | null): boolean => {
    return true; // All roles can reserve goods
};

export const canViewOwnTransactions = (_: User | null): boolean => {
    return true; // All roles can view their own transactions
};

export const isSales = (user: User | null): boolean => {
    return hasRole(user, 'Sales') || hasRole(user, 'Sales Rep');
};

export const isWarehouseStaff = (user: User | null): boolean => {
    return hasRole(user, 'Warehouse Staff');
};

export const isInventoryManager = (user: User | null): boolean => {
    return hasRole(user, 'Inventory Manager') || hasRole(user, 'Admin') || hasRole(user, 'Leader');
};

export const canCancelOwnPendingTransaction = (user: User | null, transaction: any): boolean => {
    if (!user || !transaction) return false;
    if (isInventoryManager(user) || isWarehouseStaff(user) || isAdmin(user) || isLeader(user)) return true;
    if (isSales(user) && transaction.transaction_status === 'Pending') return true;
    return false;
};