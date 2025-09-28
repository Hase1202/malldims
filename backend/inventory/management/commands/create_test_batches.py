from django.core.management.base import BaseCommand
from django.db import transaction
from decimal import Decimal
from inventory.models import (
    Item,
    Brand,
    ItemBatch,
    Account,
    Transaction,
    ItemTierPricing,
    Customer,
)


class Command(BaseCommand):
    help = "Create test inventory batches for testing batch selection functionality"

    def add_arguments(self, parser):
        parser.add_argument(
            "--cleanup",
            action="store_true",
            help="Remove all test data instead of creating it",
        )

    def handle(self, *args, **options):
        if options["cleanup"]:
            self.cleanup_test_data()
        else:
            self.create_test_data()

    @transaction.atomic
    def create_test_data(self):
        """Create comprehensive test data including batches"""

        self.stdout.write(
            self.style.SUCCESS("🚀 Creating test data for batch selection...")
        )

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
            self.stdout.write(f"✅ Created brand: {brand.brand_name}")
        else:
            self.stdout.write(f"ℹ️  Using existing brand: {brand.brand_name}")

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
                item_name=item_data["name"],
                brand=brand,
                defaults={"uom": item_data["uom"]},
            )
            items.append(item)
            if created:
                self.stdout.write(f"✅ Created item: {item.item_name}")
            else:
                self.stdout.write(f"ℹ️  Using existing item: {item.item_name}")

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
                    self.stdout.write(
                        f"📊 Created pricing: {item.item_name} - {tier}: ₱{final_price}"
                    )

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
            self.stdout.write(
                f"✅ Created admin user: {admin_user.username} (password: admin123)"
            )

        # 5. Create incoming transactions and batches
        self.stdout.write("\n📦 Creating inventory batches...")

        for i, item in enumerate(items):
            # Create an incoming transaction
            transaction_obj = Transaction.objects.create(
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
                    transaction=transaction_obj,
                )
                self.stdout.write(
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
                self.stdout.write(f"👥 Created customer: {customer.company_name}")

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
                self.stdout.write(
                    f"👤 Created user: {user.username} (cost_tier: {user.cost_tier}, password: password123)"
                )

        self.stdout.write(self.style.SUCCESS("\n🎉 Test data creation completed!"))
        self.stdout.write("\n📋 Summary:")
        self.stdout.write(f"   - Brands: {Brand.objects.count()}")
        self.stdout.write(f"   - Items: {Item.objects.count()}")
        self.stdout.write(f"   - Batches: {ItemBatch.objects.count()}")
        self.stdout.write(f"   - Customers: {Customer.objects.count()}")
        self.stdout.write(f"   - Users: {Account.objects.count()}")
        self.stdout.write(f"   - Tier Pricing: {ItemTierPricing.objects.count()}")

        self.stdout.write("\n🧪 Testing Instructions:")
        self.stdout.write("1. Login with different users:")
        self.stdout.write(
            "   - pd_user / password123 (can sell at: DD, CD, RS, SUB-RS, SRP)"
        )
        self.stdout.write(
            "   - dd_user / password123 (can sell at: CD, RS, SUB-RS, SRP)"
        )
        self.stdout.write("   - rs_user / password123 (can sell at: SUB-RS, SRP)")
        self.stdout.write('2. Create "Sell Products (to Customers)" transactions')
        self.stdout.write("3. Select items - you should see available batches")
        self.stdout.write("4. Test pricing tier restrictions")

        self.stdout.write(self.style.SUCCESS("\n✅ Ready for testing batch selection!"))

    @transaction.atomic
    def cleanup_test_data(self):
        """Remove all test data"""
        self.stdout.write(self.style.WARNING("🧹 Cleaning up test data..."))

        # Delete in reverse order to avoid FK constraints
        deleted_batches = ItemBatch.objects.filter(
            item__brand__brand_name="Test Beauty Brand"
        ).count()
        ItemBatch.objects.filter(item__brand__brand_name="Test Beauty Brand").delete()

        deleted_pricing = ItemTierPricing.objects.filter(
            item__brand__brand_name="Test Beauty Brand"
        ).count()
        ItemTierPricing.objects.filter(
            item__brand__brand_name="Test Beauty Brand"
        ).delete()

        deleted_transactions = Transaction.objects.filter(
            brand__brand_name="Test Beauty Brand"
        ).count()
        Transaction.objects.filter(brand__brand_name="Test Beauty Brand").delete()

        deleted_items = Item.objects.filter(
            brand__brand_name="Test Beauty Brand"
        ).count()
        Item.objects.filter(brand__brand_name="Test Beauty Brand").delete()

        deleted_brands = Brand.objects.filter(brand_name="Test Beauty Brand").count()
        Brand.objects.filter(brand_name="Test Beauty Brand").delete()

        deleted_customers = 0
        deleted_customers += Customer.objects.filter(
            company_name__endswith="Beauty Store"
        ).count()
        deleted_customers += Customer.objects.filter(
            company_name__endswith="Shop"
        ).count()
        deleted_customers += Customer.objects.filter(
            company_name__in=["Beauty Corner", "Glamour Palace", "Makeup Studio"]
        ).count()

        Customer.objects.filter(company_name__endswith="Beauty Store").delete()
        Customer.objects.filter(company_name__endswith="Shop").delete()
        Customer.objects.filter(
            company_name__in=["Beauty Corner", "Glamour Palace", "Makeup Studio"]
        ).delete()

        deleted_users = Account.objects.filter(
            username__in=["batch_test_admin", "pd_user", "dd_user", "rs_user"]
        ).count()
        Account.objects.filter(
            username__in=["batch_test_admin", "pd_user", "dd_user", "rs_user"]
        ).delete()

        self.stdout.write(self.style.SUCCESS("✅ Test data cleaned up!"))
        self.stdout.write(f"   - Deleted {deleted_brands} brands")
        self.stdout.write(f"   - Deleted {deleted_items} items")
        self.stdout.write(f"   - Deleted {deleted_batches} batches")
        self.stdout.write(f"   - Deleted {deleted_customers} customers")
        self.stdout.write(f"   - Deleted {deleted_users} users")
        self.stdout.write(f"   - Deleted {deleted_pricing} tier pricing records")
        self.stdout.write(f"   - Deleted {deleted_transactions} transactions")
