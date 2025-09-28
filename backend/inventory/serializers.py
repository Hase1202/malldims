from rest_framework import serializers
from .models import (
    Item,
    Brand,
    Customer,
    Transaction,
    TransactionItem,
    Account,
    CustomerBrandPricing,
    ItemTierPricing,
    CustomerSpecialPricing,
    ItemBatch,
)
from django.utils import timezone
import pytz


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = [
            "account_id",
            "username",
            "role",
            "first_name",
            "last_name",
            "email",
            "cost_tier",
        ]
        read_only_fields = ["account_id"]


class BrandSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = "__all__"
        read_only_fields = ["brand_id"]


class CustomerSerializer(serializers.ModelSerializer):
    platform_display = serializers.CharField(
        source="get_platform_display", read_only=True
    )

    class Meta:
        model = Customer
        fields = "__all__"
        read_only_fields = ["customer_id", "created_at"]


class CustomerBrandPricingSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(
        source="customer.company_name", read_only=True
    )
    brand_name = serializers.CharField(source="brand.brand_name", read_only=True)
    pricing_tier_display = serializers.CharField(
        source="get_pricing_tier_display", read_only=True
    )

    class Meta:
        model = CustomerBrandPricing
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class ItemTierPricingSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.item_name", read_only=True)
    pricing_tier_display = serializers.CharField(
        source="get_pricing_tier_display", read_only=True
    )

    class Meta:
        model = ItemTierPricing
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class CustomerSpecialPricingSerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(
        source="customer.company_name", read_only=True
    )
    item_name = serializers.CharField(source="item.item_name", read_only=True)

    class Meta:
        model = CustomerSpecialPricing
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]


class ItemBatchSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.item_name", read_only=True)
    item_sku = serializers.CharField(source="item.sku", read_only=True)
    brand_name = serializers.CharField(source="item.brand.brand_name", read_only=True)
    transaction_reference = serializers.CharField(
        source="transaction.reference_number", read_only=True
    )
    created_at_formatted = serializers.SerializerMethodField()

    class Meta:
        model = ItemBatch
        fields = "__all__"
        read_only_fields = ["batch_number", "created_at"]

    def get_created_at_formatted(self, obj):
        ph_tz = pytz.timezone("Asia/Manila")
        ph_datetime = obj.created_at.astimezone(ph_tz)
        return ph_datetime.strftime("%B %d, %Y, %I:%M %p")


class ItemSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source="brand.brand_name", read_only=True)
    brand_id = serializers.IntegerField(source="brand.brand_id", read_only=True)
    uom_display = serializers.CharField(source="get_uom_display", read_only=True)

    # Batch-based quantity fields
    total_quantity = serializers.ReadOnlyField()
    active_batches_count = serializers.ReadOnlyField()

    # Pricing information from new structure
    tier_pricing = ItemTierPricingSerializer(many=True, read_only=True)

    class Meta:
        model = Item
        fields = [
            "item_id",
            "brand",
            "brand_name",
            "brand_id",
            "item_name",
            "sku",
            "uom",
            "uom_display",
            "total_quantity",
            "active_batches_count",
            "created_at",
            "updated_at",
            "tier_pricing",
        ]
        read_only_fields = [
            "item_id",
            "created_at",
            "updated_at",
            "brand_name",
            "brand_id",
            "sku",
            "total_quantity",
            "active_batches_count",
        ]


class TransactionItemSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.item_name", read_only=True)
    sku = serializers.CharField(source="item.sku", read_only=True)
    brand_name = serializers.CharField(source="item.brand.brand_name", read_only=True)
    quantity_change = serializers.SerializerMethodField()
    batch_number = serializers.IntegerField(source="batch.batch_number", read_only=True)
    batch_remaining_quantity = serializers.IntegerField(
        source="batch.remaining_quantity", read_only=True
    )

    class Meta:
        model = TransactionItem
        fields = "__all__"

    def get_quantity_change(self, obj):
        """Return quantity with correct sign based on transaction type"""
        if obj.transaction.transaction_type == "OUTGOING":
            # Outgoing transactions should show negative quantities
            return -obj.quantity
        else:
            # Incoming and adjustment transactions show positive quantities
            return obj.quantity


class TransactionSerializer(serializers.ModelSerializer):
    brand_name = serializers.CharField(source="brand.brand_name", read_only=True)
    customer_name = serializers.CharField(
        source="customer.company_name", read_only=True
    )
    account_username = serializers.CharField(source="account.username", read_only=True)
    created_by = serializers.CharField(source="account.username", read_only=True)

    # Map new structure to old frontend expectations
    transaction_status = serializers.SerializerMethodField()
    transaction_type = serializers.SerializerMethodField()
    priority_status = serializers.SerializerMethodField()

    # Include transaction items
    items = TransactionItemSerializer(many=True, read_only=True)

    # Include computed property
    is_completed = serializers.ReadOnlyField()

    # Format dates with Philippine timezone
    transacted_date_formatted = serializers.SerializerMethodField()
    created_at_formatted = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = "__all__"
        read_only_fields = ["transaction_id", "transacted_date", "created_at"]

    def get_transaction_status(self, obj):
        """Map the new boolean fields to old status format"""
        if obj.transaction_type in ["INCOMING", "ADJUSTMENT"]:
            return (
                "Completed"  # INCOMING and ADJUSTMENT transactions are always completed
            )
        else:  # OUTGOING
            if obj.is_completed:
                return "Completed"
            else:
                return "Pending"

    def get_transaction_type(self, obj):
        """Map the backend transaction types to frontend display format"""
        if obj.transaction_type == "INCOMING":
            return "INCOMING"
        elif obj.transaction_type == "OUTGOING":
            return "OUTGOING"
        else:  # ADJUSTMENT
            return "ADJUSTMENT"

    def get_priority_status(self, obj):
        """Return priority status for pending transactions"""
        if obj.transaction_type == "OUTGOING" and not obj.is_completed:
            if obj.due_date:
                from django.utils import timezone

                if obj.due_date < timezone.now().date():
                    return "Critical"  # Overdue
                elif (obj.due_date - timezone.now().date()).days <= 3:
                    return "Urgent"  # Due soon
            return "Normal"
        return None

    def get_transacted_date_formatted(self, obj):
        ph_tz = pytz.timezone("Asia/Manila")
        ph_date = timezone.make_aware(
            timezone.datetime.combine(obj.transacted_date, timezone.datetime.min.time())
        ).astimezone(ph_tz)
        return ph_date.strftime("%B %d, %Y")

    def get_created_at_formatted(self, obj):
        ph_tz = pytz.timezone("Asia/Manila")
        ph_datetime = obj.created_at.astimezone(ph_tz)
        return ph_datetime.strftime("%B %d, %Y, %I:%M %p")


class TransactionCreateSerializer(serializers.ModelSerializer):
    items = serializers.ListField(write_only=True)
    transaction_type = serializers.CharField()  # Accept frontend format
    customer_name = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Transaction
        fields = [
            "brand",
            "customer",
            "account",
            "transaction_type",
            "due_date",
            "reference_number",
            "notes",
            "items",
            "customer_name",
        ]

    def validate_transaction_type(self, value):
        """Map frontend transaction types to backend types"""
        mapping = {
            "Receive goods": "INCOMING",
            "Receive Products": "INCOMING",
            "Receive Products (from Brands)": "INCOMING",
            "INCOMING": "INCOMING",
            "Dispatch goods": "OUTGOING",
            "Reserve goods": "OUTGOING",
            "Return goods": "OUTGOING",
            "Sell Products (to Customers)": "OUTGOING",
            "OUTGOING": "OUTGOING",
            "Manual correction": "ADJUSTMENT",
            "Manual Adjustment": "ADJUSTMENT",
            "Adjust Inventory": "ADJUSTMENT",
            "ADJUSTMENT": "ADJUSTMENT",
            "Sale": "OUTGOING",
        }

        mapped_type = mapping.get(value, value)
        if mapped_type not in ["INCOMING", "OUTGOING", "ADJUSTMENT"]:
            raise serializers.ValidationError(f"Invalid transaction type: {value}")

        # Store the original type for later use
        self.original_transaction_type = value
        return mapped_type

    def validate(self, data):
        """Additional validation"""
        return data

    def create(self, validated_data):
        items_data = validated_data.pop("items")
        customer_name = validated_data.pop("customer_name", None)

        # Handle customer creation/lookup for outgoing transactions
        if customer_name and not validated_data.get("customer"):
            customer, created = Customer.objects.get_or_create(
                company_name=customer_name,
                defaults={
                    "contact_person": "Unknown",
                    "address": "Unknown",
                    "contact_number": "Unknown",
                    "customer_type": "Direct Customer",
                    "platform": "whatsapp",
                },
            )
            validated_data["customer"] = customer

        # Set account to current user if not provided
        if not validated_data.get("account"):
            validated_data["account"] = self.context["request"].user

        # For Manual adjustment, get brand from the first item if not provided
        is_adjustment = (
            getattr(self, "original_transaction_type", None)
            in ["Manual correction", "Manual Adjustment", "Adjust Inventory"]
            or validated_data.get("transaction_type") == "ADJUSTMENT"
        )

        if is_adjustment and not validated_data.get("brand"):
            if items_data:
                first_item_id = items_data[0].get("item") or items_data[0].get(
                    "item_id"
                )
                if first_item_id:
                    try:
                        item = Item.objects.get(pk=first_item_id)
                        validated_data["brand"] = item.brand
                    except Item.DoesNotExist:
                        # Use first available brand as fallback
                        first_brand = Brand.objects.first()
                        if first_brand:
                            validated_data["brand"] = first_brand

        # Ensure we have a brand for all transactions
        if not validated_data.get("brand"):
            first_brand = Brand.objects.first()
            if first_brand:
                validated_data["brand"] = first_brand

        transaction = Transaction.objects.create(**validated_data)

        # Create transaction items
        for item_data in items_data:
            # Handle both 'item' and 'item_id' keys from frontend
            item_id = item_data.get("item") or item_data.get("item_id")
            if item_id:
                try:
                    item = Item.objects.get(pk=item_id)

                    # Get quantity_change - preserve the sign for correct stock calculation
                    quantity_change = item_data.get("quantity_change") or item_data.get(
                        "quantity", 0
                    )
                    quantity = abs(
                        quantity_change
                    )  # Absolute value for transaction item record

                    # Get cost_price for incoming transactions or unit_price for others
                    if transaction.transaction_type == "INCOMING":
                        # For incoming transactions, use cost_price from frontend
                        unit_price = item_data.get("cost_price", 0)
                    else:
                        # For outgoing/adjustment transactions, use unit_price
                        unit_price = item_data.get("unit_price", 0)

                    # Get batch information for outgoing transactions
                    batch = None
                    if transaction.transaction_type == "OUTGOING":
                        batch_id = item_data.get("batch_id")
                        if batch_id:
                            try:
                                batch = ItemBatch.objects.get(pk=batch_id)
                                # Validate that there's enough quantity in the batch
                                if batch.remaining_quantity < quantity:
                                    raise serializers.ValidationError(
                                        f"Insufficient quantity in batch {batch.batch_number}. "
                                        f"Available: {batch.remaining_quantity}, Requested: {quantity}"
                                    )
                                # For outgoing transactions, use the batch cost price if no unit_price provided
                                if not unit_price and batch:
                                    unit_price = batch.cost_price
                            except ItemBatch.DoesNotExist:
                                raise serializers.ValidationError(
                                    f"Batch with ID {batch_id} does not exist."
                                )

                    # Calculate total price
                    total_price = item_data.get("total_price", quantity * unit_price)

                    transaction_item = TransactionItem.objects.create(
                        transaction=transaction,
                        item=item,
                        batch=batch,
                        quantity=quantity,
                        unit_price=unit_price,
                        total_price=total_price,
                        pricing_tier=item_data.get("pricing_tier"),
                    )

                    # Handle batch logic based on transaction type
                    if transaction.transaction_type == "INCOMING":
                        # Create a new batch for incoming items with proper cost_price
                        cost_price = item_data.get("cost_price", 0)

                        # Let the model auto-generate the batch number
                        ItemBatch.objects.create(
                            item=item,
                            cost_price=cost_price,
                            initial_quantity=quantity,
                            remaining_quantity=quantity,
                            transaction=transaction,
                        )

                    elif transaction.transaction_type == "OUTGOING" and batch:
                        # Reduce the batch quantity for outgoing items
                        batch.remaining_quantity -= quantity
                        batch.save()

                    elif is_adjustment:
                        # For manual adjustments, we need to handle differently
                        # For positive adjustments, create a new batch
                        # For negative adjustments, reduce from the newest batches (LIFO)
                        if quantity_change > 0:
                            # Positive adjustment - create new batch
                            ItemBatch.objects.create(
                                item=item,
                                cost_price=unit_price
                                or 0,  # Use provided price or 0 for adjustments
                                initial_quantity=quantity,
                                remaining_quantity=quantity,
                                transaction=transaction,
                            )
                        else:
                            # Negative adjustment - reduce from existing batches (LIFO)
                            remaining_to_reduce = quantity
                            batches = ItemBatch.objects.filter(
                                item=item, remaining_quantity__gt=0
                            ).order_by("-batch_number")

                            for batch in batches:
                                if remaining_to_reduce <= 0:
                                    break

                                if batch.remaining_quantity >= remaining_to_reduce:
                                    batch.remaining_quantity -= remaining_to_reduce
                                    batch.save()
                                    remaining_to_reduce = 0
                                else:
                                    remaining_to_reduce -= batch.remaining_quantity
                                    batch.remaining_quantity = 0
                                    batch.save()

                except Item.DoesNotExist:
                    continue

        return transaction
