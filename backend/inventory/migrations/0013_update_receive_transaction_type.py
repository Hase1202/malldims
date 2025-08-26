# Generated manually to update transaction types

from django.db import migrations

def update_receive_transaction_type(apps, schema_editor):
    """Update 'Receive goods' transaction type to 'Receive Products'"""
    Transaction = apps.get_model('inventory', 'Transaction')
    Transaction.objects.filter(transaction_type='Receive goods').update(
        transaction_type='Receive Products'
    )

def reverse_receive_transaction_type(apps, schema_editor):
    """Reverse the transaction type update"""
    Transaction = apps.get_model('inventory', 'Transaction')
    Transaction.objects.filter(transaction_type='Receive Products').update(
        transaction_type='Receive goods'
    )

class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0012_alter_inventorybatch_options_and_more'),
    ]

    operations = [
        migrations.RunPython(
            update_receive_transaction_type, 
            reverse_receive_transaction_type
        ),
    ]
