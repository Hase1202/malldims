#!/usr/bin/env python
"""
Script to completely reset ALL data in the inventory management system.
This will delete EVERYTHING: transactions, items, customers, brands, accounts, pricing data.
Only keeps Django superuser accounts.
"""

import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from inventory.models import (
    Transaction, TransactionItem, Item, Customer, Brand, Account,
    CustomerBrandPricing, ItemTierPricing, CustomerSpecialPricing
)

def reset_all_data():
    """Completely reset ALL data in the database"""
    print("Starting COMPLETE data reset...")
    print("This will delete EVERYTHING except Django superuser accounts!")
    
    # Delete in order to avoid foreign key constraints
    print("\n1. Deleting all transactions and transaction items...")
    TransactionItem.objects.all().delete()
    Transaction.objects.all().delete()
    print(f"   Deleted all transactions")
    
    print("\n2. Deleting all pricing data...")
    CustomerSpecialPricing.objects.all().delete()
    ItemTierPricing.objects.all().delete()
    CustomerBrandPricing.objects.all().delete()
    print(f"   Deleted all pricing configurations")
    
    print("\n3. Deleting all inventory items...")
    Item.objects.all().delete()
    print(f"   Deleted all inventory items")
    
    print("\n4. Deleting all customers...")
    Customer.objects.all().delete()
    print(f"   Deleted all customers")
    
    print("\n5. Deleting all brands...")
    Brand.objects.all().delete()
    print(f"   Deleted all brands")
    
    print("\n6. Deleting all accounts (keeping only superuser accounts)...")
    # Keep only superuser accounts (role='Admin' or accounts with superuser privileges)
    superuser_accounts = Account.objects.filter(role='Admin')
    non_superuser_count = Account.objects.exclude(role='Admin').count()
    Account.objects.exclude(role='Admin').delete()
    remaining_accounts = Account.objects.count()
    print(f"   Deleted {non_superuser_count} accounts, kept {remaining_accounts} admin account(s)")
    
    print("\n" + "="*50)
    print("COMPLETE DATA RESET FINISHED!")
    print("="*50)
    print("\nFinal counts:")
    print(f"📊 Transactions: {Transaction.objects.count()}")
    print(f"📦 Items: {Item.objects.count()}")
    print(f"👥 Customers: {Customer.objects.count()}")
    print(f"🏷️  Brands: {Brand.objects.count()}")
    print(f"👤 Accounts: {Account.objects.count()}")
    print(f"💰 Customer Brand Pricing: {CustomerBrandPricing.objects.count()}")
    print(f"💰 Item Tier Pricing: {ItemTierPricing.objects.count()}")
    print(f"💰 Customer Special Pricing: {CustomerSpecialPricing.objects.count()}")
    
    print("\n✅ Your database is now completely clean and ready for testing!")
    print("   You can now add fresh data through the frontend.")

if __name__ == "__main__":
    print("⚠️  WARNING: COMPLETE DATA RESET ⚠️")
    print("This will delete ALL data in your database:")
    print("- All transactions and transaction history")
    print("- All inventory items")
    print("- All customers")
    print("- All brands")
    print("- All accounts (except Admin accounts)")
    print("- All pricing configurations")
    print("\nThis action CANNOT be undone!")
    
    confirm1 = input("\nType 'DELETE' to confirm you want to delete everything: ")
    if confirm1 == 'DELETE':
        confirm2 = input("Are you absolutely sure? Type 'YES' to proceed: ")
        if confirm2 == 'YES':
            reset_all_data()
        else:
            print("❌ Data reset cancelled.")
    else:
        print("❌ Data reset cancelled.")
