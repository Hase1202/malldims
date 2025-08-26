from django.shortcuts import render, get_object_or_404
from django.db import models
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView as BaseTokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth import authenticate
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
import json
from django.db.models import Count, Q, F
import logging

# Import your models and serializers
from .models import (
    Item, Brand, Customer, Transaction, InventoryChange, 
    Account, ItemPricing, InventoryBatch, CustomerSpecialPrice, BatchSale
)
from .serializers import (
    ItemSerializer, BrandSerializer, CustomerSerializer,
    TransactionSerializer, TransactionCreateSerializer,
    InventoryChangeSerializer, InventoryChangeWithTransactionSerializer,
    AccountSerializer, UserProfileUpdateSerializer, ItemPricingSerializer,
    InventoryBatchSerializer, CustomerSpecialPriceSerializer, BatchSaleSerializer
)

# Custom Token Serializer
class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)

        # Add custom claims
        token['username'] = user.username
        token['role'] = user.role
        token['first_name'] = user.first_name
        token['last_name'] = user.last_name
        token['account_id'] = user.account_id

        return token

class CustomTokenObtainPairView(BaseTokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

# Use your custom token view class
TokenObtainPairView = CustomTokenObtainPairView

logger = logging.getLogger(__name__)

# Existing ViewSets (keeping your original structure)
class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.all()
    serializer_class = ItemSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter and order items based on query parameters"""
        queryset = self.queryset.select_related('brand')
        
        # Handle pagination override
        if self.request.query_params.get('all') == 'true':
            self.pagination_class = None
        
        # Search functionality
        search = self.request.query_params.get('search', '')
        if search:
            queryset = queryset.filter(
                models.Q(item_name__icontains=search) |
                models.Q(model_number__icontains=search) |
                models.Q(brand__brand_name__icontains=search)
            )
        
        # Filter by item type
        item_type = self.request.query_params.get('item_type')
        if item_type:
            queryset = queryset.filter(item_type=item_type)
        
        # Filter by category
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        
        # Filter by brand
        brand = self.request.query_params.get('brand')
        if brand:
            queryset = queryset.filter(brand=brand)
        
        # Filter by availability status
        availability_status = self.request.query_params.get('availability_status')
        if availability_status:
            queryset = queryset.filter(availability_status=availability_status)
        
        # Ordering
        ordering = self.request.query_params.get('ordering', '-updated_at')
        if ordering:
            queryset = queryset.order_by(ordering)
        
        return queryset
    
    def retrieve(self, request, pk=None):
        """Get a single item by ID"""
        try:
            logger.info(f"Fetching item with ID: {pk}")
            
            # Use get_object_or_404 for better error handling
            item = get_object_or_404(Item, pk=pk)
            serializer = self.get_serializer(item)
            
            logger.info(f"Successfully fetched item: {item.item_name}")
            return Response(serializer.data)
            
        except Exception as e:
            logger.error(f"Error fetching item {pk}: {str(e)}", exc_info=True)
            return Response({
                'error': f'Failed to fetch item: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get inventory statistics"""
        try:
            logger.info("Fetching inventory stats")
            
            # Get total items count
            total_items = Item.objects.count()
            
            # Get low stock items (where quantity <= threshold_value)
            low_stock = Item.objects.filter(
                quantity__lte=models.F('threshold_value'),
                quantity__gt=0
            ).count()
            
            # Get out of stock items (where quantity = 0)
            out_of_stock = Item.objects.filter(quantity=0).count()
            
            stats_data = {
                'total_items': total_items,
                'low_stock': low_stock,
                'out_of_stock': out_of_stock
            }
            
            logger.info(f"Stats calculated: {stats_data}")
            return Response(stats_data)
            
        except Exception as e:
            logger.error(f"Error calculating stats: {str(e)}", exc_info=True)
            return Response({
                'error': f'Failed to calculate stats: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Get item transaction history"""
        try:
            logger.info(f"Fetching history for item {pk}")
            
            # Get the item first
            item = get_object_or_404(Item, pk=pk)
            
            # Get all inventory changes for this item, ordered by most recent first
            from .models import InventoryChange
            from .serializers import InventoryChangeWithTransactionSerializer
            
            inventory_changes = InventoryChange.objects.filter(
                item=item
            ).select_related('transaction', 'batch').order_by('-created_at')
            
            # Serialize the data
            serializer = InventoryChangeWithTransactionSerializer(inventory_changes, many=True)
            
            logger.info(f"Found {len(inventory_changes)} history records for item {pk}")
            return Response(serializer.data)
            
        except Exception as e:
            logger.error(f"Error fetching item history for {pk}: {str(e)}", exc_info=True)
            return Response({
                'error': f'Failed to fetch history: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def update(self, request, pk=None):
        """Update an item"""
        try:
            item = get_object_or_404(Item, pk=pk)
            
            # Log the incoming data for debugging
            logger.info(f"Updating item {pk} with data: {request.data}")
            
            # Use partial=False to require all fields, or partial=True to allow partial updates
            serializer = self.get_serializer(item, data=request.data, partial=True)
            
            if serializer.is_valid():
                # Check for duplicates (excluding current item)
                item_name = serializer.validated_data.get('item_name', item.item_name)
                model_number = serializer.validated_data.get('model_number', item.model_number)
                brand = serializer.validated_data.get('brand', item.brand)
                
                duplicate = Item.objects.filter(
                    item_name=item_name,
                    model_number=model_number,
                    brand=brand
                ).exclude(pk=pk).first()
                
                if duplicate:
                    return Response({
                        'message': 'Item with these details already exists'
                    }, status=status.HTTP_400_BAD_REQUEST)
                
                # Save the updated item
                updated_item = serializer.save()
                
                # Update availability status based on quantity
                if hasattr(updated_item, 'quantity'):
                    if updated_item.quantity == 0:
                        updated_item.availability_status = 'Out of Stock'
                    elif updated_item.quantity <= updated_item.threshold_value:
                        updated_item.availability_status = 'Low Stock'
                    else:
                        updated_item.availability_status = 'In Stock'
                    updated_item.save()
                
                logger.info(f"Successfully updated item {pk}")
                return Response(serializer.data)
            else:
                logger.error(f"Validation errors for item {pk}: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"Error updating item {pk}: {str(e)}", exc_info=True)
            return Response({
                'error': f'Failed to update item: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def export_csv(self, request):
        """Export filtered items as CSV"""
        import csv
        from django.http import HttpResponse
        from datetime import datetime
        
        try:
            # Get filtered queryset
            queryset = self.get_queryset()
            
            # Create response with CSV content type
            response = HttpResponse(content_type='text/csv')
            filename = f'inventory_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            
            writer = csv.writer(response)
            
            # Write header
            writer.writerow([
                'Item Name', 'Model Number', 'Item Type', 'Category', 
                'Brand', 'Quantity', 'Threshold', 'Availability Status',
                'Created At', 'Updated At'
            ])
            
            # Write data rows
            for item in queryset:
                writer.writerow([
                    item.item_name,
                    item.model_number,
                    item.item_type,
                    item.category,
                    item.brand.brand_name if item.brand else '',
                    item.quantity,
                    item.threshold_value,
                    item.availability_status,
                    item.created_at.strftime('%Y-%m-%d %H:%M:%S') if item.created_at else '',
                    item.updated_at.strftime('%Y-%m-%d %H:%M:%S') if item.updated_at else '',
                ])
            
            return response
            
        except Exception as e:
            logger.error(f"Error exporting CSV: {str(e)}", exc_info=True)
            return Response({
                'error': f'Failed to export CSV: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def next_batch_number(self, request, pk=None):
        """Get the next available batch number for a specific item"""
        try:
            item = get_object_or_404(Item, pk=pk)
            
            # Get all existing batch numbers for this item from InventoryBatch model
            existing_batches = InventoryBatch.objects.filter(item=item).values_list('batch_number', flat=True)
            
            # Extract numeric parts from batch numbers (B-001 -> 1, B-002 -> 2, etc.)
            used_numbers = set()
            for batch_number in existing_batches:
                if batch_number and batch_number.startswith('B-'):
                    try:
                        number_part = batch_number.split('-')[1]
                        if number_part.isdigit():
                            used_numbers.add(int(number_part))
                    except (IndexError, ValueError):
                        continue
            
            # Find the lowest available number starting from 1
            next_number = 1
            while next_number in used_numbers:
                next_number += 1
            
            # Format as B-XXX (3 digits)
            next_batch_number = f"B-{next_number:03d}"
            
            return Response({
                'next_batch_number': next_batch_number,
                'item_id': item.item_id,
                'item_name': item.item_name
            })
            
        except Exception as e:
            logger.error(f"Error getting next batch number for item {pk}: {str(e)}", exc_info=True)
            return Response({
                'error': f'Failed to get next batch number: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def validate_batch_number(self, request, pk=None):
        """Validate if a batch number is available for a specific item"""
        try:
            item = get_object_or_404(Item, pk=pk)
            batch_number = request.data.get('batch_number', '')
            
            if not batch_number:
                return Response({
                    'valid': False,
                    'message': 'Batch number is required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Check if batch number already exists for this item
            exists = InventoryBatch.objects.filter(
                item=item, 
                batch_number=batch_number
            ).exists()
            
            if exists:
                return Response({
                    'valid': False,
                    'message': f'Batch number {batch_number} already exists for this item'
                })
            else:
                return Response({
                    'valid': True,
                    'message': f'Batch number {batch_number} is available'
                })
                
        except Exception as e:
            logger.error(f"Error validating batch number for item {pk}: {str(e)}", exc_info=True)
            return Response({
                'error': f'Failed to validate batch number: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class TransactionViewSet(viewsets.ModelViewSet):
    queryset = Transaction.objects.all().order_by('-transacted_date')
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'create':
            return TransactionCreateSerializer
        return TransactionSerializer
    
    def perform_create(self, serializer):
        # Automatically set the account to the current user's account
        serializer.save(account=self.request.user)
    
    def get_queryset(self):
        queryset = self.queryset
        
        # Filter by transaction type
        transaction_type = self.request.query_params.get('transaction_type')
        if transaction_type:
            queryset = queryset.filter(transaction_type=transaction_type)
        
        # Filter by status
        status = self.request.query_params.get('transaction_status')
        if status:
            queryset = queryset.filter(transaction_status=status)
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(transacted_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(transacted_date__lte=end_date)
        
        return queryset

# New Beauty Product ViewSets
class BrandViewSet(viewsets.ModelViewSet):
    queryset = Brand.objects.all().order_by('brand_name')
    serializer_class = BrandSerializer
    permission_classes = [IsAuthenticated]
    
    def list(self, request, *args, **kwargs):
        """List brands with debug logging"""
        print(f"BrandViewSet.list called with params: {request.query_params}")
        queryset = self.get_queryset()
        print(f"Queryset count: {queryset.count()}")
        
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            print(f"Paginated response with {len(serializer.data)} items")
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        print(f"Non-paginated response with {len(serializer.data)} items")
        return Response(serializer.data)
    
    def create(self, request, *args, **kwargs):
        """Create brand with debug logging"""
        print(f"BrandViewSet.create called with data: {request.data}")
        response = super().create(request, *args, **kwargs)
        print(f"Brand created successfully: {response.data}")
        return response
    
    def get_queryset(self):
        queryset = self.queryset
        
        if self.request.query_params.get('all') == 'true':
            self.pagination_class = None
        
        search = self.request.query_params.get('search', '')
        if search:
            queryset = queryset.filter(
                models.Q(brand_name__icontains=search) |
                models.Q(city__icontains=search) |
                models.Q(contact_person__icontains=search)
            )
        
        return queryset

class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all().order_by('-created_at')
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = self.queryset
        
        if self.request.query_params.get('all') == 'true':
            self.pagination_class = None
        
        search = self.request.query_params.get('search', '')
        if search:
            queryset = queryset.filter(
                models.Q(company_name__icontains=search) |
                models.Q(contact_person__icontains=search) |
                models.Q(customer_type__icontains=search)
            )
        
        customer_type = self.request.query_params.get('customer_type')
        if customer_type:
            queryset = queryset.filter(customer_type=customer_type)
        
        return queryset

class InventoryBatchViewSet(viewsets.ModelViewSet):
    queryset = InventoryBatch.objects.all().order_by('-created_at')
    serializer_class = InventoryBatchSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        queryset = self.queryset
        
        # Filter by item
        item = self.request.query_params.get('item')
        if item:
            queryset = queryset.filter(item=item)
        
        # Filter by expiry status
        expiry_status = self.request.query_params.get('expiry_status')
        if expiry_status == 'expired':
            queryset = queryset.filter(expiry_date__lt=timezone.now().date())
        elif expiry_status == 'expiring_soon':
            # Items expiring in next 30 days
            from datetime import timedelta
            soon_date = timezone.now().date() + timedelta(days=30)
            queryset = queryset.filter(
                expiry_date__gte=timezone.now().date(),
                expiry_date__lte=soon_date
            )
        
        return queryset

class ItemPricingViewSet(viewsets.ModelViewSet):
    """ViewSet for managing item pricing tiers"""
    queryset = ItemPricing.objects.all()
    serializer_class = ItemPricingSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter pricing by item if specified"""
        queryset = self.queryset.select_related('item', 'created_by')
        
        # Filter by item
        item_id = self.request.query_params.get('item_id')
        if item_id:
            queryset = queryset.filter(item_id=item_id)
        
        # Filter by active status
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        return queryset
    
    def perform_create(self, serializer):
        """Auto-set created_by when creating pricing"""
        serializer.save(created_by=self.request.user)
    
    @action(detail=False, methods=['get'])
    def get_user_allowed_tiers(self, request):
        """Get pricing tiers - simplified since users don't have cost tiers"""
        return Response({
            'tier_hierarchy': ['RD', 'PD', 'DD', 'CD', 'RS', 'SUB', 'SRP']
        })
    
    @action(detail=True, methods=['get'])
    def get_prices_for_user(self, request, pk=None):
        """Get all available prices for an item"""
        pricing = self.get_object()
        all_tiers = ['RD', 'PD', 'DD', 'CD', 'RS', 'SUB', 'SRP']
        
        available_prices = {}
        for tier in all_tiers:
            price = pricing.get_price_for_tier(tier)
            if price > 0:  # Only include non-zero prices
                available_prices[tier] = {
                    'price': float(price),
                    'tier_name': tier
                }
        
        return Response({
            'item_id': pricing.item.item_id,
            'item_name': pricing.item.item_name,
            'available_prices': available_prices
        })

class BatchSaleViewSet(viewsets.ModelViewSet):
    """ViewSet for tracking batch-specific sales"""
    queryset = BatchSale.objects.all()
    serializer_class = BatchSaleSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter batch sales based on query parameters"""
        queryset = self.queryset.select_related('batch', 'inventory_change')
        
        # Filter by batch
        batch_id = self.request.query_params.get('batch_id')
        if batch_id:
            queryset = queryset.filter(batch_id=batch_id)
        
        # Filter by item (through batch)
        item_id = self.request.query_params.get('item_id')
        if item_id:
            queryset = queryset.filter(batch__item_id=item_id)
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(created_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__date__lte=end_date)
        
        return queryset.order_by('-created_at')
    
    @action(detail=False, methods=['get'])
    def profit_analysis(self, request):
        """Get profit analysis across batch sales"""
        queryset = self.get_queryset()
        
        # Calculate totals
        total_profit = sum(sale.total_profit for sale in queryset)
        total_sales = queryset.count()
        
        if total_sales > 0:
            avg_profit_per_sale = total_profit / total_sales
        else:
            avg_profit_per_sale = 0
        
        # Group by item for item-level analysis
        item_profits = {}
        for sale in queryset:
            item_name = sale.batch.item.item_name
            if item_name not in item_profits:
                item_profits[item_name] = {
                    'total_profit': 0,
                    'total_quantity': 0,
                    'sale_count': 0
                }
            
            item_profits[item_name]['total_profit'] += sale.total_profit
            item_profits[item_name]['total_quantity'] += sale.quantity_sold
            item_profits[item_name]['sale_count'] += 1
        
        return Response({
            'total_profit': total_profit,
            'total_sales': total_sales,
            'avg_profit_per_sale': avg_profit_per_sale,
            'item_breakdown': item_profits
        })

class CustomerSpecialPriceViewSet(viewsets.ModelViewSet):
    """ViewSet for managing customer special pricing with approval workflow"""
    queryset = CustomerSpecialPrice.objects.all()
    serializer_class = CustomerSpecialPriceSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Filter special prices based on query parameters"""
        queryset = self.queryset.select_related('customer', 'item', 'created_by', 'approved_by')
        
        # Filter by customer
        customer_id = self.request.query_params.get('customer_id')
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        
        # Filter by item
        item_id = self.request.query_params.get('item_id')
        if item_id:
            queryset = queryset.filter(item_id=item_id)
        
        # Filter by approval status
        approval_status = self.request.query_params.get('approval_status')
        if approval_status == 'approved':
            queryset = queryset.filter(is_approved=True)
        elif approval_status == 'pending':
            queryset = queryset.filter(is_approved=False)
        
        return queryset.order_by('-created_at')
    
    def perform_create(self, serializer):
        """Auto-set created_by when creating special price"""
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """Approve a special price request"""
        special_price = self.get_object()
        
        if special_price.is_approved:
            return Response({
                'error': 'Special price is already approved'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        special_price.is_approved = True
        special_price.approved_by = request.user
        special_price.approved_at = timezone.now()
        special_price.save()
        
        return Response({
            'message': 'Special price approved successfully',
            'approved_by': request.user.username,
            'approved_at': special_price.approved_at
        })
    
    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """Reject a special price request"""
        special_price = self.get_object()
        
        if special_price.is_approved:
            return Response({
                'error': 'Cannot reject an already approved special price'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # For now, we'll delete rejected requests. In a full system,
        # you might want to keep them with a "rejected" status
        special_price.delete()
        
        return Response({
            'message': 'Special price request rejected and removed'
        })

# User and Authentication Views
class UserInfoView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        serializer = AccountSerializer(request.user)
        return Response(serializer.data)
    
    def put(self, request):
        serializer = UserProfileUpdateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = request.user
            
            # Update basic info
            if 'first_name' in serializer.validated_data:
                user.first_name = serializer.validated_data['first_name']
            if 'last_name' in serializer.validated_data:
                user.last_name = serializer.validated_data['last_name']
            
            # Update password if provided
            if 'new_password' in serializer.validated_data:
                user.set_password(serializer.validated_data['new_password'])
            
            user.save()
            
            return Response({
                'status': 'success',
                'message': 'Profile updated successfully'
            })
        
        return Response({
            'status': 'error',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)

class UserListView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        users = Account.objects.all().order_by('username')
        serializer = AccountSerializer(users, many=True)
        return Response(serializer.data)

# Dashboard and Reports
class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Basic inventory stats
        total_items = Item.objects.count()
        low_stock = Item.objects.filter(availability_status='Low Stock').count()
        out_of_stock = Item.objects.filter(availability_status='Out of Stock').count()
        
        # Beauty product specific stats
        beauty_products = Item.objects.filter(item_type='Beauty Product').count()
        
        # Brand stats
        total_brands = Brand.objects.filter(status='Active').count()
        
        # Customer stats
        total_customers = Customer.objects.filter(status='Active').count()
        
        # Recent transactions (last 30 days)
        from datetime import timedelta
        thirty_days_ago = timezone.now().date() - timedelta(days=30)
        recent_transactions = Transaction.objects.filter(
            transacted_date__gte=thirty_days_ago
        ).count()
        
        # Expired items
        expired_batches = InventoryBatch.objects.filter(
            expiry_date__lt=timezone.now().date()
        ).count()
        
        return Response({
            'inventory': {
                'total_items': total_items,
                'low_stock': low_stock,
                'out_of_stock': out_of_stock,
                'beauty_products': beauty_products,
            },
            'business': {
                'total_brands': total_brands,
                'total_customers': total_customers,
                'recent_transactions': recent_transactions,
            },
            'alerts': {
                'expired_batches': expired_batches,
            }
        })

class SalesReportView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Get date range from query params
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        queryset = Transaction.objects.filter(transaction_type='Sale')
        
        if start_date:
            queryset = queryset.filter(transacted_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(transacted_date__lte=end_date)
        
        # Calculate totals
        from django.db.models import Sum, Count
        totals = queryset.aggregate(
            total_sales=Sum('total_amount'),
            total_transactions=Count('transaction_id'),
            total_vat=Sum('vat_amount')
        )
        
        # Group by date
        daily_sales = queryset.values('transacted_date').annotate(
            daily_total=Sum('total_amount'),
            transaction_count=Count('transaction_id')
        ).order_by('transacted_date')
        
        return Response({
            'summary': totals,
            'daily_breakdown': daily_sales
        })

class InventoryValueReportView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        # Calculate inventory value based on batches
        from django.db.models import Sum, F
        
        batch_values = InventoryBatch.objects.annotate(
            batch_value=F('cost_price') * F('quantity_available')
        ).aggregate(
            total_value=Sum('batch_value')
        )
        
        # Group by item type
        item_type_values = Item.objects.values('item_type').annotate(
            type_value=Sum(F('quantity') * F('batches__cost_price'))
        )
        
        # Group by brand
        brand_values = Item.objects.values('brand__brand_name').annotate(
            brand_value=Sum(F('quantity') * F('batches__cost_price'))
        ).exclude(brand__brand_name__isnull=True)
        
        return Response({
            'total_inventory_value': batch_values['total_value'] or 0,
            'by_item_type': item_type_values,
            'by_brand': brand_values
        })

# Legacy login view (if needed)
@csrf_exempt
def login_view(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        username = data.get('username')
        password = data.get('password')
        
        user = authenticate(username=username, password=password)
        if user:
            return JsonResponse({
                'success': True,
                'user_id': user.account_id,
                'username': user.username,
                'role': user.role
            })
        else:
            return JsonResponse({'success': False, 'error': 'Invalid credentials'})
    
    return JsonResponse({'success': False, 'error': 'Invalid request method'})