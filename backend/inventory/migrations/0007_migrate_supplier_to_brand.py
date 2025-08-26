# Create this file manually or use: python manage.py makemigrations --empty inventory

from django.db import migrations

def migrate_suppliers_to_brands(apps, schema_editor):
    """Transfer all supplier data to brand table"""
    Supplier = apps.get_model('inventory', 'Supplier')
    Brand = apps.get_model('inventory', 'Brand')
    Item = apps.get_model('inventory', 'Item')
    Transaction = apps.get_model('inventory', 'Transaction')
    
    # Create Brand entries for each Supplier
    supplier_to_brand_mapping = {}
    
    for supplier in Supplier.objects.all():
        # Create corresponding brand
        brand = Brand.objects.create(
            brand_name=supplier.supplier_name,
            street_number=supplier.street_number,
            street_name=supplier.street_name,
            city=supplier.city,
            barangay=supplier.barangay,
            region=supplier.region,
            postal_code=supplier.postal_code,
            tin=supplier.tin,
            landline_number=supplier.landline_number,
            contact_person=supplier.contact_person,
            mobile_number=supplier.mobile_number,
            email=supplier.email,
            vat_classification='VAT',  # Default value
            status=supplier.status
        )
        supplier_to_brand_mapping[supplier.supplier_id] = brand.brand_id
        print(f"Migrated supplier '{supplier.supplier_name}' to brand '{brand.brand_name}'")
    
    # Update Items to use brand instead of supplier
    for item in Item.objects.all():
        if item.supplier_id in supplier_to_brand_mapping:
            brand_id = supplier_to_brand_mapping[item.supplier_id]
            # This will be handled by the schema migration
            print(f"Item '{item.item_name}' will be linked to brand_id {brand_id}")
    
    # Update Transactions to use brand instead of supplier  
    for transaction in Transaction.objects.all():
        if transaction.supplier_id and transaction.supplier_id in supplier_to_brand_mapping:
            brand_id = supplier_to_brand_mapping[transaction.supplier_id]
            print(f"Transaction {transaction.transaction_id} will be linked to brand_id {brand_id}")

def reverse_migration(apps, schema_editor):
    """Reverse the migration if needed"""
    # This would recreate suppliers from brands if needed
    pass

class Migration(migrations.Migration):
    dependencies = [
        ('inventory', '0002_add_beauty_product_models'),
    ]

    operations = [
        migrations.RunPython(migrate_suppliers_to_brands, reverse_migration),
    ]