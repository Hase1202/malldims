# Generated manually on 2025-07-28
# Update Item and Transaction relationships to use brand instead of supplier

from django.db import migrations, models
import django.db.models.deletion

def update_item_brand_relationships(apps, schema_editor):
    """Update Items to use their corresponding brand instead of supplier"""
    Item = apps.get_model('inventory', 'Item')
    Supplier = apps.get_model('inventory', 'Supplier')
    Brand = apps.get_model('inventory', 'Brand')
    
    # Create a mapping from supplier names to brand IDs
    supplier_to_brand = {}
    for supplier in Supplier.objects.all():
        try:
            brand = Brand.objects.get(brand_name=supplier.supplier_name)
            supplier_to_brand[supplier.supplier_id] = brand.brand_id
        except Brand.DoesNotExist:
            print(f"Warning: No brand found for supplier '{supplier.supplier_name}'")
    
    # Update items to use brand instead of supplier
    items_updated = 0
    for item in Item.objects.all():
        if item.supplier_id and item.supplier_id in supplier_to_brand:
            brand_id = supplier_to_brand[item.supplier_id]
            item.brand_id = brand_id
            item.save()
            items_updated += 1
            print(f"Updated item '{item.item_name}' to use brand_id {brand_id}")
        elif item.supplier_id:
            print(f"Warning: Item '{item.item_name}' has supplier_id {item.supplier_id} but no matching brand found")
    
    print(f"Updated {items_updated} items to use brand relationships")

def update_transaction_brand_relationships(apps, schema_editor):
    """Update Transactions to use their corresponding brand instead of supplier"""
    Transaction = apps.get_model('inventory', 'Transaction')
    Supplier = apps.get_model('inventory', 'Supplier')
    Brand = apps.get_model('inventory', 'Brand')
    
    # Create a mapping from supplier names to brand IDs
    supplier_to_brand = {}
    for supplier in Supplier.objects.all():
        try:
            brand = Brand.objects.get(brand_name=supplier.supplier_name)
            supplier_to_brand[supplier.supplier_id] = brand.brand_id
        except Brand.DoesNotExist:
            print(f"Warning: No brand found for supplier '{supplier.supplier_name}'")
    
    # Update transactions to use brand instead of supplier
    transactions_updated = 0
    for transaction in Transaction.objects.all():
        if transaction.supplier_id and transaction.supplier_id in supplier_to_brand:
            brand_id = supplier_to_brand[transaction.supplier_id]
            transaction.brand_id = brand_id
            transaction.save()
            transactions_updated += 1
            print(f"Updated transaction {transaction.transaction_id} to use brand_id {brand_id}")
        elif transaction.supplier_id:
            print(f"Warning: Transaction {transaction.transaction_id} has supplier_id {transaction.supplier_id} but no matching brand found")
    
    print(f"Updated {transactions_updated} transactions to use brand relationships")

class Migration(migrations.Migration):
    dependencies = [
        ('inventory', '0007_migrate_supplier_to_brand'),
    ]

    operations = [
        migrations.RunPython(update_item_brand_relationships),
        migrations.RunPython(update_transaction_brand_relationships),
    ]
