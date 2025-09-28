from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

router = DefaultRouter()
router.register(r'accounts', views.AccountViewSet, basename='account')
router.register(r'items', views.ItemViewSet, basename='item')
router.register(r'brands', views.BrandViewSet, basename='brand')
router.register(r'customers', views.CustomerViewSet, basename='customer')
router.register(r'transactions', views.TransactionViewSet, basename='transaction')
router.register(r'transaction-items', views.TransactionItemViewSet, basename='transactionitem')
router.register(r'customer-brand-pricing', views.CustomerBrandPricingViewSet, basename='customerbrandpricing')
router.register(r'item-tier-pricing', views.ItemTierPricingViewSet, basename='itemtierpricing')
router.register(r'customer-special-pricing', views.CustomerSpecialPricingViewSet, basename='customerspecialpricing')
router.register(r'inventory-batches', views.ItemBatchViewSet, basename='itembatch')

urlpatterns = [
    path('', include(router.urls)),
    path('token/', views.CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('user/', views.UserInfoView.as_view(), name='user_info'),
    path('users/', views.UsersListView.as_view(), name='users_list'),
    path('dashboard/stats/', views.DashboardStatsView.as_view(), name='dashboard-stats'),
    path('reports/', views.ReportView.as_view(), name='reports'),
    path('pricing-utils/', views.PricingUtilsView.as_view(), name='pricing-utils'),
    path('login/', views.login_view, name='login'),  # Legacy login if needed
]