from django.contrib import admin
from .models import (
    Account, Brand, Customer, Item, CustomerBrandPricing, 
    ItemTierPricing, CustomerSpecialPricing, Transaction, TransactionItem, ItemBatch
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
            'fields': ('is_active', 'is_staff', 'is_superuser'),
            'classes': ('collapse',)
        }),
        ('Important dates', {
            'fields': ('last_login', 'date_joined'),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ('date_joined', 'last_login')

@admin.register(Brand)
class BrandAdmin(admin.ModelAdmin):
    list_display = ('brand_id', 'brand_name', 'vat_classification', 'status', 'contact_person', 'mobile_number')
    list_filter = ('vat_classification', 'status', 'region')
    search_fields = ('brand_name', 'contact_person', 'email', 'tin')
    ordering = ('brand_name',)
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('brand_name', 'status', 'vat_classification')
        }),
        ('Address', {
            'fields': ('street_number', 'street_name', 'barangay', 'city', 'region', 'postal_code')
        }),
        ('Contact Information', {
            'fields': ('contact_person', 'mobile_number', 'landline_number', 'email')
        }),
        ('Tax Information', {
            'fields': ('tin',)
        }),
    )

@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ('customer_id', 'company_name', 'contact_person', 'customer_type', 'platform', 'status')
    list_filter = ('customer_type', 'platform', 'status')
    search_fields = ('company_name', 'contact_person', 'contact_number', 'tin_id')
    ordering = ('company_name',)
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('company_name', 'customer_type', 'status')
        }),
        ('Contact Information', {
            'fields': ('contact_person', 'contact_number', 'platform', 'address')
        }),
        ('Tax Information', {
            'fields': ('tin_id',)
        }),
    )

@admin.register(CustomerBrandPricing)
class CustomerBrandPricingAdmin(admin.ModelAdmin):
    list_display = ('customer', 'brand', 'pricing_tier', 'created_at')
    list_filter = ('pricing_tier', 'brand')
    search_fields = ('customer__company_name', 'brand__brand_name')
    ordering = ('customer__company_name', 'brand__brand_name')
    
    autocomplete_fields = ['customer', 'brand']

@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ('item_id', 'item_name', 'brand', 'uom', 'get_total_quantity', 'get_active_batches_count', 'sku')
    list_filter = ('brand', 'uom')
    search_fields = ('item_name', 'sku')
    ordering = ('item_name',)
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('brand', 'item_name', 'sku')
        }),
        ('Specifications', {
            'fields': ('uom',)
        }),
    )
    
    def get_total_quantity(self, obj):
        return obj.total_quantity
    get_total_quantity.short_description = 'Total Quantity'
    
    def get_active_batches_count(self, obj):
        return obj.active_batches_count
    get_active_batches_count.short_description = 'Active Batches'
    
    autocomplete_fields = ['brand']

@admin.register(ItemBatch)
class ItemBatchAdmin(admin.ModelAdmin):
    list_display = ('item', 'batch_number', 'cost_price', 'initial_quantity', 'remaining_quantity', 'created_at')
    list_filter = ('item__brand', 'created_at')
    search_fields = ('item__item_name', 'item__sku', 'batch_number')
    ordering = ('item__item_name', 'batch_number')
    
    fieldsets = (
        ('Batch Information', {
            'fields': ('item', 'batch_number', 'transaction')
        }),
        ('Pricing & Quantities', {
            'fields': ('cost_price', 'initial_quantity', 'remaining_quantity')
        }),
    )
    
    readonly_fields = ('batch_number',)
    autocomplete_fields = ['item', 'transaction']

@admin.register(ItemTierPricing)
class ItemTierPricingAdmin(admin.ModelAdmin):
    list_display = ('item', 'pricing_tier', 'price', 'created_at')
    list_filter = ('pricing_tier', 'item__brand')
    search_fields = ('item__item_name', 'item__sku')
    ordering = ('item__item_name', 'pricing_tier')
    
    autocomplete_fields = ['item']

@admin.register(CustomerSpecialPricing)
class CustomerSpecialPricingAdmin(admin.ModelAdmin):
    list_display = ('customer', 'item', 'discount', 'created_by', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('customer__company_name', 'item__item_name')
    ordering = ('-created_at',)
    
    autocomplete_fields = ['customer', 'item', 'created_by']

class TransactionItemInline(admin.TabularInline):
    model = TransactionItem
    extra = 0
    autocomplete_fields = ['item']

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = (
        'transaction_id', 'brand', 'customer', 'transaction_type', 
        'is_completed', 'total_amount', 'transacted_date'
    )
    list_filter = (
        'transaction_type', 'is_released', 'is_paid', 'is_or_sent',
        'vat_type', 'transacted_date'
    )
    search_fields = (
        'reference_number', 'customer__company_name', 
        'brand__brand_name', 'notes'
    )
    ordering = ('-transacted_date', '-created_at')
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('brand', 'customer', 'account', 'transaction_type')
        }),
        ('Status Information (for OUTGOING only)', {
            'fields': ('is_released', 'is_paid', 'is_or_sent'),
            'description': 'These fields are only relevant for OUTGOING transactions'
        }),
        ('Financial Information', {
            'fields': ('vat_type', 'total_amount', 'vat_amount')
        }),
        ('Additional Information', {
            'fields': ('due_date', 'reference_number', 'notes')
        }),
    )
    
    autocomplete_fields = ['brand', 'customer', 'account']
    inlines = [TransactionItemInline]
    
    readonly_fields = ['is_completed']

@admin.register(TransactionItem)
class TransactionItemAdmin(admin.ModelAdmin):
    list_display = ('transaction', 'item', 'quantity', 'unit_price', 'total_price', 'pricing_tier')
    list_filter = ('pricing_tier', 'transaction__transaction_type')
    search_fields = ('transaction__reference_number', 'item__item_name')
    ordering = ('-created_at',)
    
    autocomplete_fields = ['transaction', 'item']
