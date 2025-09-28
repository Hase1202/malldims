#!/usr/bin/env python3
"""
Reset script to delete all data except superuser for fresh testing
This script preserves the superuser account but removes all other data
"""

import os
import sys
import django

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from inventory.models import (
    Transaction, TransactionItem, ItemBatch, Item, Brand, Customer,
    CustomerBrandPricing, ItemTierPricing, CustomerSpecialPricing, Account
)


def reset_all_data():
    """Delete all data except superuser accounts"""
    
    print("🧹 Starting fresh data reset...")
    
    # Delete transaction-related data first (due to foreign key constraints)
    print("  📊 Deleting transactions and transaction items...")
    TransactionItem.objects.all().delete()
    Transaction.objects.all().delete()
    
    # Delete item batches
    print("  📦 Deleting item batches...")
    ItemBatch.objects.all().delete()
    
    # Delete pricing relationships
    print("  💰 Deleting pricing relationships...")
    CustomerSpecialPricing.objects.all().delete()
    ItemTierPricing.objects.all().delete()
    CustomerBrandPricing.objects.all().delete()
    
    # Delete items (must be before brands due to foreign key)
    print("  📋 Deleting items...")
    Item.objects.all().delete()
    
    # Delete customers
    print("  👥 Deleting customers...")
    Customer.objects.all().delete()
    
    # Delete brands last (after all dependent objects)
    print("  🏢 Deleting brands...")
    Brand.objects.all().delete()
    
    # Delete non-superuser accounts
    print("  👤 Deleting non-superuser accounts...")
    non_superuser_accounts = Account.objects.filter(is_superuser=False)
    deleted_count = non_superuser_accounts.count()
    non_superuser_accounts.delete()
    
    # Reset auto-increment counters for fresh start
    print("  🔄 Resetting auto-increment counters...")
    try:
        from django.db import connection
        from django.conf import settings
        
        db_engine = settings.DATABASES['default']['ENGINE']
        
        with connection.cursor() as cursor:
            if 'sqlite' in db_engine:
                # SQLite
                cursor.execute("DELETE FROM sqlite_sequence WHERE name='inventory_brand'")
                cursor.execute("DELETE FROM sqlite_sequence WHERE name='inventory_item'") 
                cursor.execute("DELETE FROM sqlite_sequence WHERE name='transaction'")
                cursor.execute("DELETE FROM sqlite_sequence WHERE name='customer'")
                print("     ✓ SQLite auto-increment counters reset successfully")
            elif 'postgresql' in db_engine:
                # PostgreSQL: determine sequence names dynamically using pg_get_serial_sequence
                def restart_sequence(table_name, column_name):
                    cursor.execute("SELECT pg_get_serial_sequence(%s, %s)", (table_name, column_name))
                    seq = cursor.fetchone()[0]
                    if seq:
                        cursor.execute(f"ALTER SEQUENCE {seq} RESTART WITH 1")
                        print(f"     ✓ Reset sequence: {seq}")
                    else:
                        print(f"     ⚠️  No sequence found for {table_name}.{column_name}")

                restart_sequence('inventory_brand', 'brand_id')
                restart_sequence('inventory_item', 'item_id')
                restart_sequence('transaction', 'transaction_id')
                restart_sequence('customer', 'customer_id')
                print("     ✓ PostgreSQL auto-increment sequences reset where available")
            elif 'mysql' in db_engine:
                # MySQL
                cursor.execute("ALTER TABLE inventory_brand AUTO_INCREMENT = 1")
                cursor.execute("ALTER TABLE inventory_item AUTO_INCREMENT = 1")
                cursor.execute("ALTER TABLE transaction AUTO_INCREMENT = 1")
                cursor.execute("ALTER TABLE customer AUTO_INCREMENT = 1")
                print("     ✓ MySQL auto-increment counters reset successfully")
            else:
                print(f"     ⚠️  Unknown database engine: {db_engine}")
                print("     Manual sequence reset may be required")
    except Exception as e:
        print(f"     ⚠️  Could not reset auto-increment counters: {e}")
        print("     This may be expected depending on your database configuration")
    
    # Get remaining superuser count
    superuser_count = Account.objects.filter(is_superuser=True).count()
    
    # Verify deletion
    remaining_brands = Brand.objects.count()
    remaining_items = Item.objects.count()
    
    print(f"✅ Fresh data reset completed!")
    print(f"   • Deleted {deleted_count} non-superuser accounts")
    print(f"   • Preserved {superuser_count} superuser account(s)")
    print(f"   • Remaining brands: {remaining_brands}")
    print(f"   • Remaining items: {remaining_items}")
    print("   • All transactions, items, brands, customers, and related data deleted")
    print("\n🚀 Ready for fresh testing with sequential reference numbers starting from 2025-0001!")
    print("💡 Next brand created will have ID 1, so first item SKU will be 101-001")


if __name__ == '__main__':
    try:
        reset_all_data()
    except Exception as e:
        print(f"❌ Error during reset: {e}")
        sys.exit(1)
