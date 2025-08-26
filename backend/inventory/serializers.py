from rest_framework import serializers
from .models import (
    Item, Brand, Customer, Transaction, InventoryChange, 
    Account, ItemPricing, InventoryBatch, CustomerSpecialPrice, BatchSale
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
    class Meta:
        model = Customer
        fields = '__all__'
        read_only_fields = ['customer_id', 'created_at']

class ItemPricingSerializer(serializers.ModelSerializer):
    # Read-only fields for easier access
    tier_prices = serializers.SerializerMethodField()
    pricing_hierarchy_valid = serializers.SerializerMethodField()
    
    class Meta:
        model = ItemPricing
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

    def get_tier_prices(self, obj):
        """Return all tier prices in a structured format"""
        return {
            'RD': float(obj.regional_distributor),
            'PD': float(obj.provincial_distributor),
            'DD': float(obj.district_distributor),
            'CD': float(obj.city_distributor),
            'RS': float(obj.reseller),
            'SUB': float(obj.sub_reseller),
            'SRP': float(obj.srp),
        }
    
    def get_pricing_hierarchy_valid(self, obj):
        """Check if pricing hierarchy is valid"""
        is_valid, message = obj.validate_pricing_hierarchy()
        return {
            'is_valid': is_valid,
            'message': message
        }
    
    def validate(self, data):
        """Validate the entire pricing structure"""
        # Create a temporary ItemPricing object to validate hierarchy
        temp_pricing = ItemPricing(**data)
        is_valid, message = temp_pricing.validate_pricing_hierarchy()
        
        if not is_valid:
            raise serializers.ValidationError({
                'pricing_hierarchy': message
            })
        
        return data

class InventoryBatchSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.item_name', read_only=True)
    is_expired = serializers.BooleanField(read_only=True)
    days_to_expiry = serializers.IntegerField(read_only=True)
    quantity_sold = serializers.IntegerField(read_only=True)
    effective_cost_price = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    can_sell_at_tier = serializers.ReadOnlyField()
    batch_status_display = serializers.CharField(source='get_batch_status_display', read_only=True)
    
    class Meta:
        model = InventoryBatch
        fields = '__all__'
        read_only_fields = ['batch_id', 'created_at', 'updated_at', 'quantity_sold']

    def validate_batch_number(self, value):
        """Ensure batch number is unique per item"""
        item = self.initial_data.get('item') or (self.instance.item if self.instance else None)
        if item:
            existing = InventoryBatch.objects.filter(
                item=item, 
                batch_number=value
            ).exclude(pk=self.instance.pk if self.instance else None)
            
            if existing.exists():
                raise serializers.ValidationError(
                    f"Batch number '{value}' already exists for this item"
                )
        return value
    
    def validate_quantity_available(self, value):
        """Ensure quantity available is not negative"""
        if value < 0:
            raise serializers.ValidationError("Available quantity cannot be negative")
        return value
    
    def validate(self, data):
        """Validate batch data"""
        # Check if initial quantity is greater than or equal to available + reserved
        if 'initial_quantity' in data and 'quantity_available' in data:
            quantity_reserved = data.get('quantity_reserved', 0)
            if data['initial_quantity'] < (data['quantity_available'] + quantity_reserved):
                raise serializers.ValidationError({
                    'initial_quantity': 'Initial quantity must be greater than or equal to available + reserved quantity'
                })
        
        return data

class ItemSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source='brand.brand_name', read_only=True)
    brand_id = serializers.IntegerField(source='brand.brand_id', read_only=True)
    
    # Pricing information
    pricing = ItemPricingSerializer(read_only=True)
    has_pricing = serializers.SerializerMethodField()
    
    # Batch information
    active_batches = serializers.SerializerMethodField()
    total_available_quantity = serializers.SerializerMethodField()
    
    # User-specific pricing info
    available_selling_prices = serializers.SerializerMethodField()
    
    class Meta:
        model = Item
        fields = [
            'item_id', 'item_name', 'model_number', 'item_type', 'category',
            'quantity', 'threshold_value', 'brand', 'brand_name', 'brand_id',
            'availability_status', 'created_at', 'updated_at',
            'pricing', 'has_pricing', 'active_batches', 'total_available_quantity',
            'available_selling_prices'
        ]
        read_only_fields = ['item_id', 'created_at', 'updated_at', 'brand_name', 'brand_id']

    def get_has_pricing(self, obj):
        """Check if item has pricing configured"""
        return hasattr(obj, 'pricing')
    
    def get_active_batches(self, obj):
        """Get count of active batches for this item"""
        return obj.batches.filter(batch_status='Active', quantity_available__gt=0).count()
    
    def get_total_available_quantity(self, obj):
        """Get total available quantity across all batches"""
        return sum(batch.quantity_available for batch in obj.batches.filter(batch_status='Active'))
    
    def get_available_selling_prices(self, obj):
        """Get available selling prices for the current user"""
        request = self.context.get('request')
        if not request or not request.user:
            return {}
        
        user = request.user
        if not hasattr(obj, 'pricing'):
            return {}
        
        pricing = obj.pricing
        allowed_tiers = user.get_allowed_selling_tiers()
        
        available_prices = {}
        tier_names = {
            'RD': 'Regional Distributor',
            'PD': 'Provincial Distributor', 
            'DD': 'District Distributor',
            'CD': 'City Distributor',
            'RS': 'Reseller',
            'SUB': 'Sub-Reseller',
            'SRP': 'Suggested Retail Price'
        }
        
        for tier in allowed_tiers:
            price = pricing.get_price_for_tier(tier)
            if price > 0:  # Only include non-zero prices
                available_prices[tier] = {
                    'price': float(price),
                    'tier_name': tier_names.get(tier, tier)
                }
        
        return available_prices

    def validate_item_type(self, value):
        """Validate item_type field"""
        valid_types = [
            "Skincare Products", "Makeup Products", "Hair Care Products",
            "Fragrance Products", "Body Care Products", "Beauty Tools & Accessories"
        ]
        if value not in valid_types:
            raise serializers.ValidationError(f"Invalid item type. Must be one of: {', '.join(valid_types)}")
        return value
    
    def validate_category(self, value):
        """Validate category field"""
        valid_categories = [
            "Premium Brand", "Drugstore Brand", "Organic/Natural",
            "Korean Beauty", "Luxury Collection", "Professional Use"
        ]
        if value not in valid_categories:
            raise serializers.ValidationError(f"Invalid category. Must be one of: {', '.join(valid_categories)}")
        return value
    
    def validate_threshold_value(self, value):
        """Validate threshold_value"""
        if value < 0:
            raise serializers.ValidationError("Threshold value cannot be negative")
        if value > 32767:
            raise serializers.ValidationError("Threshold value cannot exceed 32767")
        return value

class CustomerSpecialPriceSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='customer.company_name', read_only=True)
    item_name = serializers.CharField(source='item.item_name', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    approved_by_username = serializers.CharField(source='approved_by.username', read_only=True)
    
    class Meta:
        model = CustomerSpecialPrice
        fields = '__all__'
        read_only_fields = ['created_at', 'approved_at']

class InventoryChangeSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.item_name', read_only=True)
    batch_number = serializers.CharField(source='batch.batch_number', read_only=True)
    price_tier_display = serializers.CharField(source='get_price_tier_display', read_only=True)
    change_type_display = serializers.CharField(source='get_change_type_display', read_only=True)
    
    class Meta:
        model = InventoryChange
        fields = '__all__'
        read_only_fields = ['profit_amount', 'profit_margin_percentage', 'created_at']

    def validate(self, data):
        """Validate inventory change data"""
        # Auto-calculate total_price if not provided
        if 'unit_price' in data and 'quantity_change' in data:
            data['total_price'] = data['unit_price'] * abs(data['quantity_change'])
        
        return data

class BatchSaleSerializer(serializers.ModelSerializer):
    batch_number = serializers.CharField(source='batch.batch_number', read_only=True)
    item_name = serializers.CharField(source='batch.item.item_name', read_only=True)
    
    class Meta:
        model = BatchSale
        fields = '__all__'
        read_only_fields = ['profit_per_unit', 'total_profit', 'created_at']

class TransactionItemSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.item_name', read_only=True)
    
    class Meta:
        model = Item
        fields = ['item_id', 'item_name', 'model_number', 'quantity', 'availability_status']

class TransactionSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source='brand.brand_name', read_only=True)
    customer_name_display = serializers.CharField(source='customer.company_name', read_only=True)
    account_username = serializers.CharField(source='account.username', read_only=True)
    current_brand_name = serializers.CharField(source='current_brand.brand_name', read_only=True)
    
    inventory_changes = InventoryChangeSerializer(many=True, read_only=True, source='inventorychange_set')
    
    # Add items field with detailed information for frontend compatibility
    items = serializers.SerializerMethodField()
    
    # Format dates with Philippine timezone
    transacted_date_formatted = serializers.SerializerMethodField()
    created_at_formatted = serializers.SerializerMethodField()
    
    class Meta:
        model = Transaction
        fields = '__all__'
        read_only_fields = ['transaction_id', 'transacted_date', 'created_at']
    
    def get_items(self, obj):
        """Get detailed item information for frontend"""
        items_data = []
        for change in obj.inventorychange_set.all():
            item_data = {
                'item': change.item.item_id,
                'item_id': change.item.item_id,
                'item_name': change.item.item_name,
                'model_number': change.item.model_number,
                'quantity_change': change.quantity_change,
                'requested_quantity': change.requested_quantity,
                'current_stock': change.item.quantity,  # Add current stock
                'brand_name': change.item.brand.brand_name if change.item.brand else None,
                'unit_price': float(change.unit_price) if change.unit_price else 0,
                'total_price': float(change.total_price) if change.total_price else 0,
                'batch_number': change.batch.batch_number if change.batch else None,
                'cost_price': float(change.batch.cost_price) if change.batch else None,
                'expiry_date': change.batch.expiry_date.isoformat() if change.batch and change.batch.expiry_date else None,
            }
            items_data.append(item_data)
        return items_data
    
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
        fields = '__all__'
        read_only_fields = ['transaction_id', 'transacted_date', 'created_at']
    
    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        
        # Create the transaction
        transaction = Transaction.objects.create(**validated_data)
        
        # Process each item
        for item_data in items_data:
            item_id = item_data['item']
            quantity_change = item_data['quantity_change']
            
            try:
                item = Item.objects.get(pk=item_id)
            except Item.DoesNotExist:
                raise serializers.ValidationError(f'Item with id {item_id} does not exist')
            
            # For receive transactions, create batch and inventory change
            if transaction.transaction_type == 'Receive Products':
                # Ensure quantity_change is positive for receive transactions
                quantity_change = abs(quantity_change)
                
                # Extract batch data
                batch_number = item_data.get('batch_number')
                cost_price = item_data.get('cost_price')
                expiry_date = item_data.get('expiry_date')
                
                if not batch_number:
                    raise serializers.ValidationError(f'Batch number is required for receive transactions')
                if not cost_price:
                    raise serializers.ValidationError(f'Cost price is required for receive transactions')
                
                # Check if batch number already exists for this item
                existing_batch = InventoryBatch.objects.filter(
                    item=item, 
                    batch_number=batch_number
                ).first()
                
                if existing_batch:
                    raise serializers.ValidationError(f'Batch number {batch_number} already exists for item {item.item_name}')
                
                # Create the inventory batch
                batch = InventoryBatch.objects.create(
                    item=item,
                    batch_number=batch_number,
                    cost_price=cost_price,
                    cost_tier='SUB',  # Default tier, can be made configurable
                    initial_quantity=quantity_change,
                    quantity_available=quantity_change,
                    quantity_reserved=0,
                    expiry_date=expiry_date if expiry_date else None,
                    purchase_date=transaction.transacted_date,
                    batch_status='Active',
                    created_by=transaction.account,
                    notes=f'Created from transaction {transaction.reference_number}'
                )
                
                # Create inventory change linked to the batch
                inventory_change = InventoryChange.objects.create(
                    item=item,
                    batch=batch,
                    transaction=transaction,
                    quantity_change=quantity_change,
                    unit_price=cost_price,
                    total_price=cost_price * quantity_change,
                    unit_cost=cost_price,
                    change_type='PURCHASE',
                    notes=f'Received into batch {batch_number}'
                )
                
                # Update item quantity
                item.quantity += quantity_change
                if item.quantity > item.threshold_value:
                    item.availability_status = 'In Stock'
                elif item.quantity <= item.threshold_value and item.quantity > 0:
                    item.availability_status = 'Low Stock'
                else:
                    item.availability_status = 'Out of Stock'
                item.save()
                
            else:
                # For dispatch transactions, ensure quantity_change is negative
                if transaction.transaction_type == 'Dispatch goods':
                    quantity_change = -abs(quantity_change)
                
                # For other transaction types, create basic inventory change
                inventory_change = InventoryChange.objects.create(
                    item=item,
                    transaction=transaction,
                    quantity_change=quantity_change,
                    change_type='SALE' if transaction.transaction_type == 'Dispatch goods' else 'ADJUSTMENT'
                )
                
                # Update item quantity for dispatch
                if transaction.transaction_type == 'Dispatch goods':
                    item.quantity += quantity_change  # quantity_change is now negative
                    if item.quantity > item.threshold_value:
                        item.availability_status = 'In Stock'
                    elif item.quantity <= item.threshold_value and item.quantity > 0:
                        item.availability_status = 'Low Stock'
                    else:
                        item.availability_status = 'Out of Stock'
                    item.save()
        
        return transaction

class InventoryChangeWithTransactionSerializer(serializers.ModelSerializer):
    transaction = TransactionSerializer(read_only=True)
    item_name = serializers.CharField(source='item.item_name', read_only=True)
    
    class Meta:
        model = InventoryChange
        fields = '__all__'

class UserProfileUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, required=False)
    last_name = serializers.CharField(max_length=150, required=False)
    current_password = serializers.CharField(write_only=True, required=False)
    new_password = serializers.CharField(write_only=True, required=False)
    confirm_password = serializers.CharField(write_only=True, required=False)
    
    def validate(self, data):
        user = self.context['request'].user
        # Password change requested
        if data.get('new_password') or data.get('confirm_password'):
            if not data.get('current_password'):
                raise serializers.ValidationError({'current_password': 'Current password is required.'})
            if not user.check_password(data['current_password']):
                raise serializers.ValidationError({'current_password': 'Current password is incorrect.'})
            if data.get('new_password') != data.get('confirm_password'):
                raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
            if len(data.get('new_password', '')) < 8:
                raise serializers.ValidationError({'new_password': 'New password must be at least 8 characters.'})
        return data