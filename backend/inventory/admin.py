from django.contrib import admin
from .models import (
    Account, Brand, Customer, Item, ItemPricing, 
    InventoryBatch, CustomerSpecialPrice, Transaction, InventoryChange
)

@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ('account_id', 'username', 'first_name', 'last_name', 'role', 'is_active', 'date_joined')
    list_filter = ('role', 'is_active', 'date_joined')
    search_fields = ('username', 'first_name', 'last_name', 'email')
    ordering = ('-date_joined',)
    
    fieldsets = (
        ('User Information', {
            'fields': ('username', 'first_name', 'last_name', 'email')
        }),
        ('Business Information', {
            'fields': ('role',)
        }),
        ('Permissions', {
            'fields': ('is_active', 'is_staff', 'is_superuser')
        }),
        ('Important dates', {
            'fields': ('last_login', 'date_joined')
        }),
    )
    
    readonly_fields = ('date_joined', 'last_login')

@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = [
        'brand_name', 
        'contact_person', 
        'mobile_number', 
        'email', 
        'status'
    ]
    list_filter = [
        'status',
        'vat_classification',
        'region'
    ]
    search_fields = [
        'brand_name', 
        'contact_person', 
        'email',
        'tin'
    ]
    ordering = ['brand_name']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('brand_name', 'contact_person', 'mobile_number', 'landline_number', 'email')
        }),
        ('Address', {
            'fields': ('street_number', 'street_name', 'city', 'barangay', 'region', 'postal_code')
        }),
        ('Business Details', {
            'fields': ('tin', 'vat_classification', 'status')
        })
    )

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('customer_id', 'company_name', 'contact_person', 'customer_type', 'pricing_tier', 'status')
    list_filter = ('customer_type', 'pricing_tier', 'status', 'created_at')
    search_fields = ('company_name', 'contact_person', 'contact_number', 'tin_id')
    ordering = ('-created_at',)
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('company_name', 'contact_person', 'status')
        }),
        ('Contact Information', {
            'fields': ('address', 'contact_number')
        }),
        ('Business Information', {
            'fields': ('customer_type', 'pricing_tier', 'tin_id')
        }),
    )
    
    readonly_fields = ('created_at',)

@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = [
        'item_name', 
        'model_number', 
        'item_type', 
        'category', 
        'quantity', 
        'threshold_value', 
        'get_brand_name',  # Custom method to display brand name
        'availability_status',
        'created_at'
    ]
    list_filter = [
        'item_type', 
        'category', 
        'availability_status',
        'brand',
        'created_at'
    ]
    search_fields = [
        'item_name', 
        'model_number', 
        'brand__brand_name'
    ]
    list_editable = ['quantity', 'threshold_value']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']
    
    def get_brand_name(self, obj):
        """Display brand name in list view"""
        return obj.brand.brand_name if obj.brand else 'No Brand'
    get_brand_name.short_description = 'Brand'
    get_brand_name.admin_order_field = 'brand__brand_name'

@admin.register(ItemPricing)
class ItemPricingAdmin(admin.ModelAdmin):
    list_display = ('item', 'regional_distributor', 'provincial_distributor', 'reseller', 'srp')
    search_fields = ('item__item_name', 'item__model_number')
    ordering = ('item__item_name',)
    
    fieldsets = (
        ('Item', {
            'fields': ('item',)
        }),
        ('Distributor Pricing', {
            'fields': ('regional_distributor', 'provincial_distributor', 'district_distributor', 'city_distributor')
        }),
        ('Retail Pricing', {
            'fields': ('reseller', 'sub_reseller', 'srp')
        }),
    )

@admin.register(InventoryBatch)
class InventoryBatchAdmin(admin.ModelAdmin):
    list_display = ('batch_id', 'item', 'cost_price', 'cost_tier', 'quantity_available', 'expiry_date', 'purchase_date')
    list_filter = ('cost_tier', 'purchase_date', 'expiry_date')
    search_fields = ('item__item_name', 'purchase_order_ref')
    ordering = ('-purchase_date',)
    
    fieldsets = (
        ('Batch Information', {
            'fields': ('item', 'cost_price', 'cost_tier', 'quantity_available')
        }),
        ('Purchase Details', {
            'fields': ('purchase_order_ref', 'purchase_date', 'discount_applied')
        }),
        ('Expiry Information', {
            'fields': ('expiry_date',)
        }),
    )

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('transaction_id', 'get_brand', 'customer', 'account', 'transaction_type', 'transaction_status', 'total_amount', 'transacted_date')
    list_filter = ('transaction_status', 'transaction_type', 'payment_status', 'vat_type', 'transacted_date')
    search_fields = ('reference_number', 'customer_name', 'brand__brand_name', 'account__username')
    ordering = ('-transacted_date',)
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('brand', 'customer', 'account', 'reference_number')
        }),
        ('Transaction Details', {
            'fields': ('transaction_type', 'transaction_status', 'priority_status')
        }),
        ('Financial Information', {
            'fields': ('total_amount', 'vat_amount', 'vat_type', 'payment_status', 'is_receipt_issued')
        }),
        ('Customer Information', {
            'fields': ('customer_name',)
        }),
        ('Dates', {
            'fields': ('due_date',)
        }),
        ('Additional Information', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ('transacted_date', 'created_at')
    
    def get_brand(self, obj):
        return obj.current_brand
    get_brand.short_description = 'Brand'

@admin.register(InventoryChange)
class InventoryChangeAdmin(admin.ModelAdmin):
    list_display = [
        'item', 
        'quantity_change', 
        'unit_price',
        'total_price',
        'price_tier',
        'notes'
    ]
    list_filter = [
        'price_tier', 
        'item__item_type',
        'item__brand',
        'transaction__transaction_type'
    ]
    search_fields = [
        'item__item_name', 
        'item__brand__brand_name',
        'notes'
    ]
    ordering = ['-transaction__transacted_date']
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('item', 'item__brand', 'transaction')

@admin.register(CustomerSpecialPrice)
class CustomerSpecialPriceAdmin(admin.ModelAdmin):
    list_display = ('customer', 'item', 'special_price', 'is_approved', 'created_by', 'created_at')
    list_filter = ('is_approved', 'created_at', 'approved_at')
    search_fields = ('customer__company_name', 'item__item_name', 'created_by__username')
    
    fieldsets = (
        ('Price Information', {
            'fields': ('customer', 'item', 'special_price')
        }),
        ('Approval', {
            'fields': ('is_approved', 'approved_by', 'approved_at')
        }),
        ('Audit', {
            'fields': ('created_by',)
        }),
    )
    
    readonly_fields = ('created_at', 'approved_at')