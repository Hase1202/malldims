from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

router = DefaultRouter()
router.register(r'items', views.ItemViewSet, basename='item')
router.register(r'brands', views.BrandViewSet, basename='brand')
router.register(r'customers', views.CustomerViewSet, basename='customer')
router.register(r'transactions', views.TransactionViewSet, basename='transaction')
router.register(r'inventory-batches', views.InventoryBatchViewSet, basename='inventorybatch')
router.register(r'customer-special-prices', views.CustomerSpecialPriceViewSet, basename='customerspecialprice')
# New tiered pricing ViewSets
router.register(r'item-pricing', views.ItemPricingViewSet, basename='itempricing')
router.register(r'batch-sales', views.BatchSaleViewSet, basename='batchsale')

urlpatterns = [
    path('', include(router.urls)),
    path('token/', views.TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('user/', views.UserInfoView.as_view(), name='user_info'),
    path('users/', views.UserListView.as_view(), name='user-list'),
    path('dashboard/stats/', views.DashboardStatsView.as_view(), name='dashboard-stats'),
    path('reports/sales/', views.SalesReportView.as_view(), name='sales-report'),
    path('reports/inventory-value/', views.InventoryValueReportView.as_view(), name='inventory-value-report'),
    path('login/', views.login_view, name='login'),  # Legacy login if needed
]