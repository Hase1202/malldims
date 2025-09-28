#!/usr/bin/env python
"""
Complete database reset script that resets all data and sequences
"""
import os
import sys
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection
from inventory.models import (
    Brand, Customer, Item, Transaction, TransactionItem,
    CustomerBrandPricing, CustomerSpecialPricing, ItemTierPricing
)
from django.contrib.auth import get_user_model

User = get_user_model()

def reset_database():
    """Reset all data and sequences"""
    print("🔄 Starting comprehensive database reset...")
    
    # 1. Delete all data (preserving admin accounts)
    print("📝 Deleting all data...")
    
    # Delete related models first (to avoid foreign key constraints)
    ItemTierPricing.objects.all().delete()
    TransactionItem.objects.all().delete()
    CustomerBrandPricing.objects.all().delete()
    CustomerSpecialPricing.objects.all().delete()
    Transaction.objects.all().delete()
    Item.objects.all().delete()
    Customer.objects.all().delete()
    Brand.objects.all().delete()
    
    # Keep admin users but delete non-admin users
    User.objects.filter(is_superuser=False, is_staff=False).delete()
    
    print(f"✅ Data deleted successfully")
    
    # 2. Reset auto-increment sequences
    print("🔢 Resetting auto-increment sequences...")
    
    with connection.cursor() as cursor:
        # Get the database engine
        db_engine = connection.settings_dict['ENGINE']
        
        if 'sqlite' in db_engine:
            # SQLite sequence reset
            tables_and_sequences = [
                ('inventory_brand', 'brand_id'),
                ('inventory_customer', 'customer_id'), 
                ('inventory_item', 'item_id'),
                ('inventory_transaction', 'transaction_id'),
                ('inventory_transactionitem', 'id'),
                ('inventory_customerbrandpricing', 'id'),
                ('inventory_customerspecialpricing', 'id'),
                ('inventory_itemtierpricing', 'id'),
            ]
            
            for table, _ in tables_and_sequences:
                cursor.execute(f"DELETE FROM sqlite_sequence WHERE name='{table}';")
                
        elif 'postgresql' in db_engine:
            # PostgreSQL sequence reset using pg_get_serial_sequence
            tables = [
                ('inventory_brand', 'brand_id'),
                ('customer', 'customer_id'),
                ('inventory_item', 'item_id'),
                ('transaction', 'transaction_id'),
                ('transaction_item', 'id'),
                ('customer_brand_pricing', 'id'),
                ('customer_special_pricing', 'id'),
                ('item_tier_pricing', 'id'),
            ]
            
            for table, column in tables:
                try:
                    cursor.execute(f"""
                        SELECT setval(pg_get_serial_sequence('"{table}"','{column}'), 1, false);
                    """)
                except Exception as e:
                    print(f"⚠️  Warning: Could not reset sequence for {table}.{column}: {e}")
                    
        else:
            print(f"⚠️  Warning: Sequence reset not implemented for {db_engine}")
    
    print("✅ Sequences reset successfully")
    
    # 3. Create a sample brand to test with
    print("📦 Creating sample data...")
    
    sample_brand = Brand.objects.create(
        brand_name="Test Brand",
        contact_person="Test Contact",
        mobile_number="09123456789",
        email="test@testbrand.com",
        status="Active"
    )
    
    print(f"✅ Created sample brand: {sample_brand.brand_name} (ID: {sample_brand.brand_id})")
    
    # Print summary
    print("\n" + "="*50)
    print("🎉 Database reset completed successfully!")
    print("="*50)
    print(f"📊 Current state:")
    print(f"   • Brands: {Brand.objects.count()}")
    print(f"   • Items: {Item.objects.count()}")
    print(f"   • Customers: {Customer.objects.count()}")
    print(f"   • Transactions: {Transaction.objects.count()}")
    print(f"   • Admin users preserved: {User.objects.filter(is_superuser=True).count()}")
    
    if Brand.objects.exists():
        first_brand = Brand.objects.first()
        print(f"   • First brand ID: {first_brand.brand_id}")
        print(f"   • Next SKU will start with: {first_brand.brand_id + 100}-001")

if __name__ == "__main__":
    try:
        reset_database()
    except Exception as e:
        print(f"❌ Error during reset: {e}")
        sys.exit(1)
