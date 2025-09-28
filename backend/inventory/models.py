from django.core.validators import RegexValidator
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Sum
from django.utils import timezone

# Pricing tier choices - shared across models
PRICING_TIER_CHOICES = [
    ("SRP", "Suggested Retail Price"),
    ("RD", "Regional Distributor"),
    ("PD", "Provincial Distributor"),
    ("DD", "District Distributor"),
    ("CD", "City Distributor"),
    ("RS", "Reseller"),
    ("SUB-RS", "Sub-Reseller"),
]

PRICING_TIER_HIERARCHY = {
    "RD": 0,
    "PD": 1,
    "DD": 2,
    "CD": 3,
    "RS": 4,
    "SUB-RS": 5,
    "SRP": 6,
}


class Account(AbstractUser):
    account_id = models.AutoField(primary_key=True)
    username = models.CharField(max_length=30, unique=True)
    role = models.CharField(
        max_length=20,
        choices=[
            ("Admin", "Admin"),
            ("Leader", "Leader"),
            ("Sales Rep", "Sales Rep"),
        ],
    )
    cost_tier = models.CharField(
        max_length=10,
        choices=PRICING_TIER_CHOICES,
        null=True,
        blank=True,
        help_text="The pricing tier at which this user purchases products. Determines their selling restrictions.",
    )

    class Meta:
        db_table = "account"

    def __str__(self):
        return f"{self.username} ({self.role})"

    def get_allowed_selling_tiers(self):
        """
        Returns the pricing tiers this user is allowed to sell at.
        Users can only sell at tiers below their own cost tier.
        """
        if not self.cost_tier:
            # If no cost tier assigned, allow all tiers (for admins/special cases)
            return [tier[0] for tier in PRICING_TIER_CHOICES]

        user_tier_level = PRICING_TIER_HIERARCHY.get(self.cost_tier)
        if user_tier_level is None:
            return []

        # Return all tiers with level higher than user's cost tier (lower in hierarchy)
        allowed_tiers = []
        for tier_code, tier_level in PRICING_TIER_HIERARCHY.items():
            if tier_level > user_tier_level:
                allowed_tiers.append(tier_code)

        return allowed_tiers

    def can_sell_at_tier(self, tier):
        """
        Check if this user can sell at a specific pricing tier.
        """
        return tier in self.get_allowed_selling_tiers()


# Brand model for beauty products
class Brand(models.Model):
    VAT_CHOICES = [
        ("VAT", "VAT-inclusive"),
        ("NON_VAT", "NON-VAT"),
        ("BOTH", "Both VAT and NON-VAT"),
    ]

    STATUS_CHOICES = [
        ("Active", "Active"),
        ("Archived", "Archived"),
    ]

    brand_id = models.AutoField(primary_key=True)
    brand_name = models.CharField(max_length=100, unique=True)
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
        default="VAT",
        help_text="VAT classification for tax purposes",
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="Active")

    class Meta:
        db_table = "inventory_brand"
        ordering = ["brand_name"]

    def __str__(self):
        return f"{self.brand_name} ({self.get_vat_classification_display()})"


# Customer model for beauty distribution
class Customer(models.Model):
    PLATFORM_CHOICES = [
        ("whatsapp", "WhatsApp"),
        ("messenger", "Messenger"),
        ("viber", "Viber"),
        ("business_suite", "Business Suite"),
    ]

    customer_id = models.AutoField(primary_key=True)
    company_name = models.CharField(max_length=100, unique=True)
    contact_person = models.CharField(max_length=50)
    address = models.TextField()
    contact_number = models.CharField(max_length=15)
    tin_id = models.CharField(max_length=15, null=True, blank=True)

    customer_type = models.CharField(
        max_length=20,
        choices=[
            ("International", "International"),
            ("Distributor", "Distributor"),
            ("Physical Store", "Physical Store"),
            ("Reseller", "Reseller"),
            ("Direct Customer", "Direct Customer"),
        ],
    )

    # Replace contact field with platform field
    platform = models.CharField(
        max_length=20,
        choices=PLATFORM_CHOICES,
        default="whatsapp",  # Default value for migration
        help_text="Preferred communication platform",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    status = models.CharField(
        max_length=10,
        choices=[("Active", "Active"), ("Archived", "Archived")],
        default="Active",
    )

    class Meta:
        db_table = "customer"

    def __str__(self):
        return self.company_name


# New model: Customer-Brand Pricing relationship
class CustomerBrandPricing(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE)
    brand = models.ForeignKey(Brand, on_delete=models.CASCADE)
    pricing_tier = models.CharField(
        max_length=10,
        choices=PRICING_TIER_CHOICES,
        help_text="The pricing tier this customer gets for this brand",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "customer_brand_pricing"
        unique_together = ["customer", "brand"]
        verbose_name = "Customer Brand Pricing"
        verbose_name_plural = "Customer Brand Pricing"

    def __str__(self):
        return f"{self.customer.company_name} - {self.brand.brand_name} ({self.get_pricing_tier_display()})"


# Restructured Item model
class Item(models.Model):
    UOM_CHOICES = [
        ("pc", "Piece"),
        ("pack", "Pack"),
    ]

    item_id = models.AutoField(primary_key=True)
    brand = models.ForeignKey(
        Brand, on_delete=models.CASCADE
    )  # Moved to top for organizational clarity
    item_name = models.CharField(max_length=100)
    sku = models.CharField(
        max_length=50, unique=True, blank=True, null=True
    )  # Auto-generated, unique
    uom = models.CharField(
        max_length=10,
        choices=UOM_CHOICES,
        default="pc",
        help_text="Unit of Measurement",
    )
    # Remove direct quantity field - will be calculated from batches
    # quantity = models.SmallIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # Save first to ensure we have an ID and brand relationship
        is_new = self.pk is None
        super().save(*args, **kwargs)

        # Auto-generate SKU if not provided and this is a new item
        if not self.sku and is_new and self.brand_id:
            self.sku = self.generate_sku()
            # Save again with the generated SKU
            super().save(update_fields=["sku"])

    def generate_sku(self):
        """Generate SKU in format: {brand_id + 100}-{item_number:03d}"""
        # Get the brand ID and add 100 for the first 3 digits
        brand_code = self.brand_id + 100

        # Get the next item number for this brand
        # Count existing items for this brand (excluding current item if updating)
        existing_items = Item.objects.filter(brand_id=self.brand_id)
        if self.pk:  # If this is an update, exclude the current item
            existing_items = existing_items.exclude(pk=self.pk)

        item_count = existing_items.count() + 1

        # Format as 3 digits
        item_number = f"{item_count:03d}"

        # Combine to create SKU
        sku = f"{brand_code}-{item_number}"

        # Check if this SKU already exists and increment if needed
        while (
            Item.objects.filter(sku=sku).exclude(pk=self.pk if self.pk else 0).exists()
        ):
            item_count += 1
            item_number = f"{item_count:03d}"
            sku = f"{brand_code}-{item_number}"

        return sku

    @property
    def total_quantity(self):
        """
        Calculates the total quantity of the item by summing the remaining quantities of all its batches.
        """
        return self.batches.aggregate(total=Sum("remaining_quantity"))["total"] or 0

    @property
    def active_batches_count(self):
        """
        Counts the number of batches with a positive remaining quantity.
        """
        return self.batches.filter(remaining_quantity__gt=0).count()

    def __str__(self):
        return f"{self.item_name} ({self.sku})"

    class Meta:
        db_table = "inventory_item"
        unique_together = ["item_name", "brand"]


class ItemBatch(models.Model):
    """
    Represents a batch of a specific item, created from an incoming transaction.
    """

    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name="batches")
    batch_number = models.PositiveIntegerField(
        help_text="Auto-generated batch number for the item, starting from 1."
    )
    cost_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="The cost price of items in this batch.",
    )
    initial_quantity = models.PositiveIntegerField(
        help_text="The initial quantity of items in this batch."
    )
    remaining_quantity = models.PositiveIntegerField(
        help_text="The quantity of items remaining in this batch."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    transaction = models.ForeignKey(
        "Transaction",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="The incoming transaction that created this batch.",
    )

    class Meta:
        db_table = "inventory_item_batch"
        unique_together = ["item", "batch_number"]
        ordering = ["item", "batch_number"]
        verbose_name = "Item Batch"
        verbose_name_plural = "Item Batches"

    def save(self, *args, **kwargs):
        if not self.pk:  # If this is a new batch
            last_batch = (
                ItemBatch.objects.filter(item=self.item)
                .order_by("-batch_number")
                .first()
            )
            self.batch_number = (last_batch.batch_number + 1) if last_batch else 1
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.item.item_name} - Batch {self.batch_number}"


# New model: Item Tier Pricing
class ItemTierPricing(models.Model):
    item = models.ForeignKey(
        Item, on_delete=models.CASCADE, related_name="tier_pricing"
    )
    pricing_tier = models.CharField(
        max_length=10,
        choices=PRICING_TIER_CHOICES,
        help_text="The pricing tier this price applies to",
    )
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Standard price for this item at this tier",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "item_tier_pricing"
        unique_together = ["item", "pricing_tier"]
        verbose_name = "Item Tier Pricing"
        verbose_name_plural = "Item Tier Pricing"

    def __str__(self):
        return (
            f"{self.item.item_name} - {self.get_pricing_tier_display()}: ₱{self.price}"
        )


# New model: Customer Special Pricing
class CustomerSpecialPricing(models.Model):
    customer = models.ForeignKey(Customer, on_delete=models.CASCADE)
    item = models.ForeignKey(Item, on_delete=models.CASCADE)
    discount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Price reduction (must be negative value)",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        Account, on_delete=models.SET_NULL, null=True, blank=True
    )

    class Meta:
        db_table = "customer_special_pricing"
        unique_together = ["customer", "item"]
        verbose_name = "Customer Special Pricing"
        verbose_name_plural = "Customer Special Pricing"

    def __str__(self):
        return f"{self.customer.company_name} - {self.item.item_name}: ₱{self.discount}"


# Restructured Transaction model
class Transaction(models.Model):
    TRANSACTION_TYPE_CHOICES = [
        ("INCOMING", "Incoming - Stock In from Brand"),
        ("OUTGOING", "Outgoing - Stock Out to Customer"),
        ("ADJUSTMENT", "Manual Inventory Adjustment"),
    ]

    transaction_id = models.AutoField(primary_key=True)
    brand = models.ForeignKey(Brand, on_delete=models.CASCADE)
    customer = models.ForeignKey(
        Customer, on_delete=models.CASCADE, null=True, blank=True
    )
    account = models.ForeignKey(Account, on_delete=models.CASCADE, null=True)

    transaction_type = models.CharField(
        max_length=20,
        choices=TRANSACTION_TYPE_CHOICES,
        help_text="Type of transaction: incoming stock or outgoing stock",
    )

    # New boolean fields for OUTGOING transactions
    is_released = models.BooleanField(
        default=False, help_text="Whether the goods have been released/dispatched"
    )
    is_paid = models.BooleanField(
        default=False, help_text="Whether the payment has been received"
    )
    is_or_sent = models.BooleanField(
        default=False, help_text="Whether the O.R./Invoice has been sent"
    )

    # VAT information
    vat_type = models.CharField(
        max_length=10,
        choices=[("VAT", "VAT"), ("NON_VAT", "NON-VAT"), ("MIXED", "Mixed")],
        null=True,
        blank=True,
    )

    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    vat_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    transacted_date = models.DateField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    due_date = models.DateField(null=True, blank=True)
    reference_number = models.CharField(max_length=20, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "transaction"

    def __str__(self):
        return f"{self.get_transaction_type_display()} - {self.reference_number or self.transaction_id}"

    @property
    def is_completed(self):
        """
        Read-only property that returns True only if all completion criteria are met.
        For OUTGOING transactions: is_released, is_paid, and is_or_sent must all be True.
        For INCOMING transactions: always returns True (no additional completion criteria).
        """
        if self.transaction_type == "OUTGOING":
            return self.is_released and self.is_paid and self.is_or_sent
        return True  # INCOMING transactions are completed when created

    def save(self, *args, **kwargs):
        # Auto-generate reference number if not provided
        if not self.reference_number:
            self.reference_number = self.generate_reference_number()
        super().save(*args, **kwargs)

    def generate_reference_number(self):
        """Generate sequential reference number in format: YEAR-NNNN"""
        current_year = timezone.now().year

        # Get the last transaction for the current year
        last_transaction = (
            Transaction.objects.filter(reference_number__startswith=f"{current_year}-")
            .order_by("-reference_number")
            .first()
        )

        if last_transaction and last_transaction.reference_number:
            # Extract the number part and increment
            try:
                last_number = int(last_transaction.reference_number.split("-")[1])
                next_number = last_number + 1
            except (ValueError, IndexError):
                next_number = 1
        else:
            next_number = 1

        # Format as 4-digit number with leading zeros
        return f"{current_year}-{next_number:04d}"


# Transaction items linking transactions to inventory items
class TransactionItem(models.Model):
    transaction = models.ForeignKey(
        Transaction, on_delete=models.CASCADE, related_name="items"
    )
    item = models.ForeignKey(Item, on_delete=models.CASCADE)
    batch = models.ForeignKey(
        ItemBatch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        help_text="The specific batch this item is from (for outgoing transactions).",
    )
    quantity = models.IntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=12, decimal_places=2)

    # Pricing tier used for this transaction item
    pricing_tier = models.CharField(
        max_length=10,
        choices=PRICING_TIER_CHOICES,
        null=True,
        blank=True,
        help_text="The pricing tier applied to this item",
    )

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "transaction_item"
        # Removed unique_together to allow same item multiple times with different batches

    def __str__(self):
        return f"{self.transaction} - {self.item.item_name} (Qty: {self.quantity})"

    def save(self, *args, **kwargs):
        """Auto-calculate total_price on save"""
        self.total_price = self.quantity * self.unit_price
        super().save(*args, **kwargs)
