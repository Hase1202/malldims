from rest_framework import serializers
from .models import (
    Item, Brand, Customer, Transaction, TransactionItem, Account, 
    CustomerBrandPricing, ItemTierPricing, CustomerSpecialPricing
)
from django.utils import timezone
import pytz

class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = ['account_id', 'username', 'role', 'first_name', 'last_name', 'email']
        read_only_fields = ['account_id']

class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = '__all__'
        read_only_fields = ['brand_id']

class CustomerSerializer(serializers.ModelSerializer):
    platform_display = serializers.CharField(source='get_platform_display', read_only=True)
    
    class Meta:
        model = Customer
        fields = '__all__'
        read_only_fields = ['customer_id', 'created_at']

class CustomerBrandPricingSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.company_name', read_only=True)
    brand_name = serializers.CharField(source='brand.brand_name', read_only=True)
    pricing_tier_display = serializers.CharField(source='get_pricing_tier_display', read_only=True)
    
    class Meta:
        model = CustomerBrandPricing
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

class ItemTierPricingSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.item_name', read_only=True)
    pricing_tier_display = serializers.CharField(source='get_pricing_tier_display', read_only=True)
    
    class Meta:
        model = ItemTierPricing
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

class CustomerSpecialPricingSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.company_name', read_only=True)
    item_name = serializers.CharField(source='item.item_name', read_only=True)
    
    class Meta:
        model = CustomerSpecialPricing
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

class ItemSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source='brand.brand_name', read_only=True)
    brand_id = serializers.IntegerField(source='brand.brand_id', read_only=True)
    uom_display = serializers.CharField(source='get_uom_display', read_only=True)
    
    # Pricing information from new structure
    tier_pricing = ItemTierPricingSerializer(many=True, read_only=True)
    
    class Meta:
        model = Item
        fields = [
            'item_id', 'brand', 'brand_name', 'brand_id', 'item_name', 
            'model_number', 'sku', 'uom', 'uom_display', 'quantity',
            'created_at', 'updated_at', 'tier_pricing'
        ]
        read_only_fields = ['item_id', 'created_at', 'updated_at', 'brand_name', 'brand_id']

class TransactionItemSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.item_name', read_only=True)
    pricing_tier_display = serializers.CharField(source='get_pricing_tier_display', read_only=True)
    
    class Meta:
        model = TransactionItem
        fields = '__all__'
        read_only_fields = ['created_at']

class TransactionSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source='brand.brand_name', read_only=True)
    customer_name_display = serializers.CharField(source='customer.company_name', read_only=True)
    account_username = serializers.CharField(source='account.username', read_only=True)
    transaction_type_display = serializers.CharField(source='get_transaction_type_display', read_only=True)
    
    # Include transaction items
    items = TransactionItemSerializer(many=True, read_only=True)
    
    # Include computed property
    is_completed = serializers.ReadOnlyField()
    
    # Format dates with Philippine timezone
    transacted_date_formatted = serializers.SerializerMethodField()
    created_at_formatted = serializers.SerializerMethodField()
    
    class Meta:
        model = Transaction
        fields = '__all__'
        read_only_fields = ['transaction_id', 'transacted_date', 'created_at']
    
    def get_transacted_date_formatted(self, obj):
        ph_tz = pytz.timezone('Asia/Manila')
        ph_date = timezone.make_aware(
            timezone.datetime.combine(obj.transacted_date, timezone.datetime.min.time())
        ).astimezone(ph_tz)
        return ph_date.strftime('%B %d, %Y')
    
    def get_created_at_formatted(self, obj):
        ph_tz = pytz.timezone('Asia/Manila')
        ph_datetime = obj.created_at.astimezone(ph_tz)
        return ph_datetime.strftime('%B %d, %Y, %I:%M %p')

class TransactionCreateSerializer(serializers.ModelSerializer):
    items = serializers.ListField(write_only=True)
    
    class Meta:
        model = Transaction
        fields = [
            'brand', 'customer', 'account', 'transaction_type', 
            'is_released', 'is_paid', 'is_or_sent', 'vat_type',
            'total_amount', 'vat_amount', 'due_date', 'reference_number', 
            'notes', 'items'
        ]
    
    def create(self, validated_data):
        items_data = validated_data.pop('items')
        transaction = Transaction.objects.create(**validated_data)
        
        # Create transaction items
        for item_data in items_data:
            TransactionItem.objects.create(
                transaction=transaction,
                **item_data
            )
        
        return transaction
