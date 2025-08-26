import os
import django

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

# Import models and cursor
from django.db import connection

def reset_sequence(table_name, id_column):
    with connection.cursor() as cursor:
        # Get the highest ID in the database
        cursor.execute(f"SELECT MAX({id_column}) FROM {table_name};")
        max_id = cursor.fetchone()[0] or 0
        print(f"Current maximum {id_column}: {max_id}")
        
        # Reset the sequence to the next value
        seq_name = f"{table_name}_{id_column}_seq"
        cursor.execute(f"SELECT setval('{seq_name}', {max_id}, true);")
        
        try:
            # Verify the sequence was reset correctly (newer PostgreSQL versions)
            cursor.execute(f"SELECT last_value, is_called FROM {seq_name};")
            seq_val, is_called = cursor.fetchone()
            print(f"Sequence reset to: {seq_val} (is_called: {is_called})")
        except Exception:
            # Fallback for older PostgreSQL versions
            cursor.execute(f"SELECT last_value FROM {seq_name};")
            seq_val = cursor.fetchone()[0]
            print(f"Sequence reset to: {seq_val}")
        
        print(f"Sequence reset successfully. New {table_name} should use IDs starting from {max_id + 1}")
        print("------------------------------")

print("=== RESETTING DATABASE SEQUENCES ===")
# Reset supplier sequence
reset_sequence('supplier', 'supplier_id')

# Reset item sequence
reset_sequence('item', 'item_id')

# Reset transaction sequence
reset_sequence('transaction', 'transaction_id')

print("All sequences have been reset successfully!") 