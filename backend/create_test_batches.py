#!/usr/bin/env python3
"""
Utility script to create test inventory batches for testing batch selection functionality.
Run this script to populate your database with sample inventory batches.

Usage:
    python manage.py shell < create_test_batches.py

Or:
    python create_test_batches.py
"""

import os
import sys
import django
from decimal import Decimal

# Setup Django environment
if __name__ == "__main__":
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    django.setup()

from inventory.models import (
    Item,
    Brand,
    ItemBatch,
    Account,
    Transaction,
    ItemTierPricing,
    Customer,
)


def create_test_data():
    """Create comprehensive test data including batches"""

    print("🚀 Creating test data for batch selection...")

    # 1. Create or get test brand
    brand, created = Brand.objects.get_or_create(
        brand_name="Test Beauty Brand",
        defaults={
            "street_name": "Test Street",
            "city": "Test City",
            "vat_classification": "VAT",
            "status": "Active",
        },
    )
    if created:
        print(f"✅ Created brand: {brand.brand_name}")
    else:
        print(f"ℹ️  Using existing brand: {brand.brand_name}")

    # 2. Create or get test items
    test_items = [
        {"name": "Lipstick - Red", "uom": "pc"},
        {"name": "Foundation - Light", "uom": "pc"},
        {"name": "Mascara - Black", "uom": "pc"},
        {"name": "Blush - Pink", "uom": "pc"},
        {"name": "Eyeshadow Palette", "uom": "pack"},
    ]

    items = []
    for item_data in test_items:
        item, created = Item.objects.get_or_create(
            item_name=item_data["name"], brand=brand, defaults={"uom": item_data["uom"]}
        )
        items.append(item)
        if created:
            print(f"✅ Created item: {item.item_name}")
        else:
            print(f"ℹ️  Using existing item: {item.item_name}")

    # 3. Create tier pricing for each item
    pricing_tiers = [
        ("RD", 100.00),
        ("PD", 90.00),
        ("DD", 80.00),
        ("CD", 70.00),
        ("RS", 60.00),
        ("SUB-RS", 50.00),
        ("SRP", 40.00),
    ]

    for item in items:
        for tier, base_price in pricing_tiers:
            # Vary prices slightly between items
            price_variation = hash(item.item_name) % 10
            final_price = base_price + price_variation

            tier_pricing, created = ItemTierPricing.objects.get_or_create(
                item=item,
                pricing_tier=tier,
                defaults={"price": Decimal(str(final_price))},
            )
            if created:
                print(f"📊 Created pricing: {item.item_name} - {tier}: ₱{final_price}")

    # 4. Create or get admin user for transactions
    admin_user, created = Account.objects.get_or_create(
        username="batch_test_admin",
        defaults={
            "first_name": "Test",
            "last_name": "Admin",
            "role": "Admin",
            "cost_tier": None,  # No restrictions
        },
    )
    if created:
        admin_user.set_password("admin123")
        admin_user.save()
        print(f"✅ Created admin user: {admin_user.username} (password: admin123)")

    # 5. Create incoming transactions and batches
    print("\n📦 Creating inventory batches...")

    for i, item in enumerate(items):
        # Create an incoming transaction
        transaction = Transaction.objects.create(
            brand=brand,
            account=admin_user,
            transaction_type="INCOMING",
            reference_number=f"TEST-BATCH-{item.item_id}",
            notes=f"Test inventory for {item.item_name}",
        )

        # Create 2-3 batches per item with different quantities and costs
        batches_data = [
            {"qty": 50, "cost": 30.00 + (i * 5)},
            {"qty": 30, "cost": 32.00 + (i * 5)},
            {"qty": 20, "cost": 28.00 + (i * 5)},
        ]

        for j, batch_data in enumerate(batches_data):
            batch = ItemBatch.objects.create(
                item=item,
                cost_price=Decimal(str(batch_data["cost"])),
                initial_quantity=batch_data["qty"],
                remaining_quantity=batch_data["qty"],
                transaction=transaction,
            )
            print(
                f"📦 Created batch: {item.item_name} - Batch {batch.batch_number} - {batch.remaining_quantity} units @ ₱{batch.cost_price}"
            )

    # 6. Create test customers
    test_customers = [
        "ABC Beauty Store",
        "XYZ Cosmetics Shop",
        "Beauty Corner",
        "Glamour Palace",
        "Makeup Studio",
    ]

    for customer_name in test_customers:
        customer, created = Customer.objects.get_or_create(
            company_name=customer_name,
            defaults={
                "contact_person": "Manager",
                "address": f"{customer_name} Address",
                "contact_number": "123-456-7890",
                "customer_type": "Physical Store",
                "platform": "whatsapp",
            },
        )
        if created:
            print(f"👥 Created customer: {customer.company_name}")

    # 7. Create test users with different cost tiers
    test_users = [
        {"username": "pd_user", "cost_tier": "PD", "role": "Sales Rep"},
        {"username": "dd_user", "cost_tier": "DD", "role": "Sales Rep"},
        {"username": "rs_user", "cost_tier": "RS", "role": "Sales Rep"},
    ]

    for user_data in test_users:
        user, created = Account.objects.get_or_create(
            username=user_data["username"],
            defaults={
                "first_name": user_data["cost_tier"],
                "last_name": "User",
                "role": user_data["role"],
                "cost_tier": user_data["cost_tier"],
            },
        )
        if created:
            user.set_password("password123")
            user.save()
            print(
                f"👤 Created user: {user.username} (cost_tier: {user.cost_tier}, password: password123)"
            )

    print("\n🎉 Test data creation completed!")
    print("\n📋 Summary:")
    print(f"   - Brand: {Brand.objects.count()}")
    print(f"   - Items: {Item.objects.count()}")
    print(f"   - Batches: {ItemBatch.objects.count()}")
    print(f"   - Customers: {Customer.objects.count()}")
    print(f"   - Users: {Account.objects.count()}")
    print(f"   - Tier Pricing: {ItemTierPricing.objects.count()}")

    print("\n🧪 Testing Instructions:")
    print("1. Login with different users:")
    print("   - pd_user / password123 (can sell at: DD, CD, RS, SUB-RS, SRP)")
    print("   - dd_user / password123 (can sell at: CD, RS, SUB-RS, SRP)")
    print("   - rs_user / password123 (can sell at: SUB-RS, SRP)")
    print("2. Create 'Sell Products (to Customers)' transactions")
    print("3. Select items - you should see available batches")
    print("4. Test pricing tier restrictions")

    print("\n✅ Ready for testing batch selection!")


def cleanup_test_data():
    """Remove all test data"""
    print("🧹 Cleaning up test data...")

    # Delete in reverse order to avoid FK constraints
    ItemBatch.objects.filter(item__brand__brand_name="Test Beauty Brand").delete()
    ItemTierPricing.objects.filter(item__brand__brand_name="Test Beauty Brand").delete()
    Transaction.objects.filter(brand__brand_name="Test Beauty Brand").delete()
    Item.objects.filter(brand__brand_name="Test Beauty Brand").delete()
    Brand.objects.filter(brand_name="Test Beauty Brand").delete()
    Customer.objects.filter(company_name__endswith="Beauty Store").delete()
    Customer.objects.filter(company_name__endswith="Shop").delete()
    Customer.objects.filter(
        company_name__in=["Beauty Corner", "Glamour Palace", "Makeup Studio"]
    ).delete()
    Account.objects.filter(
        username__in=["batch_test_admin", "pd_user", "dd_user", "rs_user"]
    ).delete()

    print("✅ Test data cleaned up!")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "cleanup":
        cleanup_test_data()
    else:
        create_test_data()
