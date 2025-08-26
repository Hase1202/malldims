from django.core.validators import RegexValidator
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

# Pricing tier choices - shared across models
PRICING_TIER_CHOICES = [
    ('RD', 'Regional Distributor'),
    ('PD', 'Provincial Distributor'),
    ('DD', 'District Distributor'),
    ('CD', 'City Distributor'),
    ('RS', 'Reseller'),
    ('SUB', 'Sub-Reseller'),
    ('SRP', 'Suggested Retail Price'),
]

class Account(AbstractUser):
    account_id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=30, unique=True)
    role = models.CharField(max_length=20, choices=[
        ('Admin', 'Admin'),
        ('Leader', 'Leader'), 
        ('Sales Rep', 'Sales Rep'),
    ])

    class Meta:
        db_table = 'account'
    
    def __str__(self):
        return f"{self.username} ({self.role})"
    
    def get_allowed_selling_tiers(self):
        """
        Get the tiers a user can sell at.
        Since cost tiers were removed, all users can access all selling tiers.
        """
        return ['RD', 'PD', 'DD', 'CD', 'RS', 'SUB', 'SRP']

# Brand model for beauty products
class Brand(models.Model):
    VAT_CHOICES = [
        ('VAT', 'VAT-inclusive'),
        ('NON_VAT', 'NON-VAT'),
        ('BOTH', 'Both VAT and NON-VAT'),
    ]
    
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Archived', 'Archived'),
    ]
    
    brand_id = models.AutoField(primary_key=True)
    brand_name = models.CharField(max_length=100)
    street_number = models.CharField(max_length=20, blank=True, null=True)
    street_name = models.CharField(max_length=100, blank=True, null=True)
    city = models.CharField(max_length=50, blank=True, null=True)
    barangay = models.CharField(max_length=50, blank=True, null=True)
    region = models.CharField(max_length=50, blank=True, null=True)
    postal_code = models.CharField(max_length=10, blank=True, null=True)
    tin = models.CharField(max_length=20, blank=True, null=True, verbose_name="TIN ID")
    landline_number = models.CharField(max_length=20, blank=True, null=True)
    contact_person = models.CharField(max_length=100, blank=True, null=True)
    mobile_number = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    vat_classification = models.CharField(
        max_length=20, 
        choices=VAT_CHOICES, 
        default='VAT',
        help_text="VAT classification for tax purposes"
    )
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES, 
        default='Active'
    )
    
    class Meta:
        db_table = 'inventory_brand'
        ordering = ['brand_name']
        
    def __str__(self):
        return f"{self.brand_name} ({self.get_vat_classification_display()})"

# New Customer model for beauty distribution
class Customer(models.Model):
    customer_id = models.AutoField(primary_key=True)
    company_name = models.CharField(max_length=100)
    contact_person = models.CharField(max_length=50)
    address = models.TextField()
    contact_number = models.CharField(max_length=15)
    tin_id = models.CharField(max_length=15, null=True, blank=True)
    
    customer_type = models.CharField(
        max_length=20,
        choices=[
            ('International', 'International'),
            ('Distributor', 'Distributor'),
            ('Physical Store', 'Physical Store'),
            ('Reseller', 'Reseller'),
            ('Direct Customer', 'Direct Customer')
        ]
    )
    
    # Customer's pricing tier
    pricing_tier = models.CharField(
        max_length=3,
        choices=PRICING_TIER_CHOICES,
        default='SRP',
        help_text="The pricing tier this customer is eligible for"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=10,
        choices=[('Active', 'Active'), ('Archived', 'Archived')],
        default='Active'
    )

    class Meta:
        db_table = 'customer'

    def __str__(self):
        return self.company_name

class Item(models.Model):
    item_id = models.AutoField(primary_key=True)
    item_name = models.CharField(max_length=100)
    model_number = models.CharField(max_length=50)
    item_type = models.CharField(max_length=50)
    category = models.CharField(max_length=50)
    quantity = models.SmallIntegerField()
    threshold_value = models.SmallIntegerField()
    brand = models.ForeignKey(Brand, on_delete=models.CASCADE)
    availability_status = models.CharField(max_length=20, default='In Stock')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.item_name} ({self.model_number})"

    class Meta:
        db_table = 'inventory_item'
        unique_together = ['item_name', 'model_number', 'brand']  # Use brand for uniqueness
    
    @property
    def current_brand(self):
        """Get current brand"""
        return self.brand

# Multi-tier pricing model for beauty products
class ItemPricing(models.Model):
    item = models.OneToOneField(Item, on_delete=models.CASCADE, related_name='pricing')
    
    # All 7 pricing tiers
    regional_distributor = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        verbose_name="Regional Distributor (RD) Price",
        help_text="Highest tier price - for regional distributors"
    )
    provincial_distributor = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        verbose_name="Provincial Distributor (PD) Price",
        help_text="Second tier price - for provincial distributors"
    )
    district_distributor = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        verbose_name="District Distributor (DD) Price",
        help_text="Third tier price - for district distributors"
    )
    city_distributor = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        verbose_name="City Distributor (CD) Price",
        help_text="Fourth tier price - for city distributors"
    )
    reseller = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        verbose_name="Reseller (RS) Price",
        help_text="Fifth tier price - for resellers"
    )
    sub_reseller = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        verbose_name="Sub-Reseller (Sub-RS) Price",
        help_text="Sixth tier price - for sub-resellers"
    )
    srp = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        verbose_name="Suggested Retail Price (SRP)",
        help_text="Lowest tier price - suggested retail price for end customers"
    )
    
    # Metadata
    is_active = models.BooleanField(default=True, help_text="Whether this pricing is currently active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'item_pricing'
        verbose_name = "Item Pricing"
        verbose_name_plural = "Item Pricing"

    def __str__(self):
        return f"Pricing for {self.item.item_name}"

    def get_price_for_tier(self, tier):
        """Get price for specific tier"""
        tier_mapping = {
            'RD': self.regional_distributor,
            'PD': self.provincial_distributor,
            'DD': self.district_distributor,
            'CD': self.city_distributor,
            'RS': self.reseller,
            'SUB': self.sub_reseller,
            'SRP': self.srp,
        }
        return tier_mapping.get(tier, self.srp)
    
    def get_allowed_selling_tiers(self, user_cost_tier):
        """
        Get the tiers a user can sell at based on their cost tier.
        Rule: Users can only sell at tiers below their own cost tier.
        """
        tier_hierarchy = ['RD', 'PD', 'DD', 'CD', 'RS', 'SUB', 'SRP']
        
        try:
            user_tier_index = tier_hierarchy.index(user_cost_tier)
            # Return tiers below the user's tier (excluding their own tier)
            allowed_tiers = tier_hierarchy[user_tier_index + 1:]
            return allowed_tiers
        except ValueError:
            # If user tier not found, default to SRP only
            return ['SRP']
    
    def validate_pricing_hierarchy(self):
        """Validate that prices follow the hierarchy (RD >= PD >= DD >= CD >= RS >= SUB >= SRP)"""
        prices = [
            self.regional_distributor,
            self.provincial_distributor,
            self.district_distributor,
            self.city_distributor,
            self.reseller,
            self.sub_reseller,
            self.srp
        ]
        
        for i in range(len(prices) - 1):
            if prices[i] < prices[i + 1]:
                return False, f"Price hierarchy violation: Higher tier must have higher or equal price"
        
        return True, "Pricing hierarchy is valid"

# Inventory batch tracking with expiry dates and enhanced pricing
class InventoryBatch(models.Model):
    batch_id = models.AutoField(primary_key=True)
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='batches')
    
    # Batch identification
    batch_number = models.CharField(
        max_length=50, 
        help_text="Unique batch/lot number for tracking",
        default="BATCH-001"  # Default for existing records
    )
    
    # Cost and pricing information
    cost_price = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Actual cost price paid for this batch"
    )
    cost_tier = models.CharField(
        max_length=3,
        choices=PRICING_TIER_CHOICES,
        help_text="The pricing tier this batch was purchased at"
    )
    
    # Discount tracking for price overrides
    tier_discount_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        help_text="Discount percentage from standard tier price (e.g., -5 for 5% discount)"
    )
    tier_discount_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text="Fixed discount amount from standard tier price"
    )
    
    # Stock quantities
    initial_quantity = models.IntegerField(
        help_text="Initial quantity when batch was received",
        default=0  # Default for existing records
    )
    quantity_available = models.IntegerField(
        default=0,
        help_text="Current available quantity in this batch"
    )
    quantity_reserved = models.IntegerField(
        default=0,
        help_text="Quantity reserved for pending orders"
    )
    
    # Expiry and quality tracking
    expiry_date = models.DateField(
        null=True, blank=True,
        help_text="Product expiry date for FIFO management"
    )
    manufacturing_date = models.DateField(
        null=True, blank=True,
        help_text="Manufacturing date if available"
    )
    
    # Purchase details
    purchase_order_ref = models.CharField(
        max_length=50, null=True, blank=True,
        help_text="Reference to the purchase order"
    )
    purchase_date = models.DateField(
        help_text="Date when this batch was purchased",
        default='2025-01-01'  # Default for existing records
    )
    supplier_invoice_ref = models.CharField(
        max_length=50, null=True, blank=True,
        help_text="Supplier's invoice reference"
    )
    
    # Status and tracking
    batch_status = models.CharField(
        max_length=20,
        choices=[
            ('Active', 'Active'),
            ('Expired', 'Expired'),
            ('Damaged', 'Damaged'),
            ('Returned', 'Returned'),
            ('Sold Out', 'Sold Out'),
        ],
        default='Active'
    )
    
    # User tracking
    created_by = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_batches'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Notes
    notes = models.TextField(
        blank=True, null=True,
        help_text="Additional notes about this batch"
    )

    class Meta:
        db_table = 'inventory_batch'
        ordering = ['expiry_date', 'created_at']  # FIFO ordering
        verbose_name = "Inventory Batch"
        verbose_name_plural = "Inventory Batches"

    def __str__(self):
        return f"{self.item.item_name} - Batch {self.batch_number}"

    @property
    def is_expired(self):
        """Check if batch is expired"""
        if not self.expiry_date:
            return False
        return self.expiry_date < timezone.now().date()

    @property
    def days_to_expiry(self):
        """Calculate days until expiry"""
        if not self.expiry_date:
            return None
        delta = self.expiry_date - timezone.now().date()
        return delta.days

    @property
    def quantity_sold(self):
        """Calculate quantity sold from this batch"""
        return self.initial_quantity - self.quantity_available - self.quantity_reserved

    @property
    def effective_cost_price(self):
        """Calculate the effective cost price after discounts"""
        if self.tier_discount_amount > 0:
            return self.cost_price - self.tier_discount_amount
        elif self.tier_discount_percentage > 0:
            discount = (self.tier_discount_percentage / 100) * self.cost_price
            return self.cost_price - discount
        return self.cost_price
    
    @property
    def can_sell_at_tier(self):
        """
        Determine which tier this batch can be sold at based on cost tier and discounts.
        If purchased with discount, user may be eligible to sell at the original tier.
        """
        if self.tier_discount_percentage > 0 or self.tier_discount_amount > 0:
            # If purchased with discount, can sell at the original tier
            return self.cost_tier
        else:
            # Normal case - can sell at tiers below cost tier
            tier_hierarchy = ['RD', 'PD', 'DD', 'CD', 'RS', 'SUB', 'SRP']
            try:
                cost_tier_index = tier_hierarchy.index(self.cost_tier)
                return tier_hierarchy[cost_tier_index + 1:] if cost_tier_index < len(tier_hierarchy) - 1 else ['SRP']
            except ValueError:
                return ['SRP']
    
    def reserve_quantity(self, quantity):
        """Reserve quantity for a pending order"""
        if quantity > self.quantity_available:
            raise ValueError("Cannot reserve more than available quantity")
        
        self.quantity_available -= quantity
        self.quantity_reserved += quantity
        self.save()
    
    def release_reservation(self, quantity):
        """Release reserved quantity back to available"""
        if quantity > self.quantity_reserved:
            raise ValueError("Cannot release more than reserved quantity")
        
        self.quantity_reserved -= quantity
        self.quantity_available += quantity
        self.save()
    
    def fulfill_order(self, quantity):
        """Fulfill an order by reducing reserved quantity"""
        if quantity > self.quantity_reserved:
            raise ValueError("Cannot fulfill more than reserved quantity")
        
        self.quantity_reserved -= quantity
        if self.quantity_available + self.quantity_reserved == 0:
            self.batch_status = 'Sold Out'
        self.save()

# Customer special pricing
class CustomerSpecialPrice(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE)
    item = models.ForeignKey(Item, on_delete=models.CASCADE)
    special_price = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Approval workflow
    is_approved = models.BooleanField(default=False)
    approved_by = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    
    created_by = models.ForeignKey(Account, on_delete=models.CASCADE, related_name='special_prices_created')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'customer_special_price'
        unique_together = ['customer', 'item']

class Transaction(models.Model):
    transaction_id = models.AutoField(primary_key=True)
    brand = models.ForeignKey(Brand, on_delete=models.CASCADE)
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE, null=True, blank=True)
    account = models.ForeignKey(Account, on_delete=models.CASCADE, null=True)
    
    transaction_status = models.CharField(
        max_length=20,
        choices=[
            ('Pending', 'Pending'),
            ('Completed', 'Completed'),
            ('Cancelled', 'Cancelled')
        ],
        default='Completed'
    )
    transaction_type = models.CharField(
        max_length=20,
        choices=[
            ('Purchase', 'Purchase'),  # Incoming stock
            ('Sale', 'Sale'),  # Outgoing stock
            ('Return', 'Return'),
            ('Receive Products', 'Receive Products'),
            ('Return goods', 'Return goods'),
            ('Dispatch goods', 'Dispatch goods'),
            ('Reserve goods', 'Reserve goods'),
            ('Manual correction', 'Manual correction')
        ]
    )
    
    # Payment and VAT fields
    payment_status = models.CharField(
        max_length=10,
        choices=[('Paid', 'Paid'), ('Unpaid', 'Unpaid')],
        default='Unpaid'
    )
    
    is_receipt_issued = models.BooleanField(default=False)
    
    # VAT information
    vat_type = models.CharField(
        max_length=10,
        choices=[('VAT', 'VAT'), ('NON_VAT', 'NON-VAT'), ('MIXED', 'Mixed')],
        null=True, blank=True
    )
    
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    vat_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    transacted_date = models.DateField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now=True)
    due_date = models.DateField(null=True)
    priority_status = models.CharField(
        max_length=20,
        choices=[
            ('Normal', 'Normal'),
            ('Urgent', 'Urgent'),
            ('Critical', 'Critical')
        ],
        default='Normal'
    )
    reference_number = models.CharField(max_length=20, null=True)
    customer_name = models.CharField(max_length=50, null=True)  # Keep for backward compatibility
    notes = models.TextField(null=True)

    class Meta:
        db_table = 'transaction'

    @property
    def current_brand(self):
        """Get current brand"""
        return self.brand

class InventoryChange(models.Model):
    item = models.ForeignKey(Item, on_delete=models.CASCADE)
    batch = models.ForeignKey(InventoryBatch, on_delete=models.CASCADE, null=True, blank=True)
    transaction = models.ForeignKey(Transaction, on_delete=models.CASCADE, null=True)
    requested_quantity = models.SmallIntegerField(null=True)
    quantity_change = models.SmallIntegerField()
    
    # Enhanced pricing information
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Pricing tier used for this transaction
    price_tier = models.CharField(
        max_length=7,
        choices=[
            ('RD', 'Regional Distributor'),
            ('PD', 'Provincial Distributor'),
            ('DD', 'District Distributor'),
            ('CD', 'City Distributor'),
            ('RS', 'Reseller'),
            ('SUB', 'Sub-Reseller'),
            ('SRP', 'Suggested Retail Price'),
            ('SPECIAL', 'Special Price')
        ],
        null=True, blank=True
    )
    
    # Cost tracking for profit calculation
    unit_cost = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text="Unit cost from the batch this item was sold from"
    )
    
    # Profit calculation
    profit_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text="Profit per unit (unit_price - unit_cost)"
    )
    profit_margin_percentage = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        help_text="Profit margin as percentage"
    )
    
    # Change type for better tracking
    change_type = models.CharField(
        max_length=20,
        choices=[
            ('SALE', 'Sale'),
            ('PURCHASE', 'Purchase'),
            ('RETURN_IN', 'Return In'),
            ('RETURN_OUT', 'Return Out'),
            ('ADJUSTMENT', 'Adjustment'),
            ('EXPIRED', 'Expired'),
            ('DAMAGED', 'Damaged'),
            ('TRANSFER', 'Transfer'),
        ],
        default='ADJUSTMENT'
    )
    
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'inventory_change'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        """Auto-calculate profit metrics on save"""
        if self.unit_price and self.unit_cost:
            self.profit_amount = self.unit_price - self.unit_cost
            if self.unit_cost > 0:
                self.profit_margin_percentage = (self.profit_amount / self.unit_cost) * 100
        super().save(*args, **kwargs)

# New model for tracking batch-specific sales
class BatchSale(models.Model):
    """Track sales from specific batches for FIFO and cost tracking"""
    batch = models.ForeignKey(InventoryBatch, on_delete=models.CASCADE, related_name='sales')
    inventory_change = models.ForeignKey(InventoryChange, on_delete=models.CASCADE, related_name='batch_sales')
    
    quantity_sold = models.IntegerField()
    sale_price_per_unit = models.DecimalField(max_digits=10, decimal_places=2)
    cost_price_per_unit = models.DecimalField(max_digits=10, decimal_places=2)
    
    # Profit tracking
    profit_per_unit = models.DecimalField(max_digits=10, decimal_places=2)
    total_profit = models.DecimalField(max_digits=12, decimal_places=2)
    
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'batch_sale'
        verbose_name = "Batch Sale"
        verbose_name_plural = "Batch Sales"

    def save(self, *args, **kwargs):
        """Auto-calculate profit on save"""
        self.profit_per_unit = self.sale_price_per_unit - self.cost_price_per_unit
        self.total_profit = self.profit_per_unit * self.quantity_sold
        super().save(*args, **kwargs)