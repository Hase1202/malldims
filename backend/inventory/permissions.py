from rest_framework import permissions

class IsInventoryManager(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.role == 'Inventory Manager'

class IsWarehouseStaff(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.role == 'Warehouse Staff'

class IsSales(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.role == 'Sales'

class CanManageBrands(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.role in ['Inventory Manager']

class CanManageItems(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.role in ['Inventory Manager', 'Warehouse Staff']

class CanManageTransactions(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.role in ['Inventory Manager', 'Warehouse Staff']

class CanApproveTransactions(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.role in ['Inventory Manager', 'Warehouse Staff']

class CanViewAlerts(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.role in ['Inventory Manager', 'Warehouse Staff']

class CanExportData(permissions.BasePermission):
    def has_permission(self, request, view):
        return True  # All roles can export data

class CanViewDashboard(permissions.BasePermission):
    def has_permission(self, request, view):
        return True  # All roles can view dashboard

class CanReserveGoods(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.role in ['Inventory Manager', 'Warehouse Staff', 'Sales']

class CanViewOwnTransactions(permissions.BasePermission):
    def has_permission(self, request, view):
        return True  # All roles can view their own transactions

    def has_object_permission(self, request, view, obj):
        return obj.account == request.user 

class ReadOnlyOrCanManageItems(permissions.BasePermission):
    """
    Allow all authenticated users to read, but only managers/staff to write.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user.role in ['Inventory Manager', 'Warehouse Staff']

class ReadOnlyOrCanManageBrands(permissions.BasePermission):
    """
    Allow all authenticated users to read, but only managers to write.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user.role == 'Inventory Manager' 

class ReadOnlyOrCanManageTransactions(permissions.BasePermission):
    """
    Allow all authenticated users to read, but only managers/staff to write.
    """
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return request.user and request.user.is_authenticated
        return request.user.role in ['Inventory Manager', 'Warehouse Staff'] 

class CanCancelOwnPendingTransaction(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        print('DEBUG: user', request.user)
        print('DEBUG: user.role', getattr(request.user, 'role', None))
        print('DEBUG: obj.transaction_status', getattr(obj, 'transaction_status', None))
        if request.user.role in ['Inventory Manager', 'Warehouse Staff']:
            return True
        if request.user.role == 'Sales' and obj.transaction_status == 'Pending':
            return True
        return False