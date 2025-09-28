"""
Business logic services for inventory management
"""
from decimal import Decimal
from typing import Optional, Tuple
from .models import (
    Customer, Item, CustomerBrandPricing, 
    ItemTierPricing, CustomerSpecialPricing
)


class PricingService:
    """Service class for pricing calculations and business logic"""
    
    @staticmethod
    def get_price(customer: Customer, item: Item) -> Tuple[Decimal, dict]:
        """
        Calculate the final price for an item for a specific customer.
        
        Args:
            customer: Customer instance
            item: Item instance
            
        Returns:
            Tuple containing:
            - final_price: Decimal - The calculated final price
            - pricing_details: dict - Details about the pricing calculation
        """
        pricing_details = {
            'customer_id': customer.customer_id,
            'customer_name': customer.company_name,
            'item_id': item.item_id,
            'item_name': item.item_name,
            'brand_name': item.brand.brand_name,
            'pricing_tier': None,
            'base_price': Decimal('0.00'),
            'special_discount': Decimal('0.00'),
            'final_price': Decimal('0.00'),
            'has_special_pricing': False,
            'error': None
        }
        
        try:
            # Step 1: Find the pricing tier for the customer and item's brand
            customer_brand_pricing = CustomerBrandPricing.objects.filter(
                customer=customer,
                brand=item.brand
            ).first()
            
            if not customer_brand_pricing:
                pricing_details['error'] = f"No pricing tier found for customer '{customer.company_name}' and brand '{item.brand.brand_name}'"
                return Decimal('0.00'), pricing_details
            
            pricing_tier = customer_brand_pricing.pricing_tier
            pricing_details['pricing_tier'] = pricing_tier
            
            # Step 2: Find the standard price for the item at that pricing tier
            item_tier_pricing = ItemTierPricing.objects.filter(
                item=item,
                pricing_tier=pricing_tier
            ).first()
            
            if not item_tier_pricing:
                pricing_details['error'] = f"No price found for item '{item.item_name}' at tier '{pricing_tier}'"
                return Decimal('0.00'), pricing_details
            
            base_price = item_tier_pricing.price
            pricing_details['base_price'] = base_price
            
            # Step 3: Check for special pricing
            special_pricing = CustomerSpecialPricing.objects.filter(
                customer=customer,
                item=item
            ).first()
            
            if special_pricing:
                pricing_details['has_special_pricing'] = True
                pricing_details['special_discount'] = special_pricing.discount
                final_price = base_price + special_pricing.discount  # discount should be negative
            else:
                final_price = base_price
            
            pricing_details['final_price'] = final_price
            
            return final_price, pricing_details
            
        except Exception as e:
            pricing_details['error'] = str(e)
            return Decimal('0.00'), pricing_details
    
    @staticmethod
    def get_customer_pricing_for_item(item: Item) -> list:
        """
        Get all customers who have special pricing for a specific item.
        
        Args:
            item: Item instance
            
        Returns:
            List of dictionaries containing customer pricing information
        """
        special_pricing_list = []
        
        special_pricings = CustomerSpecialPricing.objects.filter(item=item).select_related('customer')
        
        for special_pricing in special_pricings:
            customer = special_pricing.customer
            final_price, pricing_details = PricingService.get_price(customer, item)
            
            special_pricing_list.append({
                'customer_id': customer.customer_id,
                'customer_name': customer.company_name,
                'pricing_tier': pricing_details.get('pricing_tier'),
                'base_price': pricing_details.get('base_price'),
                'special_discount': special_pricing.discount,
                'final_price': final_price,
                'created_at': special_pricing.created_at
            })
        
        return special_pricing_list
    
    @staticmethod
    def validate_special_pricing_discount(discount: Decimal) -> bool:
        """
        Validate that the special pricing discount is negative.
        
        Args:
            discount: Decimal value to validate
            
        Returns:
            bool: True if valid (negative), False otherwise
        """
        return discount < 0
    
    @staticmethod
    def get_available_pricing_tiers() -> list:
        """
        Get all available pricing tiers.
        
        Returns:
            List of tuples (value, display_name)
        """
        from .models import PRICING_TIER_CHOICES
        return PRICING_TIER_CHOICES


class TransactionService:
    """Service class for transaction-related business logic"""
    
    @staticmethod
    def calculate_transaction_totals(transaction_items: list) -> dict:
        """
        Calculate total amounts for a transaction.
        
        Args:
            transaction_items: List of transaction item data
            
        Returns:
            Dictionary with calculated totals
        """
        subtotal = Decimal('0.00')
        vat_amount = Decimal('0.00')
        
        for item_data in transaction_items:
            quantity = item_data.get('quantity', 0)
            unit_price = Decimal(str(item_data.get('unit_price', 0)))
            item_total = quantity * unit_price
            subtotal += item_total
        
        # Calculate VAT (12% in Philippines)
        vat_rate = Decimal('0.12')
        vat_amount = subtotal * vat_rate
        total_amount = subtotal + vat_amount
        
        return {
            'subtotal': subtotal,
            'vat_amount': vat_amount,
            'total_amount': total_amount
        }
    
    @staticmethod
    def update_inventory_for_transaction(transaction, transaction_items: list):
        """
        Update inventory quantities based on transaction type.
        
        Args:
            transaction: Transaction instance
            transaction_items: List of TransactionItem instances or data
        """
        for item_data in transaction_items:
            if hasattr(item_data, 'item'):
                # TransactionItem instance
                item = item_data.item
                quantity = item_data.quantity
            else:
                # Dictionary data
                from .models import Item
                item = Item.objects.get(pk=item_data['item_id'])
                quantity = item_data['quantity']
            
            if transaction.transaction_type == 'INCOMING':
                # Add to inventory
                item.quantity += quantity
            elif transaction.transaction_type == 'OUTGOING':
                # Remove from inventory
                item.quantity -= quantity
                if item.quantity < 0:
                    item.quantity = 0  # Prevent negative inventory
            
            item.save()
