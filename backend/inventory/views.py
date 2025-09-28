from django.shortcuts import render, get_object_or_404
from django.db import models
from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action, permission_classes as permission_decorator
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.views import (
    TokenObtainPairView as BaseTokenObtainPairView,
)
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
from django.db.models import Count, Q, F
import logging
from decimal import Decimal

# Import your models and serializers
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
from .serializers import (
    ItemSerializer,
    BrandSerializer,
    CustomerSerializer,
    TransactionSerializer,
    TransactionCreateSerializer,
    TransactionItemSerializer,
    AccountSerializer,
    CustomerBrandPricingSerializer,
    ItemTierPricingSerializer,
    CustomerSpecialPricingSerializer,
    ItemBatchSerializer,
)
from .services import PricingService, TransactionService


# Custom Token Serializer
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Add custom claims
        token["username"] = user.username
        token["role"] = user.role
        token["first_name"] = user.first_name
        token["last_name"] = user.last_name

        return token


class CustomTokenObtainPairView(BaseTokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class UserInfoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get current user information"""
        user = request.user
        return Response(
            {
                "account_id": user.account_id,
                "username": user.username,
                "role": user.role,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "is_active": user.is_active,
                "date_joined": user.date_joined.isoformat() if user.date_joined else "",
            }
        )


class UsersListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get list of all users"""
        users = Account.objects.all()
        serializer = AccountSerializer(users, many=True)
        return Response(serializer.data)


# Generic model viewsets
class AccountViewSet(viewsets.ModelViewSet):
    queryset = Account.objects.all()
    serializer_class = AccountSerializer
    permission_classes = [IsAuthenticated]


class BrandViewSet(viewsets.ModelViewSet):
    queryset = Brand.objects.all()
    serializer_class = BrandSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter brands based on query parameters"""
        queryset = Brand.objects.all()

        # By default, only return active brands for the add item dropdown
        # Allow 'all' parameter to override this for admin views
        if self.request.query_params.get("all") != "true":
            queryset = queryset.filter(status="Active")

        return queryset.order_by("brand_name")


class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.select_related("brand").all()
    serializer_class = ItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter items based on query parameters"""
        queryset = Item.objects.select_related("brand").all()

        # Filter by brand
        brand = self.request.query_params.get("brand")
        if brand:
            queryset = queryset.filter(brand=brand)

        # Search functionality
        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(item_name__icontains=search)
                | Q(sku__icontains=search)
                | Q(brand__brand_name__icontains=search)
            )

        # Ordering
        ordering = self.request.query_params.get("ordering")
        if ordering:
            # Handle brand_name ordering specially
            if ordering == "brand_name":
                queryset = queryset.order_by("brand__brand_name")
            elif ordering == "-brand_name":
                queryset = queryset.order_by("-brand__brand_name")
            else:
                queryset = queryset.order_by(ordering)
        else:
            queryset = queryset.order_by("item_name")

        return queryset

    @action(detail=False, methods=["get"], url_path="next-sku")
    def next_sku(self, request):
        """Get the next SKU for a given brand"""
        brand_id = request.query_params.get("brand_id")

        if not brand_id:
            return Response(
                {"error": "brand_id parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            brand = Brand.objects.get(brand_id=brand_id)
        except Brand.DoesNotExist:
            return Response(
                {"error": "Brand not found"}, status=status.HTTP_404_NOT_FOUND
            )

        # Generate the next SKU
        brand_code = brand.brand_id + 100
        item_count = Item.objects.filter(brand=brand).count() + 1
        item_number = f"{item_count:03d}"

        # Check if this SKU already exists and increment if needed
        sku = f"{brand_code}-{item_number}"
        while Item.objects.filter(sku=sku).exists():
            item_count += 1
            item_number = f"{item_count:03d}"
            sku = f"{brand_code}-{item_number}"

        return Response({"next_sku": sku})

    @action(detail=True, methods=["get"], url_path="next-batch-number")
    def next_batch_number(self, request, pk=None):
        """Get the next batch number for a specific item"""
        item = self.get_object()

        # Get the highest batch number for this item from ItemBatch model
        from .models import ItemBatch

        highest_batch = (
            ItemBatch.objects.filter(item=item).order_by("-batch_number").first()
        )

        if highest_batch:
            next_num = highest_batch.batch_number + 1
        else:
            next_num = 1

        return Response({"next_batch_number": next_num})

    @action(detail=True, methods=["get"])
    def pricing_tiers(self, request, pk=None):
        """Get all pricing tiers for this item"""
        item = self.get_object()
        pricing_tiers = ItemTierPricing.objects.filter(item=item)
        serializer = ItemTierPricingSerializer(pricing_tiers, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def set_pricing_tier(self, request, pk=None):
        """Set or update pricing for a specific tier"""
        item = self.get_object()
        pricing_tier = request.data.get("pricing_tier")
        price = request.data.get("price")

        if not pricing_tier or not price:
            return Response(
                {"error": "pricing_tier and price are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tier_pricing, created = ItemTierPricing.objects.update_or_create(
            item=item,
            pricing_tier=pricing_tier,
            defaults={"price": Decimal(str(price))},
        )

        serializer = ItemTierPricingSerializer(tier_pricing)
        return Response(serializer.data)

    @action(detail=True, methods=["get"])
    def special_pricing_customers(self, request, pk=None):
        """Get all customers with special pricing for this item"""
        item = self.get_object()
        special_pricing_list = PricingService.get_customer_pricing_for_item(item)
        return Response(special_pricing_list)

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        """Get transaction history for this item"""
        item = self.get_object()

        # Get all transaction items for this item
        transaction_items = (
            TransactionItem.objects.filter(item=item)
            .select_related(
                "transaction",
                "transaction__customer",
                "transaction__brand",
                "transaction__account",
            )
            .order_by("-transaction__transacted_date", "-created_at")
        )

        # Build history response
        history_data = []
        for trans_item in transaction_items:
            # Calculate correct quantity change with proper signs
            if trans_item.transaction.transaction_type == "OUTGOING":
                quantity_change = -trans_item.quantity
            else:
                quantity_change = trans_item.quantity

            history_entry = {
                "item": item.item_id,
                "item_name": item.item_name,
                "quantity_change": quantity_change,
                "created_at": trans_item.created_at,
                "transaction_id": trans_item.transaction.transaction_id,
                "transaction_type": trans_item.transaction.transaction_type,
                "reference_number": trans_item.transaction.reference_number,
                "customer_name": trans_item.transaction.customer.company_name
                if trans_item.transaction.customer
                else None,
                "brand_name": trans_item.transaction.brand.brand_name
                if trans_item.transaction.brand
                else None,
                "unit_price": float(trans_item.unit_price),
                "total_price": float(trans_item.total_price),
                "pricing_tier": trans_item.pricing_tier,
                "notes": trans_item.transaction.notes,
                "transacted_date": trans_item.transaction.transacted_date,
                "account": {
                    "account_id": trans_item.transaction.account.account_id,
                    "username": trans_item.transaction.account.username,
                    "first_name": trans_item.transaction.account.first_name,
                    "last_name": trans_item.transaction.account.last_name,
                }
                if trans_item.transaction.account
                else None,
            }
            history_data.append(history_entry)

        return Response(history_data)

    @action(detail=True, methods=["get"])
    @permission_decorator([IsAuthenticated])
    def special_pricing(self, request, pk=None):
        """Get all customers with special pricing for this item"""
        item = self.get_object()
        special_pricing = (
            CustomerSpecialPricing.objects.filter(item=item)
            .select_related("customer")
            .order_by("-created_at")
        )

        pricing_data = []
        for pricing in special_pricing:
            pricing_data.append(
                {
                    "customer_id": pricing.customer.customer_id,
                    "customer_name": pricing.customer.company_name,
                    "discount": float(pricing.discount),
                    "created_at": pricing.created_at,
                    "created_by": {
                        "account_id": pricing.created_by.account_id,
                        "username": pricing.created_by.username,
                        "first_name": pricing.created_by.first_name,
                        "last_name": pricing.created_by.last_name,
                    }
                    if pricing.created_by
                    else None,
                }
            )

        return Response(pricing_data)


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=True, methods=["get"])
    def brand_pricing(self, request, pk=None):
        """Get brand pricing tiers for this customer"""
        customer = self.get_object()
        brand_pricing = CustomerBrandPricing.objects.filter(customer=customer)
        serializer = CustomerBrandPricingSerializer(brand_pricing, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def assign_all_brands(self, request, pk=None):
        """Assign all available brands to this customer with default SRP tier"""
        customer = self.get_object()

        # Get all active brands
        all_brands = Brand.objects.filter(status="Active")
        created_count = 0

        for brand in all_brands:
            # Create brand pricing if it doesn't exist
            brand_pricing, created = CustomerBrandPricing.objects.get_or_create(
                customer=customer,
                brand=brand,
                defaults={"pricing_tier": "SRP"},  # Default to SRP
            )
            if created:
                created_count += 1

        return Response(
            {
                "message": f"Assigned {created_count} new brands to {customer.company_name}",
                "total_brands": all_brands.count(),
                "new_assignments": created_count,
            }
        )

    @action(detail=True, methods=["post"])
    def set_brand_pricing(self, request, pk=None):
        """Set or update pricing tier for a brand"""
        customer = self.get_object()
        brand_id = request.data.get("brand_id")
        pricing_tier = request.data.get("pricing_tier")

        if not brand_id or not pricing_tier:
            return Response(
                {"error": "brand_id and pricing_tier are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            brand = Brand.objects.get(pk=brand_id)
            brand_pricing, created = CustomerBrandPricing.objects.update_or_create(
                customer=customer, brand=brand, defaults={"pricing_tier": pricing_tier}
            )

            serializer = CustomerBrandPricingSerializer(brand_pricing)
            return Response(serializer.data)
        except Brand.DoesNotExist:
            return Response(
                {"error": "Brand not found"}, status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=["get"])
    def special_pricing(self, request, pk=None):
        """Get special pricing for this customer"""
        customer = self.get_object()
        special_pricing = CustomerSpecialPricing.objects.filter(customer=customer)
        serializer = CustomerSpecialPricingSerializer(special_pricing, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def add_special_pricing(self, request, pk=None):
        """Add special pricing for an item"""
        customer = self.get_object()
        item_id = request.data.get("item_id")
        discount = request.data.get("discount")

        if not item_id or discount is None:
            return Response(
                {"error": "item_id and discount are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        discount_decimal = Decimal(str(discount))
        if not PricingService.validate_special_pricing_discount(discount_decimal):
            return Response(
                {"error": "Discount must be negative"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            item = Item.objects.get(pk=item_id)

            # Check if special pricing already exists
            if CustomerSpecialPricing.objects.filter(
                customer=customer, item=item
            ).exists():
                return Response(
                    {"error": "Special pricing for this item already exists"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            special_pricing = CustomerSpecialPricing.objects.create(
                customer=customer,
                item=item,
                discount=discount_decimal,
                created_by=request.user,
            )

            serializer = CustomerSpecialPricingSerializer(special_pricing)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except Item.DoesNotExist:
            return Response(
                {"error": "Item not found"}, status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=["post"])
    def remove_special_pricing(self, request, pk=None):
        """Remove special pricing for a specific item"""
        customer = self.get_object()
        item_id = request.data.get("item_id")

        if not item_id:
            return Response(
                {"error": "item_id is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            item = Item.objects.get(item_id=item_id)

            # Find and delete the special pricing
            special_pricing = CustomerSpecialPricing.objects.filter(
                customer=customer, item=item
            ).first()

            if not special_pricing:
                return Response(
                    {"error": "Special pricing not found for this item"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            special_pricing.delete()

            return Response(
                {"message": "Special pricing removed successfully"},
                status=status.HTTP_200_OK,
            )
        except Item.DoesNotExist:
            return Response(
                {"error": "Item not found"}, status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=True, methods=["post"])
    def remove_brand_pricing(self, request, pk=None):
        """Remove brand pricing tier assignment for a customer"""
        customer = self.get_object()
        brand_id = request.data.get("brand_id")

        if not brand_id:
            return Response(
                {"error": "brand_id is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        try:
            brand = Brand.objects.get(brand_id=brand_id)

            # Find and delete the brand pricing
            brand_pricing = CustomerBrandPricing.objects.filter(
                customer=customer, brand=brand
            ).first()

            if not brand_pricing:
                return Response(
                    {"error": "Brand pricing not found"},
                    status=status.HTTP_404_NOT_FOUND,
                )

            brand_pricing.delete()

            return Response(
                {"message": "Brand pricing removed successfully"},
                status=status.HTTP_200_OK,
            )
        except Brand.DoesNotExist:
            return Response(
                {"error": "Brand not found"}, status=status.HTTP_404_NOT_FOUND
            )


class CustomerBrandPricingViewSet(viewsets.ModelViewSet):
    queryset = CustomerBrandPricing.objects.all()
    serializer_class = CustomerBrandPricingSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=["post"])
    def bulk_create(self, request):
        """Create multiple customer brand pricing assignments at once"""
        try:
            customer_id = request.data.get("customer")
            assignments = request.data.get("assignments", [])

            if not customer_id or not assignments:
                return Response(
                    {"error": "customer and assignments are required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Validate customer exists
            try:
                customer = Customer.objects.get(customer_id=customer_id)
            except Customer.DoesNotExist:
                return Response(
                    {"error": "Customer not found"}, status=status.HTTP_404_NOT_FOUND
                )

            created_assignments = []

            for assignment in assignments:
                brand_id = assignment.get("brand")
                pricing_tier = assignment.get("pricing_tier")

                if not brand_id or not pricing_tier:
                    continue

                # Check if assignment already exists
                existing = CustomerBrandPricing.objects.filter(
                    customer=customer, brand_id=brand_id
                ).first()

                if existing:
                    # Update existing assignment
                    existing.pricing_tier = pricing_tier
                    existing.save()
                    created_assignments.append(existing)
                else:
                    # Create new assignment
                    new_assignment = CustomerBrandPricing.objects.create(
                        customer=customer, brand_id=brand_id, pricing_tier=pricing_tier
                    )
                    created_assignments.append(new_assignment)

            serializer = self.get_serializer(created_assignments, many=True)
            return Response(
                {
                    "message": f"Successfully assigned {len(created_assignments)} brands",
                    "data": serializer.data,
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            return Response(
                {"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ItemTierPricingViewSet(viewsets.ModelViewSet):
    queryset = ItemTierPricing.objects.all()
    serializer_class = ItemTierPricingSerializer
    permission_classes = [IsAuthenticated]


class CustomerSpecialPricingViewSet(viewsets.ModelViewSet):
    queryset = CustomerSpecialPricing.objects.all()
    serializer_class = CustomerSpecialPricingSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        # Validate discount is negative
        discount = serializer.validated_data.get("discount")
        if not PricingService.validate_special_pricing_discount(discount):
            raise serializers.ValidationError("Discount must be negative")

        serializer.save(created_by=self.request.user)


class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == "create":
            return TransactionCreateSerializer
        return TransactionSerializer

    def get_queryset(self):
        """Filter transactions based on query parameters"""
        queryset = Transaction.objects.select_related(
            "brand", "customer", "account"
        ).all()

        # Debug: log the query parameters
        print(f"Transaction query params: {dict(self.request.query_params)}")
        print(f"Total transactions before filtering: {queryset.count()}")

        # Debug: show sample transaction details
        sample_transactions = queryset[:3]
        for tx in sample_transactions:
            print(
                f"Sample TX {tx.transaction_id}: DB_type='{tx.transaction_type}', is_released={tx.is_released}, is_paid={tx.is_paid}, is_or_sent={tx.is_or_sent}"
            )

        # Handle frontend compatibility - map old parameters to new structure

        # Status filter (frontend sends "Pending" or "Completed")
        status = self.request.query_params.get("status")
        print(f"Status parameter received: {status}")
        if status:
            print(f"Applying status filter for: {status}")
            if status.lower() == "pending":
                # Pending = OUTGOING transactions that are not fully completed
                print("Filtering for pending transactions")
                # Handle both old and new transaction type formats
                queryset = queryset.filter(
                    transaction_type__in=["OUTGOING", "Dispatch goods"]
                ).exclude(is_released=True, is_paid=True, is_or_sent=True)
            elif status.lower() == "completed":
                # Completed = INCOMING, ADJUSTMENT transactions or fully completed OUTGOING transactions
                print("Filtering for completed transactions")
                # Handle both old and new transaction type formats
                incoming_filter = Q(transaction_type="INCOMING") | Q(
                    transaction_type="Receive Products"
                )
                adjustment_filter = Q(transaction_type="ADJUSTMENT") | Q(
                    transaction_type="Manual correction"
                )
                outgoing_completed_filter = Q(
                    transaction_type__in=["OUTGOING", "Dispatch goods"],
                    is_released=True,
                    is_paid=True,
                    is_or_sent=True,
                )
                queryset = queryset.filter(
                    incoming_filter | adjustment_filter | outgoing_completed_filter
                )
                print(f"Transactions after completed filter: {queryset.count()}")

        # Debug: log the final queryset count
        print(f"Transactions after status filtering: {queryset.count()}")

        # Type filter (frontend sends transaction type names)
        transaction_type = self.request.query_params.get("type")
        if transaction_type:
            if transaction_type in ["Receive Products", "Receive goods"]:
                queryset = queryset.filter(transaction_type="INCOMING")
            elif transaction_type in ["Dispatch goods", "Sale"]:
                queryset = queryset.filter(transaction_type="OUTGOING")
            elif transaction_type in [
                "Manual correction",
                "Manual Adjustment",
                "Adjustment",
            ]:
                queryset = queryset.filter(transaction_type="ADJUSTMENT")

        # Handle old parameters for backward compatibility
        transaction_type_old = self.request.query_params.get("transactionType")
        if transaction_type_old:
            if transaction_type_old.lower() == "incoming":
                queryset = queryset.filter(transaction_type="INCOMING")
            elif transaction_type_old.lower() == "outgoing":
                queryset = queryset.filter(transaction_type="OUTGOING")
            elif transaction_type_old.lower() == "adjustment":
                queryset = queryset.filter(transaction_type="ADJUSTMENT")

        # Filter by release status for OUTGOING transactions
        release_status = self.request.query_params.get("releaseStatus")
        if release_status:
            if release_status.lower() == "released":
                queryset = queryset.filter(
                    transaction_type="OUTGOING", is_released=True
                )
            elif release_status.lower() == "not released":
                queryset = queryset.filter(
                    transaction_type="OUTGOING", is_released=False
                )

        # Filter by payment status for OUTGOING transactions
        payment_status = self.request.query_params.get("paymentStatus")
        if payment_status:
            if payment_status.lower() == "paid":
                queryset = queryset.filter(transaction_type="OUTGOING", is_paid=True)
            elif payment_status.lower() == "not paid":
                queryset = queryset.filter(transaction_type="OUTGOING", is_paid=False)

        # Filter by O.R/Invoice status for OUTGOING transactions
        or_invoice_status = self.request.query_params.get("orInvoiceStatus")
        if or_invoice_status:
            if or_invoice_status.lower() == "sent":
                queryset = queryset.filter(transaction_type="OUTGOING", is_or_sent=True)
            elif or_invoice_status.lower() == "not sent":
                queryset = queryset.filter(
                    transaction_type="OUTGOING", is_or_sent=False
                )

        # Filter by date range
        start_date = self.request.query_params.get("startDate")
        end_date = self.request.query_params.get("endDate")
        if start_date:
            queryset = queryset.filter(transacted_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(transacted_date__lte=end_date)

        # Handle ordering
        ordering = self.request.query_params.get("ordering", "-created_at")
        if ordering == "-created_at":
            queryset = queryset.order_by("-created_at")
        else:
            queryset = queryset.order_by(ordering)

        return queryset

    @action(detail=True, methods=["patch"])
    def update_status(self, request, pk=None):
        """Update transaction status fields for OUTGOING transactions"""
        transaction = self.get_object()

        if transaction.transaction_type != "OUTGOING":
            return Response(
                {"error": "Status updates are only allowed for OUTGOING transactions"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Update the boolean fields
        for field in ["is_released", "is_paid", "is_or_sent"]:
            if field in request.data:
                setattr(transaction, field, request.data[field])

        transaction.save()

        serializer = self.get_serializer(transaction)
        return Response(serializer.data)

    def perform_create(self, serializer):
        """Enhanced transaction creation with pricing calculation"""
        # The serializer already handles all transaction creation logic including inventory updates
        # We just need to save the transaction
        transaction = serializer.save()


class TransactionItemViewSet(viewsets.ModelViewSet):
    queryset = TransactionItem.objects.all()
    serializer_class = TransactionItemSerializer
    permission_classes = [IsAuthenticated]


# Authentication views
@csrf_exempt
def login_view(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            username = data.get("username")
            password = data.get("password")

            user = authenticate(username=username, password=password)
            if user is not None:
                return JsonResponse(
                    {
                        "success": True,
                        "user": {
                            "id": user.account_id,
                            "username": user.username,
                            "role": user.role,
                            "first_name": user.first_name,
                            "last_name": user.last_name,
                        },
                    }
                )
            else:
                return JsonResponse(
                    {"success": False, "message": "Invalid credentials"}
                )
        except json.JSONDecodeError:
            return JsonResponse({"success": False, "message": "Invalid JSON"})
    return JsonResponse({"success": False, "message": "Only POST method allowed"})


# Dashboard and stats views
class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            # Basic counts
            total_items = Item.objects.count()
            total_customers = Customer.objects.filter(status="Active").count()
            total_brands = Brand.objects.filter(status="Active").count()

            # Transaction counts
            pending_outgoing = (
                Transaction.objects.filter(transaction_type="OUTGOING")
                .exclude(is_released=True, is_paid=True, is_or_sent=True)
                .count()
            )

            completed_outgoing = Transaction.objects.filter(
                transaction_type="OUTGOING",
                is_released=True,
                is_paid=True,
                is_or_sent=True,
            ).count()

            # Recent transactions
            recent_transactions = Transaction.objects.all().order_by("-created_at")[:5]
            recent_transactions_data = TransactionSerializer(
                recent_transactions, many=True
            ).data

            # Low stock items and out of stock items
            # Since quantity is now calculated from batches, we need to calculate this differently
            low_stock_items = 0
            out_of_stock_items = 0

            # Get all items and calculate their stock levels
            all_items = Item.objects.all()
            for item in all_items:
                total_qty = item.total_quantity  # This uses the calculated property
                if total_qty == 0:
                    out_of_stock_items += 1
                elif total_qty <= 10:  # threshold of 10
                    low_stock_items += 1

            return Response(
                {
                    "total_items": total_items,
                    "total_customers": total_customers,
                    "total_brands": total_brands,
                    "pending_outgoing_transactions": pending_outgoing,
                    "completed_outgoing_transactions": completed_outgoing,
                    "low_stock_items": low_stock_items,
                    "out_of_stock_items": out_of_stock_items,
                    "recent_transactions": recent_transactions_data,
                }
            )
        except Exception as e:
            logging.error(f"Dashboard stats error: {str(e)}")
            return Response(
                {"error": "Failed to fetch dashboard stats"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class ReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        report_type = request.query_params.get("type")

        if report_type == "sales":
            # Sales report
            sales_transactions = Transaction.objects.filter(transaction_type="OUTGOING")
            data = TransactionSerializer(sales_transactions, many=True).data
            return Response({"transactions": data})

        elif report_type == "inventory":
            # Inventory report
            items = Item.objects.all()
            data = ItemSerializer(items, many=True).data
            return Response({"items": data})

        elif report_type == "customers":
            # Customer report
            customers = Customer.objects.filter(status="Active")
            data = CustomerSerializer(customers, many=True).data
            return Response({"customers": data})

        else:
            return Response(
                {"error": "Invalid report type"}, status=status.HTTP_400_BAD_REQUEST
            )


# Pricing utilities endpoint
class PricingUtilsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Get available pricing tiers or user-specific allowed tiers"""
        action = request.query_params.get("action", "all_tiers")

        if action == "user_allowed_tiers":
            # Return only the tiers this user can sell at
            allowed_tiers = PricingService.get_user_allowed_selling_tiers_with_labels(
                request.user
            )
            return Response(
                {
                    "allowed_selling_tiers": allowed_tiers,
                    "user_cost_tier": request.user.cost_tier,
                    "user_cost_tier_display": request.user.get_cost_tier_display()
                    if request.user.cost_tier
                    else None,
                }
            )
        else:
            # Return all available pricing tiers
            tiers = PricingService.get_available_pricing_tiers()
            return Response(
                {
                    "pricing_tiers": [
                        {"value": tier[0], "label": tier[1]} for tier in tiers
                    ]
                }
            )

    def post(self, request):
        """Calculate price for customer and item with user tier validation"""
        customer_id = request.data.get("customer_id")
        item_id = request.data.get("item_id")
        requested_tier = request.data.get("requested_tier")

        if not customer_id or not item_id:
            return Response(
                {"error": "customer_id and item_id are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            customer = Customer.objects.get(pk=customer_id)
            item = Item.objects.get(pk=item_id)

            # Use the enhanced pricing service that considers user restrictions
            final_price, pricing_details = (
                PricingService.get_price_for_user_transaction(
                    customer, item, request.user, requested_tier
                )
            )

            return Response(pricing_details)
        except (Customer.DoesNotExist, Item.DoesNotExist) as e:
            return Response({"error": str(e)}, status=status.HTTP_404_NOT_FOUND)


class ItemBatchViewSet(viewsets.ModelViewSet):
    queryset = ItemBatch.objects.all()
    serializer_class = ItemBatchSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Filter batches based on query parameters"""
        queryset = ItemBatch.objects.select_related(
            "item", "item__brand", "transaction"
        ).all()

        # Filter by item
        item_id = self.request.query_params.get("item_id")
        if item_id:
            queryset = queryset.filter(item_id=item_id)

        # Filter by remaining quantity (for active batches)
        active_only = self.request.query_params.get("active_only")
        if active_only == "true":
            queryset = queryset.filter(remaining_quantity__gt=0)

        return queryset.order_by("item", "batch_number")

    @action(detail=False, methods=["get"])
    def by_item(self, request):
        """Get all batches for a specific item"""
        item_id = request.query_params.get("item_id")
        if not item_id:
            return Response(
                {"error": "item_id parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            item = Item.objects.get(pk=item_id)
            batches = ItemBatch.objects.filter(item=item).order_by("batch_number")
            serializer = self.get_serializer(batches, many=True)
            return Response(
                {"item": ItemSerializer(item).data, "batches": serializer.data}
            )
        except Item.DoesNotExist:
            return Response(
                {"error": "Item not found"}, status=status.HTTP_404_NOT_FOUND
            )

    @action(detail=False, methods=["get"])
    def next_reference_number(self, request):
        """Get the next available reference number for preview"""
        from django.utils import timezone

        current_year = timezone.now().year

        # Get the last transaction for the current year
        last_transaction = (
            Transaction.objects.filter(reference_number__startswith=f"{current_year}-")
            .order_by("-reference_number")
            .first()
        )

        if last_transaction and last_transaction.reference_number:
            try:
                last_number = int(last_transaction.reference_number.split("-")[1])
                next_number = last_number + 1
            except (ValueError, IndexError):
                next_number = 1
        else:
            next_number = 1

        next_ref = f"{current_year}-{next_number:04d}"
        return Response({"next_reference_number": next_ref})

    # ...existing code...
